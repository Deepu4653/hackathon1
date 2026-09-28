/**
 * A PostgREST-flavoured query builder backed by real PostgreSQL (PGlite).
 *
 * Every execution opens a transaction, switches into the caller's role and
 * replays the JWT claims, so Row Level Security applies to the statement itself
 * — a bug in application code cannot read another user's rows.
 *
 * All values are passed as bind parameters. Identifiers are validated against a
 * strict pattern and quoted, so neither path is injectable.
 */

import type { DataClient, FilterBuilder, OrderOptions, SelectOptions, TextSearchOptions } from "../client";
import type { DataResult } from "../result";
import { toDataError } from "../result";
import { withAuthContext } from "./engine";
import type { AuthContext } from "./auth-context";

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TABLE = /^[a-z_][a-z0-9_]*$/;

type Sql = { text: string; params: unknown[] };

type Filter =
  | { kind: "cmp"; column: string; op: "=" | "<>" | ">" | ">=" | "<" | "<="; value: unknown }
  | { kind: "in"; column: string; values: readonly unknown[] }
  | { kind: "null"; column: string; negated: boolean }
  | { kind: "bool"; column: string; value: boolean; negated?: boolean }
  | { kind: "like"; column: string; pattern: string; caseInsensitive: boolean }
  | { kind: "fts"; column: string; query: string; type: "plain" | "phrase" | "websearch"; config: string };

