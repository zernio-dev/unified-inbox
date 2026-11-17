'use client';

import { GitCommit, Layers, Users, Play, Pause, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Sequence } from '@/types/zernio-campaigns';

interface SequencesTabProps {
  sequences: Sequence[];
}

export function SequencesTab({ sequences }: SequencesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sequências (Réguas de Follow-up)</h2>
          <p className="text-sm text-muted-foreground">
            Configure réguas automáticas de mensagens sequenciais temporizadas para nutrição de leads.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          Nova Sequência
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            className="rounded-xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-5 space-y-4 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="size-5 text-primary" />
                    <h3 className="font-semibold text-base">{seq.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">Canal: {seq.channel}</span>
                </div>
                {seq.active ? (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <Play className="size-3 fill-current" /> Ativa
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Pause className="size-3" /> Pausada
                  </Badge>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--chat-border)] space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GitCommit className="size-4 text-primary" /> Passos da Régua ({seq.steps.length} Etapas):
                </p>
                <div className="space-y-1.5 pl-2 border-l-2 border-primary/20 ml-2">
                  {seq.steps.map((step) => (
                    <div key={step.id} className="text-xs space-y-0.5">
                      <span className="font-semibold text-foreground">
                        Passo {step.stepNumber} ({step.delayHours === 0 ? 'Imediato' : `+${step.delayHours}h`}):
                      </span>
                      <p className="text-muted-foreground truncate">{step.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--chat-border)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="size-4 text-primary" />
                <span className="font-semibold text-foreground">{seq.enrolledCount}</span> inscritos
              </div>
              <Button variant="outline" size="sm">
                Editar Passos
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
