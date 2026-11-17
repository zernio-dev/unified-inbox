const MEDIA_PLACEHOLDERS = new Set([
  '[sticker]',
  '[audio]',
  '[reaction]',
  '[image]',
  '[video]',
  '[document]',
  '[unsupported message]',
]);

export type AgentInboundDto = {
  phone: string;
  text: string;
  event_id?: string;
  conversation_id?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function eventsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const rec = asRecord(payload);
  if (!rec) return [];
  if (Array.isArray(rec.events)) return rec.events;
  return [payload];
}

export function unwrapEvent(evt: unknown): Record<string, unknown> {
  const rec = asRecord(evt) ?? {};
  const nested = asRecord(rec.data);
  return nested ?? rec;
}

function truthyFlag(...values: unknown[]): boolean {
  return values.some((v) => v === true || v === 1 || v === 'true' || v === '1');
}

export function isEchoEvent(data: Record<string, unknown>, rawEvent: Record<string, unknown> = {}): boolean {
  const key = asRecord(data.key) ?? {};
  const metadata = (asRecord(data.metadata) || asRecord(rawEvent.metadata) || {}) as Record<string, unknown>;
  const msgObj = asRecord(data.message) ?? {};
  const sender = (asRecord(data.sender) || asRecord(msgObj.sender) || {}) as Record<string, unknown>;

  // 1. Ignorar se estiver em standby (humano assumiu no chat ou modo standby ativo)
  if (truthyFlag(data.standby, rawEvent.standby, metadata.standby)) {
    return true;
  }

  // 2. Ignorar se for mensagem enviada por nós (fromMe / echo / outbound / isSelf)
  const direction = `${str(data.direction) || str(rawEvent.direction)}`.toLowerCase();
  const kind = `${str(data.type) || str(rawEvent.type) || str(rawEvent.event)}`.toLowerCase();
  if (
    truthyFlag(
      data.fromMe,
      data.from_me,
      data.isFromMe,
      data.echo,
      data.fromMeEcho,
      key.fromMe,
      rawEvent.fromMe,
      rawEvent.from_me,
      metadata.isEcho,
      sender.isSelf,
    )
  ) {
    return true;
  }
  if (['outgoing', 'outbound', 'out', 'from-me', 'from_me'].includes(direction)) return true;
  if (kind.includes('outgoing') || kind.includes('from-me') || kind.includes('sent')) return true;
  return false;
}

export function pickPhone(data: Record<string, unknown>): string {
  const msgObj = asRecord(data.message) ?? {};
  const msgSender = asRecord(msgObj.sender) ?? {};
  const directSender = asRecord(data.sender) ?? {};

  const conversationId = str(data.conversationId) || str(data.conversation_id) || str(data.chatId);
  const fromConv =
    conversationId.includes('@') ? conversationId.split('@')[0] : '';

  return (
    // Zernio message.received real payload: message.sender.phoneNumber ou id
    str(msgSender.phoneNumber) ||
    str(msgSender.phone) ||
    str(msgSender.id) ||
    str(directSender.phoneNumber) ||
    str(directSender.phone) ||
    str(directSender.id) ||
    str(data.phoneNumber) ||
    str(data.phone) ||
    str(data.from) ||
    str(data.recipientPhone) ||
    str(data.customerPhone) ||
    str(data.externalId) ||
    str(data.participantId) ||
    fromConv
  );
}

function pickNestedText(message: unknown): string {
  if (typeof message === 'string') return message;
  const rec = asRecord(message);
  if (!rec) return '';
  const extended = asRecord(rec.extendedTextMessage);
  return (
    str(rec.conversation) ||
    str(rec.text) ||
    str(rec.body) ||
    str(rec.caption) ||
    (extended ? str(extended.text) : '')
  );
}

export function pickText(data: Record<string, unknown>): string {
  const raw =
    str(data.body) ||
    str(data.text) ||
    str(data.caption) ||
    pickNestedText(data.message) ||
    str(data.content);
  return raw.trim();
}

export function isUsableText(text: string): boolean {
  if (!text) return false;
  return !MEDIA_PLACEHOLDERS.has(text.toLowerCase());
}

export function pickEventId(data: Record<string, unknown>, rawEvent: Record<string, unknown> = {}): string {
  const key = asRecord(data.key) ?? {};
  return (
    str(data.id) ||
    str(data.messageId) ||
    str(data.message_id) ||
    str(data.eventId) ||
    str(data.event_id) ||
    str(key.id) ||
    str(rawEvent.id)
  );
}

function pickConversationId(data: Record<string, unknown>): string | undefined {
  const value =
    str(data.conversationId) ||
    str(data.conversation_id) ||
    str(data.chatId) ||
    str(data.chat_id);
  return value || undefined;
}

export function inboundDtosFromWebhook(payload: unknown): AgentInboundDto[] {
  const out: AgentInboundDto[] = [];
  for (const evt of eventsFromPayload(payload)) {
    const raw = asRecord(evt) ?? {};
    const data = unwrapEvent(evt);
    if (isEchoEvent(data, raw)) continue;
    const phone = pickPhone(data);
    const text = pickText(data);
    if (!phone || !isUsableText(text)) continue;
    const eventId = pickEventId(data, raw);
    const conversationId = pickConversationId(data);
    const dto: AgentInboundDto = { phone, text };
    if (eventId) dto.event_id = eventId;
    if (conversationId) dto.conversation_id = conversationId;
    out.push(dto);
  }
  return out;
}
