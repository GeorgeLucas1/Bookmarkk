/**
 * Initialization SQL applied on API startup.
 *
 * Enables the pgvector extension and creates the tables that store notes
 * and their embedded chunks for the RAG pipeline. Statements are idempotent so repeated startups are safe.
 * The embedding dimension (384) matches the Xenova/all-MiniLM-L6-v2 model.
 */
export const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS note_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_entries_note_id ON note_entries(note_id);

CREATE TABLE IF NOT EXISTS note_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_chunks_note_id ON note_chunks(note_id);
`;
