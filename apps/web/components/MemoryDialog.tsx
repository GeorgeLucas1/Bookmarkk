'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import {
  GRAPH_NODE_COLORS,
  GraphNodeKind,
  GraphView as GraphViewName,
  MemoryGraph,
  SAMPLE_CONVERSATIONS,
  SAMPLE_GRAPHS,
} from '../lib/memory';
import { NOTE_TYPE_COLORS, NoteTypeIcon } from './NoteTypeIcon';

export function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

type Tab = 'conversations' | 'graph';

interface MemoryDialogProps {
  onClose: () => void;
}

/** Pop-up with the memories built from past conversations and the entity graph. */
export function MemoryDialog({ onClose }: MemoryDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('conversations');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs: { value: Tab; label: string }[] = [
    { value: 'conversations', label: t.memoryConversations },
    { value: 'graph', label: t.memoryGraph },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-dialog-title"
        className="animate-dialog-in flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="h-1.5 bg-accent" />

        <div className="flex items-center gap-3 px-6 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent dark:bg-zinc-800 dark:text-indigo-400">
            <BrainIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="memory-dialog-title" className="text-sm font-semibold">
              {t.memory}
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.memorySample}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeDialog}
            className="rounded-lg p-1 text-2xl leading-none text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            &times;
          </button>
        </div>

        <div role="tablist" className="mx-6 mt-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {tabs.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === value
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="min-h-0 overflow-y-auto px-6 py-5">
          {tab === 'conversations' ? <ConversationList /> : <GraphTab />}
        </div>
      </div>
    </div>
  );
}

function ConversationList() {
  const { t, language } = useI18n();

  return (
    <ul className="space-y-3">
      {SAMPLE_CONVERSATIONS.map((memory) => {
        const color = NOTE_TYPE_COLORS[memory.noteType];
        return (
          <li
            key={memory.id}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}22`, color }}
              >
                <NoteTypeIcon type={memory.noteType} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{memory.noteTitle}</span>
              <time dateTime={memory.createdAt} className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {new Date(memory.createdAt).toLocaleDateString(language)}
              </time>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{memory.summary}</p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{t.messagesCount(memory.messageCount)}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** Switches between the available graphs (entities, RAG, ...). */
function GraphTab() {
  const { t } = useI18n();
  const [view, setView] = useState<GraphViewName>('entities');
  const views = Object.keys(SAMPLE_GRAPHS) as GraphViewName[];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {views.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              view === value
                ? 'border-accent bg-accent-soft text-accent dark:border-indigo-400 dark:bg-zinc-800 dark:text-indigo-400'
                : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {t.graphViews[value]}
          </button>
        ))}
      </div>
      {/* key resets the selected node when switching graphs */}
      <GraphView key={view} graph={SAMPLE_GRAPHS[view]} />
    </div>
  );
}

const WIDTH = 560;
const HEIGHT = 340;

type Positions = Record<string, { x: number; y: number }>;

/**
 * Radial tree layout: the most connected node sits in the centre and every
 * other node is placed one ring further out than the node it was reached
 * from, inside an angular slice sized by how many leaves hang below it.
 * Connected nodes end up next to each other, so edges rarely cross.
 */
function layoutGraph(graph: MemoryGraph): Positions {
  const degree = (id: string) => graph.edges.filter((e) => e.from === id || e.to === id).length;
  const [hub] = [...graph.nodes].sort((a, b) => degree(b.id) - degree(a.id));
  if (!hub) return {};

  const children: Record<string, string[]> = { [hub.id]: [] };
  const depth: Record<string, number> = { [hub.id]: 0 };
  const queue = [hub.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const edge of graph.edges) {
      const next = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
      if (next === null || next in depth) continue;
      depth[next] = depth[id] + 1;
      children[id].push(next);
      children[next] = [];
      queue.push(next);
    }
  }
  // Nodes with no path to the hub still get a spot on the first ring.
  for (const node of graph.nodes) {
    if (node.id in depth) continue;
    depth[node.id] = 1;
    children[hub.id].push(node.id);
    children[node.id] = [];
  }

  const leaves = (id: string): number =>
    children[id].length === 0 ? 1 : children[id].reduce((sum, child) => sum + leaves(child), 0);
  const maxDepth = Math.max(1, ...Object.values(depth));
  const ringX = (WIDTH / 2 - 70) / maxDepth;
  const ringY = (HEIGHT / 2 - 40) / maxDepth;

  const result: Positions = {};
  const place = (id: string, start: number, end: number) => {
    const angle = (start + end) / 2;
    result[id] = {
      x: WIDTH / 2 + Math.cos(angle) * ringX * depth[id],
      y: HEIGHT / 2 + Math.sin(angle) * ringY * depth[id],
    };
    let cursor = start;
    for (const child of children[id]) {
      const span = ((end - start) * leaves(child)) / leaves(id);
      place(child, cursor, cursor + span);
      cursor += span;
    }
  };
  place(hub.id, -Math.PI / 2, (3 * Math.PI) / 2);
  return result;
}

function GraphView({ graph }: { graph: MemoryGraph }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positions = useMemo(() => layoutGraph(graph), [graph]);

  const isLinked = (edge: { from: string; to: string }) =>
    selectedId === null || edge.from === selectedId || edge.to === selectedId;
  const linkedIds = new Set(
    graph.edges.filter((e) => selectedId !== null && isLinked(e)).flatMap((e) => [e.from, e.to]),
  );
  const isActive = (id: string) => selectedId === null || id === selectedId || linkedIds.has(id);

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const kinds = [...new Set(graph.nodes.map((n) => n.kind))];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{t.graphHint}</p>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
        onClick={() => setSelectedId(null)}
      >
        {graph.edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const active = isLinked(edge);
          return (
            <g key={`${edge.from}-${edge.to}`} className="transition-opacity" opacity={active ? 1 : 0.15}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-zinc-300 dark:stroke-zinc-700"
                strokeWidth={1.5}
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 4}
                textAnchor="middle"
                className="fill-zinc-400 text-[10px] dark:fill-zinc-500"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const color = GRAPH_NODE_COLORS[node.kind];
          const isSelected = node.id === selectedId;
          return (
            <g
              key={node.id}
              transform={`translate(${pos.x} ${pos.y})`}
              className="cursor-pointer transition-opacity"
              opacity={isActive(node.id) ? 1 : 0.25}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(isSelected ? null : node.id);
              }}
            >
              <circle r={isSelected ? 13 : 10} fill={color} stroke={isSelected ? color : 'none'} strokeOpacity={0.3} strokeWidth={8} />
              <text y={26} textAnchor="middle" className="fill-zinc-700 text-[11px] font-medium dark:fill-zinc-200">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-3">
        {kinds.map((kind) => (
          <span key={kind} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GRAPH_NODE_COLORS[kind] }} />
            {t.graphNodeKinds[kind]}
          </span>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {t.connectionsOf(selected.label)}
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {graph.edges
              .filter((e) => e.from === selected.id || e.to === selected.id)
              .map((e) => (
                <li key={`${e.from}-${e.to}`}>
                  <span className="font-medium">{labelOf(e.from)}</span>{' '}
                  <span className="text-zinc-400 dark:text-zinc-500">{e.label}</span>{' '}
                  <span className="font-medium">{labelOf(e.to)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
