"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type HistoryKind = "trace" | "audit";

export interface HistoryEntry {
  kind: HistoryKind;
  key: string;
  params: Record<string, string | undefined>;
  title: string;
  subtitle?: string;
  badge?: string;
  ts: number;
}

const STORE_KEY = "origin-trace:history:v1";
const CAP = 24;

const EMPTY: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let cache: HistoryEntry[] | null = null;

function readRaw(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): HistoryEntry[] {
  if (cache === null) cache = readRaw();
  return cache;
}

function commit(entries: HistoryEntry[]): void {
  cache = entries;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(entries));
    } catch {
      //
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function record(entry: Omit<HistoryEntry, "ts">): void {
  const rest = getSnapshot().filter((e) => e.key !== entry.key);
  commit([{ ...entry, ts: Date.now() }, ...rest].slice(0, CAP));
}

function drop(key: string): void {
  commit(getSnapshot().filter((e) => e.key !== key));
}

function purge(kind: HistoryKind): void {
  commit(getSnapshot().filter((e) => e.kind !== kind));
}

export function useHistory(kind: HistoryKind) {
  const all = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const items = useMemo(() => all.filter((e) => e.kind === kind), [all, kind]);

  const remember = useCallback(
    (entry: Omit<HistoryEntry, "ts" | "kind">) => record({ ...entry, kind }),
    [kind],
  );
  const forget = useCallback((key: string) => drop(key), []);
  const clear = useCallback(() => purge(kind), [kind]);

  return { items, remember, forget, clear };
}
