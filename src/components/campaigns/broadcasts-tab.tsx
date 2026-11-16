'use client';

import { useState } from 'react';
import { Plus, Radio, Send, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Broadcast, CreateBroadcastInput } from '@/types/zernio-campaigns';
import { NewBroadcastModal } from './new-broadcast-modal';

interface BroadcastsTabProps {
  broadcasts: Broadcast[];
  onCreateBroadcast: (input: CreateBroadcastInput) => Promise<void>;
}

export function BroadcastsTab({ broadcasts, onCreateBroadcast }: BroadcastsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const getStatusBadge = (status: Broadcast['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            <CheckCircle2 className="size-3" /> Concluído
          </Badge>
        );
      case 'sending':
        return (
          <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-400 bg-blue-500/10 animate-pulse">
            <Send className="size-3" /> Enviando
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-400 bg-amber-500/10">
            <Clock className="size-3" /> Agendado
          </Badge>
        );
      case 'draft':
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" /> Falha
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Disparos de Broadcast</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie e crie envios de mensagens diretas em lote segmentados por público-alvo.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Novo Broadcast
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--chat-border)] bg-[var(--chat-input)] text-muted-foreground font-medium">
              <tr>
                <th className="p-3.5 pl-4">Campanha</th>
                <th className="p-3.5">Canal</th>
                <th className="p-3.5">Público / Tags</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Progresso (Enviados)</th>
                <th className="p-3.5 pr-4 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--chat-border)]">
              {broadcasts.map((bc) => (
                <tr key={bc.id} className="hover:bg-[var(--chat-input)]/50 transition-colors">
                  <td className="p-3.5 pl-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Radio className="size-4 text-primary" />
                      <span>{bc.name}</span>
                    </div>
                  </td>
                  <td className="p-3.5 capitalize">{bc.channel}</td>
                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {bc.targetTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5">{getStatusBadge(bc.status)}</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">
                        {bc.sentCount} / {bc.totalRecipients}
                      </span>
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${Math.round((bc.sentCount / (bc.totalRecipients || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 pr-4 text-right text-xs text-muted-foreground">
                    {new Date(bc.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NewBroadcastModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={onCreateBroadcast}
      />
    </div>
  );
}
