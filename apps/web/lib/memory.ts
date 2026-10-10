import type { NoteType } from './api';

// Shapes the memory pop-up renders. There is no API for this yet, so the
// pop-up shows the sample data below until the backend provides it.

export interface ConversationMemory {
  id: string;
  noteTitle: string;
  noteType: NoteType;
  summary: string;
  messageCount: number;
  createdAt: string;
}

export type GraphNodeKind =
  | 'character'
  | 'place'
  | 'item'
  | 'event'
  | 'concept'
  // RAG graph: a question, the chunks retrieved for it and the notes they came from.
  | 'query'
  | 'chunk'
  | 'note';

/** Graphs the "conversation graphs" tab can show; add new ones here. */
export type GraphView = 'entities' | 'rag';

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const GRAPH_NODE_COLORS: Record<GraphNodeKind, string> = {
  character: '#6366f1',
  place: '#10b981',
  item: '#f59e0b',
  event: '#ef4444',
  concept: '#0ea5e9',
  query: '#a855f7',
  chunk: '#64748b',
  note: '#14b8a6',
};

export const SAMPLE_CONVERSATIONS: ConversationMemory[] = [
  {
    id: 'c1',
    noteTitle: 'Elden Ring',
    noteType: 'game_story',
    summary:
      'Discutimos a ligação entre Ranni e a Noite das Facas Negras. Ficou em aberto quem forneceu as facas aos assassinos.',
    messageCount: 12,
    createdAt: '2026-10-09T21:14:00Z',
  },
  {
    id: 'c2',
    noteTitle: 'Duna',
    noteType: 'book',
    summary:
      'Revisamos as visões de Paul e como elas se relacionam com a especiaria. Você suspeita que Jessica sabe mais do que conta.',
    messageCount: 8,
    createdAt: '2026-10-07T18:40:00Z',
  },
  {
    id: 'c3',
    noteTitle: 'Cálculo 1',
    noteType: 'study',
    summary:
      'Explicamos derivada como taxa de variação instantânea. Faltou um exemplo da regra da cadeia nas suas anotações.',
    messageCount: 5,
    createdAt: '2026-10-03T14:05:00Z',
  },
];

export const SAMPLE_GRAPH: MemoryGraph = {
  nodes: [
    { id: 'ranni', label: 'Ranni', kind: 'character' },
    { id: 'godwyn', label: 'Godwyn', kind: 'character' },
    { id: 'blaidd', label: 'Blaidd', kind: 'character' },
    { id: 'night', label: 'Noite das Facas', kind: 'event' },
    { id: 'knives', label: 'Facas Negras', kind: 'item' },
    { id: 'tower', label: 'Torre de Ranni', kind: 'place' },
    { id: 'order', label: 'Ordem Dourada', kind: 'concept' },
  ],
  edges: [
    { from: 'ranni', to: 'night', label: 'planejou?' },
    { from: 'night', to: 'godwyn', label: 'matou' },
    { from: 'night', to: 'knives', label: 'usou' },
    { from: 'ranni', to: 'blaidd', label: 'aliado' },
    { from: 'ranni', to: 'tower', label: 'vive em' },
    { from: 'godwyn', to: 'order', label: 'parte de' },
  ],
};

export const SAMPLE_RAG_GRAPH: MemoryGraph = {
  nodes: [
    { id: 'q', label: 'Quem deu as facas?', kind: 'query' },
    { id: 'k1', label: 'Trecho #12', kind: 'chunk' },
    { id: 'k2', label: 'Trecho #31', kind: 'chunk' },
    { id: 'k3', label: 'Trecho #7', kind: 'chunk' },
    { id: 'n1', label: 'Elden Ring', kind: 'note' },
    { id: 'n2', label: 'Lore: Ranni', kind: 'note' },
  ],
  edges: [
    { from: 'q', to: 'k1', label: '92%' },
    { from: 'q', to: 'k2', label: '87%' },
    { from: 'q', to: 'k3', label: '74%' },
    { from: 'k1', to: 'n1', label: 'de' },
    { from: 'k2', to: 'n1', label: 'de' },
    { from: 'k3', to: 'n2', label: 'de' },
  ],
};

export const SAMPLE_GRAPHS: Record<GraphView, MemoryGraph> = {
  entities: SAMPLE_GRAPH,
  rag: SAMPLE_RAG_GRAPH,
};
