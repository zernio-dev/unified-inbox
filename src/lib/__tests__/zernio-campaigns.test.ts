import { describe, expect, it } from 'vitest';
import {
  getBroadcasts,
  createBroadcast,
  getSequences,
  getCommentAutomations,
} from '@/services/zernio-campaigns';

describe('Zernio Campaigns Service', () => {
  it('deve retornar a lista inicial de broadcasts mockados', async () => {
    const broadcasts = await getBroadcasts();
    expect(Array.isArray(broadcasts)).toBe(true);
    expect(broadcasts.length).toBeGreaterThan(0);
    expect(broadcasts[0]).toHaveProperty('id');
    expect(broadcasts[0]).toHaveProperty('name');
  });

  it('deve criar um novo broadcast com sucesso', async () => {
    const newBroadcast = await createBroadcast({
      name: 'Oferta Especial Teste',
      channel: 'instagram',
      targetTags: ['VIP'],
      message: 'Olá {{nome}}, confira nossa oferta!',
    });

    expect(newBroadcast).toHaveProperty('id');
    expect(newBroadcast.name).toBe('Oferta Especial Teste');
    expect(newBroadcast.sentCount).toBe(0);

    const broadcasts = await getBroadcasts();
    expect(broadcasts.some((b) => b.id === newBroadcast.id)).toBe(true);
  });

  it('deve retornar a lista de sequências', async () => {
    const sequences = await getSequences();
    expect(Array.isArray(sequences)).toBe(true);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences[0].steps.length).toBeGreaterThan(0);
  });

  it('deve retornar as automações de comment-to-dm', async () => {
    const automations = await getCommentAutomations();
    expect(Array.isArray(automations)).toBe(true);
    expect(automations.length).toBeGreaterThan(0);
    expect(automations[0]).toHaveProperty('keyword');
  });
});
