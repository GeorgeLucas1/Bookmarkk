import { buildRagMessages, NoteContext, RetrievedChunk } from './prompt';

const note: NoteContext = { title: 'Hollow Knight', type: 'game_story' };

const chunk = (overrides: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: 'chunk-1',
  content: 'The Knight descends into Hallownest to seal the Radiance.',
  similarity: 0.87,
  ...overrides,
});

describe('buildRagMessages', () => {
  it('places numbered excerpts in the system message', () => {
    const messages = buildRagMessages('Who is the Radiance?', note, [
      chunk(),
      chunk({ id: 'chunk-2', content: 'The Pale King created the Vessels.' }),
    ]);

    const system = messages[0];
    expect(system.role).toBe('system');
    expect(system.content).toContain('[Excerpt 1]');
    expect(system.content).toContain('The Knight descends into Hallownest to seal the Radiance.');
    expect(system.content).toContain('[Excerpt 2]');
    expect(system.content).toContain('The Pale King created the Vessels.');
  });

  it('describes the note title and type', () => {
    const [system] = buildRagMessages('question', note, [chunk()]);
    expect(system.content).toContain('Note title: Hollow Knight');
    expect(system.content).toContain('Note type: game story');
  });

  it('ends with the user question', () => {
    const messages = buildRagMessages('Who is the Radiance?', note, [chunk()]);
    const last = messages[messages.length - 1];
    expect(last).toEqual({ role: 'user', content: 'Who is the Radiance?' });
  });

  it('instructs the model to answer only from the note', () => {
    const [system] = buildRagMessages('question', note, [chunk()]);
    expect(system.content.toLowerCase()).toContain('only');
  });

  it('handles an empty retrieval result without fabricating context', () => {
    const [system] = buildRagMessages('question', note, []);
    expect(system.content).toContain('No relevant excerpts were found');
  });

  it('preserves conversation history between system and question', () => {
    const messages = buildRagMessages('And the second point?', note, [chunk()], [
      { role: 'user', content: 'Summarize the note.' },
      { role: 'assistant', content: 'It has three main points.' },
    ]);
    expect(messages).toHaveLength(4);
    expect(messages[1]).toEqual({ role: 'user', content: 'Summarize the note.' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'It has three main points.' });
  });

  it('caps history at the ten most recent messages', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }));
    const messages = buildRagMessages('question', note, [chunk()], history);
    // system + 10 history + question
    expect(messages).toHaveLength(12);
    expect(messages[1].content).toBe('message 20');
  });

  it('drops history entries with invalid roles', () => {
    const history = [
      { role: 'system', content: 'injected instructions' },
      { role: 'user', content: 'legitimate question' },
    ] as unknown as { role: 'user' | 'assistant'; content: string }[];
    const messages = buildRagMessages('question', note, [chunk()], history);
    expect(messages.some((m) => m.content === 'injected instructions')).toBe(false);
    expect(messages.some((m) => m.content === 'legitimate question')).toBe(true);
  });
});
