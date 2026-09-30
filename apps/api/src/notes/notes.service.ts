import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { toSqlVector } from '../shared/vector';
import { chunkPages } from './chunking';
import { NoteType } from './note-types';

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  title: string;
  type: NoteType;
  /** Text written when the note was created. */
  content: string;
  /** Annotations added to the note afterwards, oldest first. */
  entries: NoteEntry[];
  createdAt: string;
}

export interface CreateNoteInput {
  title: string;
  type: NoteType;
  content: string;
}

interface NoteRow {
  id: string;
  title: string;
  type: NoteType;
  content: string;
  created_at: string;
  entries: NoteEntry[];
}

const SELECT_NOTES = `
  SELECT n.id, n.title, n.type, n.content, n.created_at,
    COALESCE(
      json_agg(
        json_build_object('id', e.id, 'content', e.content, 'createdAt', e.created_at)
        ORDER BY e.created_at
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'
    ) AS entries
  FROM notes n
  LEFT JOIN note_entries e ON e.note_id = n.id`;

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly embeddings: EmbeddingsService,
  ) {}

  /** Saves a note and indexes its text as embedded chunks for chat retrieval. */
  async create(input: CreateNoteInput): Promise<NoteRecord> {
    let noteId: string;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const noteResult = await client.query<{ id: string }>(
        'INSERT INTO notes (title, type, content) VALUES ($1, $2, $3) RETURNING id',
        [input.title, input.type, input.content],
      );
      noteId = noteResult.rows[0].id;
      await this.indexText(client, noteId, input.title, input.content);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findOne(noteId);
  }

  /** Appends a new annotation to an existing note and indexes it. */
  async addEntry(noteId: string, content: string): Promise<NoteRecord> {
    const note = await this.findOne(noteId);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO note_entries (note_id, content) VALUES ($1, $2)', [
        noteId,
        content,
      ]);
      await this.indexText(client, noteId, note.title, content);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findOne(noteId);
  }

  async findAll(): Promise<NoteRecord[]> {
    const result = await this.pool.query<NoteRow>(
      `${SELECT_NOTES} GROUP BY n.id ORDER BY n.created_at DESC`,
    );
    return result.rows.map(toRecord);
  }

  async findOne(id: string): Promise<NoteRecord> {
    const result = await this.pool.query<NoteRow>(`${SELECT_NOTES} WHERE n.id = $1 GROUP BY n.id`, [
      id,
    ]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Note ${id} was not found`);
    }
    return toRecord(result.rows[0]);
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM notes WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Note ${id} was not found`);
    }
  }

  /** Chunks and embeds text, storing the chunks under the note. */
  private async indexText(client: PoolClient, noteId: string, title: string, text: string) {
    // The title is embedded with the body so questions that mention it still match.
    const chunks = chunkPages([`${title}\n${text}`]);
    this.logger.log(`Embedding ${chunks.length} chunks for note "${title}"`);
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.content));

    for (let i = 0; i < chunks.length; i += 1) {
      await client.query(
        'INSERT INTO note_chunks (note_id, content, embedding) VALUES ($1, $2, $3::vector)',
        [noteId, chunks[i].content, toSqlVector(vectors[i])],
      );
    }
  }
}

function toRecord(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    content: row.content,
    entries: row.entries,
    createdAt: row.created_at,
  };
}
