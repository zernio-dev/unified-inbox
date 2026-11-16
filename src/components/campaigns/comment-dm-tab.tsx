'use client';

import { MessageSquareCode, ExternalLink, Zap, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CommentAutomation } from '@/types/zernio-campaigns';

interface CommentDmTabProps {
  automations: CommentAutomation[];
}

export function CommentDmTab({ automations }: CommentDmTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Comment-to-DM (Automação de Comentários)</h2>
          <p className="text-sm text-muted-foreground">
            Monitore comentários em posts de redes sociais por palavras-chave e responda publicamente enviando DM privada.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          Nova Regra
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--chat-border)] bg-[var(--chat-input)] text-muted-foreground font-medium">
              <tr>
                <th className="p-3.5 pl-4">Regra / Post</th>
                <th className="p-3.5">Plataforma</th>
                <th className="p-3.5">Gatilho (Keyword)</th>
                <th className="p-3.5">Resposta Pública</th>
                <th className="p-3.5">Mensagem Privada (DM)</th>
                <th className="p-3.5">Disparos</th>
                <th className="p-3.5 pr-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--chat-border)]">
              {automations.map((ca) => (
                <tr key={ca.id} className="hover:bg-[var(--chat-input)]/50 transition-colors">
                  <td className="p-3.5 pl-4 font-medium">
                    <div className="flex items-center gap-2">
                      <MessageSquareCode className="size-4 text-primary flex-none" />
                      <div>
                        <span>{ca.name}</span>
                        <a
                          href={ca.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5"
                        >
                          Ver Post Original <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 capitalize">{ca.platform}</td>
                  <td className="p-3.5 font-mono text-xs">
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      {ca.keyword}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-xs text-muted-foreground max-w-xs truncate">
                    {ca.publicResponses[0]}
                  </td>
                  <td className="p-3.5 text-xs text-muted-foreground max-w-xs truncate">
                    {ca.dmMessage}
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-xs flex items-center gap-1">
                      <Zap className="size-3 text-amber-400" />
                      {ca.triggerCount}
                    </span>
                  </td>
                  <td className="p-3.5 pr-4 text-right">
                    {ca.active ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        <Check className="size-3" /> Ativa
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
