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

interface EmbeddedChunk {
  content: string;
  embedding: number[];
}

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
    const chunks = await this.embedText(input.title, input.content);
    const noteId = await this.db.transaction(async (tx) => {
      const [note] = await tx
        .insert(notes)
        .values({ title: input.title, type: input.type, content: input.content })
        .returning({ id: notes.id });
      await this.saveChunks(tx, note.id, chunks);
      return note.id;
    });
    return this.findOne(noteId);
  }

  /** Adiciona uma nova anotação a uma nota existente e a indexa. */
  async addEntry(noteId: string, content: string): Promise<NoteRecord> {
    const note = await this.findOne(noteId);
    const chunks = await this.embedText(note.title, content);

    await this.db.transaction(async (tx) => {
      await tx.insert(noteEntries).values({ noteId, content });
      await this.saveChunks(tx, noteId, chunks);
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

  /**
   * Divide o texto em chunks e gera os embeddings. Roda fora da transação para
   * não segurar uma conexão do banco enquanto o modelo calcula os vetores.
   */
  private async embedText(title: string, text: string): Promise<EmbeddedChunk[]> {
    // O título entra junto com o corpo para que perguntas que o mencionam também encontrem o trecho.
    const chunks = chunkPages([`${title}\n${text}`]);
    this.logger.log(`Embedding ${chunks.length} chunks for note "${title}"`);
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.content));
    return chunks.map((chunk, i) => ({ content: chunk.content, embedding: vectors[i] }));
  }

  /** Salva os chunks já com embeddings na nota. */
  private async saveChunks(executor: Executor, noteId: string, chunks: EmbeddedChunk[]) {
    if (chunks.length === 0) {
      return;
    }
    await executor.insert(noteChunks).values(chunks.map((chunk) => ({ noteId, ...chunk })));
  }
}
