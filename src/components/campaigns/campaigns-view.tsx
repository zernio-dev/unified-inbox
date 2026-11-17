'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, Layers, MessageSquareCode, Loader2 } from 'lucide-react';
import type {
  Broadcast,
  Sequence,
  CommentAutomation,
  CreateBroadcastInput,
} from '@/types/zernio-campaigns';
import {
  getBroadcasts,
  createBroadcast,
  getSequences,
  getCommentAutomations,
} from '@/services/zernio-campaigns';
import { BroadcastsTab } from './broadcasts-tab';
import { SequencesTab } from './sequences-tab';
import { CommentDmTab } from './comment-dm-tab';

export function CampaignsView() {
  const [activeTab, setActiveTab] = useState('broadcasts');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [automations, setAutomations] = useState<CommentAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [bData, sData, cData] = await Promise.all([
          getBroadcasts(),
          getSequences(),
          getCommentAutomations(),
        ]);
        setBroadcasts(bData);
        setSequences(sData);
        setAutomations(cData);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateBroadcast = async (input: CreateBroadcastInput) => {
    const created = await createBroadcast(input);
    setBroadcasts((prev) => [created, ...prev]);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 bg-[var(--chat-canvas)]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--chat-canvas)] p-6 space-y-6">
      <div className="flex flex-col gap-1 border-b border-[var(--chat-border)] pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Módulo de Campanhas & Follow-up</h1>
        <p className="text-sm text-muted-foreground">
          Gestão integrada de envios diretos em lote, réguas de relacionamento e automação de comentários (Zernio Engine).
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[var(--chat-surface)] border border-[var(--chat-border)] p-1 rounded-lg inline-flex">
          <TabsTrigger value="broadcasts" className="gap-2 px-4 py-2 text-sm font-medium">
            <Radio className="size-4 text-primary" />
            Broadcasts
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-2 px-4 py-2 text-sm font-medium">
            <Layers className="size-4 text-primary" />
            Sequências
          </TabsTrigger>
          <TabsTrigger value="comment-dm" className="gap-2 px-4 py-2 text-sm font-medium">
            <MessageSquareCode className="size-4 text-primary" />
            Comment-to-DM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcasts" className="focus-visible:outline-none">
          <BroadcastsTab broadcasts={broadcasts} onCreateBroadcast={handleCreateBroadcast} />
        </TabsContent>

        <TabsContent value="sequences" className="focus-visible:outline-none">
          <SequencesTab sequences={sequences} />
        </TabsContent>

        <TabsContent value="comment-dm" className="focus-visible:outline-none">
          <CommentDmTab automations={automations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
