import { Inject, Injectable } from '@nestjs/common';
import { cosineDistance, eq, sql } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { noteChunks } from '../database/schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { OpenRouterService } from '../llm/openrouter.service';
import { MemoryService } from '../memory/memory.service';
import { NotesService } from '../notes/notes.service';
import { buildRagMessages, ChatHistoryMessage, RetrievedChunk } from './prompt';

const TOP_K = 5;

export interface ChatSource {
  id: string;
  content: string;
  similarity: number;
}

export interface ChatStream {
  /** Conversation the messages were saved to; the client sends it back to continue it. */
  conversationId: string;
  sources: ChatSource[];
  tokens: AsyncGenerator<string>;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
    private readonly notes: NotesService,
    private readonly memory: MemoryService,
    private readonly llm: OpenRouterService,
  ) {}

  /**
   * Runs the full RAG flow: embed the question, retrieve the most similar
   * chunks and earlier memories with pgvector, build the prompt, and stream
   * the completion. The exchange is saved and turned into memory afterwards.
   */
  async ask(
    noteId: string,
    message: string,
    history: ChatHistoryMessage[],
    conversationId?: string,
  ): Promise<ChatStream> {
    this.llm.assertConfigured();
    const note = await this.notes.findOne(noteId);
    const conversation = await this.memory.ensureConversation(noteId, conversationId);

    const questionVector = await this.embeddings.embedOne(message);
    const [chunks, memories] = await Promise.all([
      this.retrieveChunks(noteId, questionVector),
      this.memory.findRelevantMemories(noteId, questionVector, conversation),
    ]);
    await this.memory.addMessage(conversation, 'user', message);
    await this.memory.recordRagQuery(noteId, conversation, message, chunks);

    const messages = buildRagMessages(message, note, chunks, history, memories);

    return {
      conversationId: conversation,
      sources: chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.similarity,
      })),
      tokens: this.saveAnswer(conversation, this.llm.stream(messages)),
    };
  }

  /** Passes the tokens through, then stores the full answer and refreshes the memory. */
  private async *saveAnswer(conversationId: string, tokens: AsyncGenerator<string>): AsyncGenerator<string> {
    let answer = '';
    for await (const token of tokens) {
      answer += token;
      yield token;
    }
    if (answer.trim()) {
      await this.memory.addMessage(conversationId, 'assistant', answer);
      this.memory.scheduleUpdate(conversationId);
    }
  }

  private async retrieveChunks(noteId: string, questionVector: number[]): Promise<RetrievedChunk[]> {
    const distance = cosineDistance(noteChunks.embedding, questionVector);
    const rows = await this.db
      .select({
        id: noteChunks.id,
        content: noteChunks.content,
        similarity: sql<number>`1 - (${distance})`.mapWith(Number),
      })
      .from(noteChunks)
      .where(eq(noteChunks.noteId, noteId))
      .orderBy(distance)
      .limit(TOP_K);
    return rows;
  }
}
