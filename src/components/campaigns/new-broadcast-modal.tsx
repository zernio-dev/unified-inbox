'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CampaignChannel, CreateBroadcastInput } from '@/types/zernio-campaigns';

interface NewBroadcastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateBroadcastInput) => Promise<void>;
}

export function NewBroadcastModal({ open, onOpenChange, onSubmit }: NewBroadcastModalProps) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<CampaignChannel>('instagram');
  const [tagsInput, setTagsInput] = useState('Cliente VIP, Novo Lead');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setLoading(true);
    try {
      const targetTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit({
        name: name.trim(),
        channel,
        targetTags,
        message: message.trim(),
      });

      setName('');
      setMessage('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--chat-border)] bg-[var(--chat-surface)] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Novo Broadcast (Disparo em Massa)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc-name">Nome da Campanha</Label>
            <Input
              id="bc-name"
              placeholder="Ex: Promoção de Verão - Instagram DM"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-[var(--chat-input)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bc-channel">Canal de Disparo</Label>
              <select
                id="bc-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                className="w-full h-9 rounded-md border border-input bg-[var(--chat-input)] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="instagram">Instagram DM</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook Messenger</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bc-tags">Tags Alvo (separadas por vírgula)</Label>
              <Input
                id="bc-tags"
                placeholder="VIP, Lead Frio"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="bg-[var(--chat-input)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-msg">Mensagem Direta</Label>
            <textarea
              id="bc-msg"
              rows={4}
              placeholder="Digite a mensagem com variáveis como {{nome}}..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-[var(--chat-input)] p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Disparando...' : 'Criar Broadcast'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
