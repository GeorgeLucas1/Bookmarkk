import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { NoteType } from '../notes/note-types';

/**
 * Schema do Drizzle para as notas e os chunks com embeddings usados no pipeline de RAG.
 *
 * As tabelas e colunas no banco têm nomes em português; no código, os campos
 * continuam em inglês, que é o formato do JSON devolvido pela API.
 *
 * Depois de alterar este arquivo, rode `npm run db:generate` para criar uma migration,
 * que é aplicada automaticamente quando a API inicia.
 * A dimensão do embedding (384) corresponde ao modelo Xenova/all-MiniLM-L6-v2.
 */
export const notes = pgTable('notas', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('titulo').notNull(),
  type: text('tipo').$type<NoteType>().notNull(),
  content: text('conteudo').notNull(),
  createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const noteEntries = pgTable(
  'entradas_nota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    content: text('conteudo').notNull(),
    createdAt: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_entradas_nota_nota_id').on(table.noteId)],
);

export const noteChunks = pgTable(
  'trechos_nota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noteId: uuid('nota_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    content: text('conteudo').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
  },
  (table) => [index('idx_trechos_nota_nota_id').on(table.noteId)],
);

export const notesRelations = relations(notes, ({ many }) => ({
  entries: many(noteEntries),
  chunks: many(noteChunks),
}));

export const noteEntriesRelations = relations(noteEntries, ({ one }) => ({
  note: one(notes, { fields: [noteEntries.noteId], references: [notes.id] }),
}));

export const noteChunksRelations = relations(noteChunks, ({ one }) => ({
  note: one(notes, { fields: [noteChunks.noteId], references: [notes.id] }),
}));