function quoteIdent(name: string, what: "table" | "column"): string {
  const pattern = what === "table" ? TABLE : IDENTIFIER;
  if (!pattern.test(name)) {
    throw new Error(`Unsafe ${what} identifier: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

function parseProjection(columns?: string): string[] | "*" {
  if (!columns || columns.trim() === "" || columns.trim() === "*") return "*";
  const parts = columns.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (part === "*") continue;
    if (!IDENTIFIER.test(part)) {
      throw new Error(
        `Local backend supports simple column projections only (received "${part}"). ` +
          `Relation embedding and computed columns are Supabase-only features and must not be used in repositories.`,
      );
    }
  }
  return parts;
}

export class LocalFilterBuilder<TRow> implements FilterBuilder<TRow> {
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private projection: string[] | "*" | undefined;
  private countMode: "exact" | "planned" | null = null;
  private headOnly = false;
  private maxRows: number | null = null;
  private offset = 0;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private mode: "many" | "single" | "maybeSingle" = "many";

  constructor(
    private readonly table: string,
    private readonly context: AuthContext,
  ) {
    quoteIdent(table, "table");
  }

  // ---- builders ----------------------------------------------------------

  select(columns?: string, options?: SelectOptions): this {
    if (this.action === "select") {
      this.projection = parseProjection(columns);
    } else if (columns !== undefined) {
      this.projection = parseProjection(columns);
    }
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.action = "insert";
    this.payload = values;
    if (!this.projection) this.projection = "*";
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.action = "update";
    this.payload = values;
    if (!this.projection) this.projection = "*";
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): this {
    this.action = "upsert";
    this.payload = values;
    this.upsertOptions = options ?? {};
    if (!this.projection) this.projection = "*";
    return this;
  }

  delete(): this {
    this.action = "delete";
    this.projection = "*";
    return this;
  }

  // ---- filters -----------------------------------------------------------

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "=", value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<>", value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: ">", value });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: ">=", value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<", value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.filters.push({ kind: "cmp", column, op: "<=", value });
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.filters.push({ kind: "in", column, values });
    return this;
  }
  is(column: string, value: null | boolean): this {
    if (value === null) this.filters.push({ kind: "null", column, negated: false });
    else this.filters.push({ kind: "bool", column, value });
    return this;
  }
  not(column: string, operator: "is" | "eq" | "neq", value: null | boolean | string | number): this {
    if (operator === "is") {
      if (value === null) this.filters.push({ kind: "null", column, negated: true });
      else this.filters.push({ kind: "bool", column, value: !value, negated: true });
      return this;
    }
    this.filters.push({ kind: "cmp", column, op: operator === "eq" ? "<>" : "=", value });
    return this;
  }
  like(column: string, pattern: string): this {
    this.filters.push({ kind: "like", column, pattern, caseInsensitive: false });
    return this;
  }
  ilike(column: string, pattern: string): this {
    this.filters.push({ kind: "like", column, pattern, caseInsensitive: true });
    return this;
  }
  textSearch(column: string, query: string, options?: TextSearchOptions): this {
    this.filters.push({
      kind: "fts",
      column,
      query,
      type: options?.type ?? "websearch",
      config: options?.config ?? "simple",
    });
    return this;
  }

  order(column: string, options?: OrderOptions): this {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this.maxRows = Math.max(0, Math.min(count, 1000));
    return this;
  }

  range(from: number, to: number): this {
    this.offset = Math.max(0, from);
    this.maxRows = Math.max(0, to - from + 1);
    return this;
  }

  single(): PromiseLike<DataResult<TRow>> {
    this.mode = "single";
    return this.execute() as unknown as PromiseLike<DataResult<TRow>>;
  }

  maybeSingle(): PromiseLike<DataResult<TRow>> {
    this.mode = "maybeSingle";
    return this.execute() as unknown as PromiseLike<DataResult<TRow>>;
  }

  // ---- execution ---------------------------------------------------------

  private buildWhere(params: unknown[]): string {
    const clauses: string[] = [];
    for (const filter of this.filters) {
      if (filter.kind === "cmp") {
        clauses.push(`${quoteIdent(filter.column, "column")} ${filter.op} $${params.push(filter.value)}`);
      } else if (filter.kind === "in") {
        if (filter.values.length === 0) {
          clauses.push("false");
          continue;
        }
        const placeholders = filter.values.map((value) => `$${params.push(value)}`);
        clauses.push(`${quoteIdent(filter.column, "column")} in (${placeholders.join(", ")})`);
      } else if (filter.kind === "null") {
        clauses.push(`${quoteIdent(filter.column, "column")} is ${filter.negated ? "not " : ""}null`);
      } else if (filter.kind === "bool") {
        clauses.push(`${quoteIdent(filter.column, "column")} is ${filter.negated ? "not " : ""}${filter.value ? "true" : "false"}`);
      } else if (filter.kind === "like") {
        const op = filter.caseInsensitive ? "ilike" : "like";
        clauses.push(`${quoteIdent(filter.column, "column")} ${op} $${params.push(filter.pattern)}`);
      } else {
        const fn =
          filter.type === "plain"
            ? "plainto_tsquery"
            : filter.type === "phrase"
              ? "phraseto_tsquery"
              : "websearch_to_tsquery";
        clauses.push(
          `${quoteIdent(filter.column, "column")} @@ ${fn}('${filter.config.replace(/'/g, "")}', $${params.push(filter.query)})`,
        );
      }
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }

  private buildOrdering(): string {
    if (this.orders.length === 0) return "";
    const parts = this.orders.map((order) => {
      const direction = order.ascending ? "asc" : "desc";
      const nulls =
        order.nullsFirst === undefined ? "" : order.nullsFirst ? " nulls first" : " nulls last";
      return `${quoteIdent(order.column, "column")} ${direction}${nulls}`;
    });
    return ` order by ${parts.join(", ")}`;
  }

  private buildStatement(): { main: Sql; count: Sql | null } {
    const params: unknown[] = [];
    const table = quoteIdent(this.table, "table");
    const projection = this.projection ?? "*";
    const returning = projection === "*" ? "*" : projection.map((c) => quoteIdent(c, "column")).join(", ");
    const statements: Sql[] = [];
    const wantsReturning = this.action !== "select" && !this.headOnly;

    if (this.action === "select") {
      const where = this.buildWhere(params);
      const columns = projection === "*" ? "*" : projection.map((c) => quoteIdent(c, "column")).join(", ");
      let text = `select ${columns} from ${table}${where}${this.buildOrdering()}`;
      if (this.maxRows !== null) text += ` limit ${this.maxRows}`;
      if (this.offset) text += ` offset ${this.offset}`;
      statements.push({ text, params: [...params] });
    } else if (this.action === "insert" || this.action === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      if (rows.length === 0) throw new Error("No rows supplied for insert.");
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      if (columns.length === 0) throw new Error("No values supplied for insert.");
      const valuesSql = rows
        .map(
          (row) =>
            `(${columns
              .map((column) => (column in row ? `$${params.push(row[column])}` : "default"))
              .join(", ")})`,
        )
        .join(", ");
      let text = `insert into ${table} (${columns
        .map((column) => quoteIdent(column, "column"))
        .join(", ")}) values ${valuesSql}`;
      if (this.action === "upsert") {
        const conflict = this.upsertOptions.onConflict;
        const conflictColumns = conflict
          ? conflict.split(",").map((column) => quoteIdent(column.trim(), "column")).join(", ")
          : null;
        if (this.upsertOptions.ignoreDuplicates) {
          text += conflictColumns ? ` on conflict (${conflictColumns}) do nothing` : " on conflict do nothing";
        } else {
          const updates = columns
            .map((column) => `${quoteIdent(column, "column")} = excluded.${quoteIdent(column, "column")}`)
            .join(", ");
          text += conflictColumns
            ? ` on conflict (${conflictColumns}) do update set ${updates}`
            : ` on conflict do update set ${updates}`;
        }
      }
      if (wantsReturning) text += ` returning ${returning}`;
      statements.push({ text, params: [...params] });
    } else if (this.action === "update") {
      const row = this.payload as Record<string, unknown> | null;
      const columns = Object.keys(row ?? {});
      if (columns.length === 0) throw new Error("No values supplied for update.");
      const sets = columns
        .map((column) => `${quoteIdent(column, "column")} = $${params.push((row as Record<string, unknown>)[column])}`)
        .join(", ");
      const where = this.buildWhere(params);
      if (!where) throw new Error("Refusing to run an update without a filter (RLS-safe guard).");
      let text = `update ${table} set ${sets}${where}`;
      if (wantsReturning) text += ` returning ${returning}`;
      statements.push({ text, params: [...params] });
    } else {
      const where = this.buildWhere(params);
      if (!where) throw new Error("Refusing to run a delete without a filter (RLS-safe guard).");
      let text = `delete from ${table}${where}`;
      if (wantsReturning) text += ` returning ${returning}`;
      statements.push({ text, params: [...params] });
    }

    // Exact count for the same predicate (used by pagination + admin stats).
    let count: Sql | null = null;
    if (this.countMode === "exact" && this.action === "select") {
      const countParams: unknown[] = [];
      const where = this.buildWhere(countParams);
      count = { text: `select count(*)::int as count from ${table}${where}`, params: countParams };
    }

    return { main: statements[0], count };
  }

  private async execute(): Promise<DataResult<TRow[]>> {
    try {
      const { main, count: countQuery } = this.buildStatement();
      return await withAuthContext(this.context, async (db) => {
        let count: number | null = null;
        if (countQuery) {
          const countResult = await db.query<{ count: number }>(countQuery.text, countQuery.params);
          count = countResult.rows[0]?.count ?? 0;
        }
        if (this.headOnly && this.action === "select") {
          return { data: [] as TRow[], error: null, count } satisfies DataResult<TRow[]>;
        }

        const result = await db.query<Record<string, unknown>>(main.text, main.params);
        const rows = result.rows as TRow[];

        if (this.mode === "many") {
          return { data: rows, error: null, count } satisfies DataResult<TRow[]>;
        }
        if (rows.length === 0) {
          if (this.mode === "maybeSingle") return { data: null, error: null, count };
          return {
            data: null,
            error: {
              message: "No rows found (expected exactly one).",
              code: "PGRST116",
              details: null,
              hint: null,
            },
            count,
          };
        }
        if (rows.length > 1) {
          return {
            data: null,
            error: {
              message: `More than one row returned by a query that expected a single row (${rows.length}).`,
              code: "PGRST116",
              details: null,
              hint: null,
            },
            count,
          };
        }
        return { data: rows[0] as unknown as TRow[], error: null, count };
      });
    } catch (error) {
      return { data: null, error: toDataError(error), count: null };
    }
  }

  then<TResult1 = DataResult<TRow[]>, TResult2 = never>(
    onfulfilled?: ((value: DataResult<TRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function createLocalDataClient(context: AuthContext): DataClient {
  return {
    backend: "local",
    from<TRow>(table: string) {
      return new LocalFilterBuilder<TRow>(table, context);
    },
    async rpc<T>(fn: string, params: Record<string, unknown> = {}) {
      try {
        if (!TABLE.test(fn)) throw new Error(`Unsafe function name: ${fn}`);
        const keys = Object.keys(params);
        const args = keys.map((key, index) => {
          if (!IDENTIFIER.test(key)) throw new Error(`Unsafe argument name: ${key}`);
          return `${key} := $${index + 1}`;
        });
        const sql = `select * from public.${fn}(${args.join(", ")})`;
        return await withAuthContext(context, async (db) => {
          const result = await db.query<T>(sql, keys.map((key) => params[key]));
          return { data: (result.rows[0] ?? null) as T | null, error: null, count: null };
        });
      } catch (error) {
        return { data: null, error: toDataError(error), count: null };
      }
    },
  };
}
