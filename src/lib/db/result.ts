/** Result + error shapes shared by both data backends. */

export interface DataError {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
}

export interface DataResult<T> {
  data: T | null;
  error: DataError | null;
  count: number | null;
}

export function dbOk<T>(data: T, count: number | null = null): DataResult<T> {
  return { data, error: null, count };
}

export function dbFail<T>(message: string, code: string | null = null): DataResult<T> {
  return { data: null, error: { message, code, details: null, hint: null }, count: null };
}

/** Normalises any thrown value (Postgres, PostgREST, fetch, …) into DataError. */
export function toDataError(error: unknown): DataError {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      code?: string;
      detail?: string;
      details?: string;
      hint?: string;
    };
    return {
      message: candidate.message || "The database request failed.",
      code: candidate.code ?? null,
      details: candidate.detail ?? candidate.details ?? null,
      hint: candidate.hint ?? null,
    };
  }
  return {
    message: error instanceof Error ? error.message : "The database request failed.",
    code: null,
    details: null,
    hint: null,
  };
}

/** Throws a readable Error when a result carries a database error. */
export function unwrap<T>(result: DataResult<T>): T {
  if (result.error) {
    const error = new Error(result.error.message);
    (error as Error & { code?: string | null }).code = result.error.code;
    throw error;
  }
  return result.data as T;
}
