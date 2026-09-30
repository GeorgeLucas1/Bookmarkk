/** Categories a note can belong to. Labels are translated on the frontend. */
export const NOTE_TYPES = [
  'game_story',
  'study',
  'book',
  'movie_series',
  'work',
  'personal',
  'other',
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

/** Human-readable names used when describing a note to the model. */
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  game_story: 'game story',
  study: 'study',
  book: 'book',
  movie_series: 'movie or series',
  work: 'work',
  personal: 'personal',
  other: 'other',
};

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && (NOTE_TYPES as readonly string[]).includes(value);
}
