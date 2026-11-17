import { NextResponse } from 'next/server';
import {
  inboundDtosFromWebhook,
  eventsFromPayload,
  unwrapEvent,
  isEchoEvent,
  pickPhone,
  pickEventId,
} from '@/lib/server/agentInbound';
import { resolveOrProvisionContact } from '@/lib/server/contactResolver';

const FASTAPI_URL = (
  process.env.HARMOSTORE_API_URL ||
  process.env.FASTAPI_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

const FASTAPI_KEY = process.env.HARMOSTORE_API_KEY || '';
const ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || '';

// Deduplicação em memória (TTL de 10 min, max 3000 IDs)
const PROCESSED_EVENTS = new Map<string, number>();
const DEDUP_TTL_MS = 10 * 60 * 1000;

function isDuplicate(id: string): boolean {
  if (!id) return false;
  const now = Date.now();
  if (PROCESSED_EVENTS.size > 2000) {
    for (const [k, ts] of PROCESSED_EVENTS.entries()) {
      if (now - ts > DEDUP_TTL_MS) PROCESSED_EVENTS.delete(k);
    }
  }
  const prev = PROCESSED_EVENTS.get(id);
  if (prev && now - prev < DEDUP_TTL_MS) {
    return true;
  }
  PROCESSED_EVENTS.set(id, now);
  return false;
}

function pickName(data: Record<string, unknown>): string | null {
  const msgObj = (data.message && typeof data.message === 'object' ? data.message : {}) as Record<string, unknown>;
  const msgSender = (msgObj.sender && typeof msgObj.sender === 'object' ? msgObj.sender : {}) as Record<string, unknown>;
  const directSender = (data.sender && typeof data.sender === 'object' ? data.sender : {}) as Record<string, unknown>;

  const value =
    msgSender.name ||
    msgSender.pushName ||
    directSender.name ||
    directSender.pushName ||
    data.name ||
    data.pushName ||
    data.contactName ||
    data.profileName ||
    null;
  return typeof value === 'string' ? value : null;
}

function pickAvatar(data: Record<string, unknown>): string | null {
  const msgObj = (data.message && typeof data.message === 'object' ? data.message : {}) as Record<string, unknown>;
  const msgSender = (msgObj.sender && typeof msgObj.sender === 'object' ? msgObj.sender : {}) as Record<string, unknown>;
  const directSender = (data.sender && typeof data.sender === 'object' ? data.sender : {}) as Record<string, unknown>;

  const value =
    msgSender.avatarUrl ||
    msgSender.profilePicUrl ||
    directSender.avatarUrl ||
    directSender.profilePicUrl ||
    data.avatarUrl ||
    data.profilePicUrl ||
    null;
  return typeof value === 'string' ? value : null;
}

async function forwardToAgent(dto: ReturnType<typeof inboundDtosFromWebhook>[number]): Promise<void> {
  if (!FASTAPI_KEY) {
    console.warn('[Zernio Webhook] HARMOSTORE_API_KEY ausente; agente não invocado');
    return;
  }
  const resp = await fetch(`${FASTAPI_URL}/agents/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': FASTAPI_KEY,
    },
    body: JSON.stringify(dto),
  });
  if (resp.status === 204 || resp.ok) return;
  const detail = await resp.text().catch(() => '');
  console.error('[Zernio Webhook] FastAPI inbound falhou', resp.status, detail);
}

export async function POST(req: Request) {
  try {
    // 1. Validação de Assinatura/Secret se ZERNIO_WEBHOOK_SECRET estiver configurado
    if (ZERNIO_WEBHOOK_SECRET) {
      const headerSecret =
        req.headers.get('x-webhook-secret') ||
        req.headers.get('x-zernio-signature') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      if (headerSecret !== ZERNIO_WEBHOOK_SECRET) {
        console.warn('[Zernio Webhook] Assinatura/Secret inválido');
        return NextResponse.json({ success: false, error: 'Unauthorized webhook' }, { status: 401 });
      }
    }

    const payload = await req.json();
    const events = eventsFromPayload(payload);
    const results = [];

    for (const evt of events) {
      const raw = (evt !== null && typeof evt === 'object' && !Array.isArray(evt) ? evt : {}) as Record<string, unknown>;
      const data = unwrapEvent(evt);

      // Ignora mensagens enviadas por nós, echoes ou canais em standby
      if (isEchoEvent(data, raw)) {
        continue;
      }

      const eventId = pickEventId(data, raw);
      if (eventId && isDuplicate(eventId)) {
        console.log(`[Zernio Webhook] Evento duplicado ignorado: ${eventId}`);
        continue;
      }

      // Normalização robusta de telefone (suporta Zernio message.sender.phoneNumber e formatos legados)
      const rawPhone = pickPhone(data);

      if (rawPhone) {
        const provisioned = await resolveOrProvisionContact({
          phone: String(rawPhone),
          name: pickName(data),
          avatarUrl: pickAvatar(data),
        });
        results.push(provisioned);
      }
    }

    // Encaminha apenas mensagens válidas que não foram deduplicadas ou descartadas
    const dtos = inboundDtosFromWebhook(payload).filter((dto) => {
      if (dto.event_id && isDuplicate(dto.event_id)) return false;
      return true;
    });

    await Promise.allSettled(dtos.map((dto) => forwardToAgent(dto)));

    return NextResponse.json({
      success: true,
      processedEvents: events.length,
      forwardedToAgent: dtos.length,
      provisionedContacts: results.filter(Boolean),
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Zernio Webhook] Error processing event:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Invalid webhook payload' },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'HarmoStore Zernio Webhook Listener',
    timestamp: new Date().toISOString(),
  });
}
