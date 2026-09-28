/**
 * The tiny data-access interface X-FARM AI writes its repositories against.
 *
 * It is a deliberate subset of the Supabase JS client API, which means:
 *   • in production the real `@supabase/supabase-js` client satisfies it, and
 *   • locally the PGlite-backed implementation satisfies it,
 * so repository code is written exactly once and behaves identically.
 *
 * Unsupported PostgREST features (embedded relation selects, `or()` string
 * filters, …) are intentionally out of scope: repositories use explicit queries
 * and the generated `search_document` tsvector for full-text search instead.
 */

import type { DataResult } from "./result";

export interface SelectOptions {
  count?: "exact" | "planned";
  head?: boolean;
}

export type OrderOptions = { ascending?: boolean; nullsFirst?: boolean };
export type TextSearchOptions = {
  type?: "plain" | "phrase" | "websearch";
  config?: string;
};

export interface FilterBuilder<TRow> extends PromiseLike<DataResult<TRow[]>> {
  select(columns?: string, options?: SelectOptions): FilterBuilder<TRow>;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): FilterBuilder<TRow>;
  update(values: Record<string, unknown>): FilterBuilder<TRow>;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): FilterBuilder<TRow>;
  delete(): FilterBuilder<TRow>;

  eq(column: string, value: unknown): FilterBuilder<TRow>;
  neq(column: string, value: unknown): FilterBuilder<TRow>;
  gt(column: string, value: unknown): FilterBuilder<TRow>;
  gte(column: string, value: unknown): FilterBuilder<TRow>;
  lt(column: string, value: unknown): FilterBuilder<TRow>;
  lte(column: string, value: unknown): FilterBuilder<TRow>;
  in(column: string, values: readonly unknown[]): FilterBuilder<TRow>;
  is(column: string, value: null | boolean): FilterBuilder<TRow>;
  not(column: string, operator: "is" | "eq" | "neq", value: null | boolean | string | number): FilterBuilder<TRow>;
  like(column: string, pattern: string): FilterBuilder<TRow>;
  ilike(column: string, pattern: string): FilterBuilder<TRow>;
  textSearch(column: string, query: string, options?: TextSearchOptions): FilterBuilder<TRow>;

  order(column: string, options?: OrderOptions): FilterBuilder<TRow>;
  limit(count: number): FilterBuilder<TRow>;
  range(from: number, to: number): FilterBuilder<TRow>;

  single(): PromiseLike<DataResult<TRow>>;
  maybeSingle(): PromiseLike<DataResult<TRow>>;
}

export interface DataClient {
  /** Which backend is serving this client (useful for diagnostics/UI copy). */
  readonly backend: "supabase" | "local";
  from<TRow>(table: string): FilterBuilder<TRow>;
  rpc<T>(fn: string, params?: Record<string, unknown>): PromiseLike<DataResult<T>>;
}

export const MAX_PAGE_SIZE = 100;
