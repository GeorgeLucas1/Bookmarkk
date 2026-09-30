import { NOTE_TYPE_LABELS, NoteType } from '../notes/note-types';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
}

export interface NoteContext {
  title: string;
  type: NoteType;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY_MESSAGES = 10;

/**
 * Builds the message list for the RAG chat completion.
 *
 * The system message carries the note title and type plus the retrieved
 * excerpts, numbered, and instructs the model to answer only from that
 * context.
 */
export function buildRagMessages(
  question: string,
  note: NoteContext,
  chunks: RetrievedChunk[],
  history: ChatHistoryMessage[] = [],
): ChatCompletionMessage[] {
  const context =
    chunks.length > 0
      ? chunks.map((chunk, index) => `[Excerpt ${index + 1}]\n${chunk.content}`).join('\n\n')
      : 'No relevant excerpts were found in the note.';

  const system = [
    'You are a note assistant. Answer the user question using only the note excerpts below.',
    'Rules:',
    '- If the excerpts do not contain the answer, say so clearly instead of guessing.',
    '- Answer in the same language as the user question.',
    '- Be concise and factual.',
    '',
    `Note title: ${note.title}`,
    `Note type: ${NOTE_TYPE_LABELS[note.type] ?? note.type}`,
    '',
    'Note excerpts:',
    context,
  ].join('\n');

  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }));

  return [{ role: 'system', content: system }, ...trimmedHistory, { role: 'user', content: question }];
}
