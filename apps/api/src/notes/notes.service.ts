import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { noteChunks, noteEntries, notes } from '../database/schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { chunkPages } from './chunking';
import { NoteType } from './note-types';

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: Date;
}

export interface NoteRecord {
  id: string;
  title: string;
  type: NoteType;
  /** Texto escrito quando a nota foi criada. */
  content: string;
  /** Anotações adicionadas depois à nota, da mais antiga para a mais recente. */
  entries: NoteEntry[];
  createdAt: Date;
}

export interface CreateNoteInput {
  title: string;
  type: NoteType;
  content: string;
}

/** Carrega as entradas junto com a nota, da mais antiga para a mais recente. */
const WITH_ENTRIES = {
  entries: {
    columns: { id: true, content: true, createdAt: true },
    orderBy: asc(noteEntries.createdAt),
  },
} as const;

/** O banco ou uma transação aberta; os dois aceitam os mesmos inserts. */
type Executor = Pick<Database, 'insert'>;

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Salva uma nota e indexa o texto dela em chunks com embeddings para a busca do chat. */
  async create(input: CreateNoteInput): Promise<NoteRecord> {
    const noteId = await this.db.transaction(async (tx) => {
      const [note] = await tx
        .insert(notes)
        .values({ title: input.title, type: input.type, content: input.content })
        .returning({ id: notes.id });
      await this.indexText(tx, note.id, input.title, input.content);
      return note.id;
    });
    return this.findOne(noteId);
  }

  /** Adiciona uma nova anotação a uma nota existente e a indexa. */
  async addEntry(noteId: string, content: string): Promise<NoteRecord> {
    const note = await this.findOne(noteId);

    await this.db.transaction(async (tx) => {
      await tx.insert(noteEntries).values({ noteId, content });
      await this.indexText(tx, noteId, note.title, content);
    });
    return this.findOne(noteId);
  }

  async findAll(): Promise<NoteRecord[]> {
    return this.db.query.notes.findMany({
      with: WITH_ENTRIES,
      orderBy: [desc(notes.createdAt)],
    });
  }

  async findOne(id: string): Promise<NoteRecord> {
    const note = await this.db.query.notes.findFirst({
      where: eq(notes.id, id),
      with: WITH_ENTRIES,
    });
    if (!note) {
      throw new NotFoundException(`Note ${id} was not found`);
    }
    return note;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
    if (deleted.length === 0) {
      throw new NotFoundException(`Note ${id} was not found`);
    }
  }

  /** Divide o texto em chunks, gera os embeddings e salva os chunks na nota. */
  private async indexText(executor: Executor, noteId: string, title: string, text: string) {
    // O título entra junto com o corpo para que perguntas que o mencionam também encontrem o trecho.
    const chunks = chunkPages([`${title}\n${text}`]);
    this.logger.log(`Embedding ${chunks.length} chunks for note "${title}"`);
    if (chunks.length === 0) {
      return;
    }
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.content));

    await executor.insert(noteChunks).values(
      chunks.map((chunk, i) => ({ noteId, content: chunk.content, embedding: vectors[i] })),
    );
  }
}
