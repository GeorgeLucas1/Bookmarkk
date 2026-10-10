import type { ChatCompletionMessage } from '../llm/openrouter.service';
import { NOTE_TYPE_LABELS, NoteType } from '../notes/note-types';

export const ENTITY_KINDS = ['character', 'place', 'item', 'event', 'concept'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface ExtractedEntity {
  name: string;
  kind: EntityKind;
}

export interface ExtractedRelation {
  from: string;
  to: string;
  label: string;
}

export interface MemoryExtraction {
  summary: string;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

export interface MemorySource {
  note: { title: string; type: NoteType; content: string; entries: { content: string }[] };
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Entities already in this note's graph, so the model reuses their names. */
  knownEntities: string[];
}

const MAX_NOTE_CHARS = 6000;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 1500;
const MAX_ENTITIES = 15;

/** Lowercased, single-spaced name used to match the same entity across conversations. */
export function entityKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Builds the prompt that turns a conversation, together with its note, into
 * a memory: a short summary plus the entities and relations discussed.
 */
export function buildMemoryMessages(source: MemorySource): ChatCompletionMessage[] {
  const noteText = [source.note.content, ...source.note.entries.map((e) => e.content)]
    .join('\n\n')
    .slice(0, MAX_NOTE_CHARS);

  const transcript = source.messages
    .slice(-MAX_MESSAGES)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, MAX_MESSAGE_CHARS)}`)
    .join('\n\n');

  const system = [
    "You build long-term memory from a user's conversations about one of their notes.",
    'Read the note and the conversation, then reply with ONLY a JSON object, no prose, in this shape:',
    '{"summary": string, "entities": [{"name": string, "kind": string}], "relations": [{"from": string, "to": string, "label": string}]}',
    'Rules:',
    '- summary: 1 to 3 sentences, in the language of the conversation. Say what was discussed, what was concluded and what is still open or suspected by the user.',
    `- entities: at most ${MAX_ENTITIES} important things from the conversation and the note. kind is one of: ${ENTITY_KINDS.join(', ')}.`,
    '- relations: only between names listed in entities. label is a short verb phrase (1 to 3 words) in the language of the conversation; end it with "?" when it is a guess, not a fact.',
    source.knownEntities.length > 0
      ? `- These entities already exist; reuse the exact same name when you mean one of them: ${source.knownEntities.join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    `Note title: ${source.note.title}`,
    `Note type: ${NOTE_TYPE_LABELS[source.note.type] ?? source.note.type}`,
    'Note content:',
    noteText,
    '',
    'Conversation:',
    transcript,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Parses the model reply into a memory. Tolerates code fences and text
 * around the JSON, drops malformed entities and relations, and returns null
 * when there is no usable summary. Relations may point at entities listed in
 * the reply or already in the graph (`knownEntities`).
 */
export function parseMemoryExtraction(reply: string, knownEntities: string[] = []): MemoryExtraction | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;

  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  if (!summary) {
    return null;
  }

  const entities: ExtractedEntity[] = [];
  const seen = new Map<string, string>();
  for (const item of Array.isArray(data.entities) ? data.entities : []) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const kind = (ENTITY_KINDS as readonly string[]).includes(item?.kind) ? (item.kind as EntityKind) : 'concept';
    if (!name || seen.has(entityKey(name)) || entities.length >= MAX_ENTITIES) {
      continue;
    }
    seen.set(entityKey(name), name);
    entities.push({ name, kind });
  }

  const linkable = new Map(knownEntities.map((name) => [entityKey(name), name]));
  for (const [key, name] of seen) {
    linkable.set(key, name);
  }

  const relations: ExtractedRelation[] = [];
  for (const item of Array.isArray(data.relations) ? data.relations : []) {
    const from = typeof item?.from === 'string' ? linkable.get(entityKey(item.from)) : undefined;
    const to = typeof item?.to === 'string' ? linkable.get(entityKey(item.to)) : undefined;
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    if (!from || !to || from === to || !label) {
      continue;
    }
    relations.push({ from, to, label });
  }

  return { summary, entities, relations };
}
