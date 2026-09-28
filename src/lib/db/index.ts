/**
 * Data-access entry point.
 *
 * Callers ask for a client and write ordinary repository code against it:
 *
 *   const db = await getDataClient();
 *   const { data } = await db.from<Farm>("farms").select("*").eq("user_id", id);
 *
 * In production that is PostgREST + Supabase RLS. Locally it is real PostgreSQL
 * (PGlite) with the same migrations and the same RLS policies. No repository
 * contains an `if (local) … else …` branch.
 */

import { dataBackend } from "@/lib/env";
import { getLocalAuthContext } from "@/lib/auth/context";
import type { DataClient } from "./client";
import { createLocalDataClient } from "./local/query";
import { getCurrentAuthContext } from "./local/engine";
import { serviceContext } from "./local/auth-context";
import { createSupabaseDataClient } from "@/lib/supabase/server";
import { createSupabaseAdminDataClient } from "@/lib/supabase/admin";

export type { DataClient, FilterBuilder } from "./client";
export { MAX_PAGE_SIZE } from "./client";
export type { DataError, DataResult } from "./result";
export { toDataError, unwrap } from "./result";

/** Client scoped to the current signed-in user (RLS enforced either way). */
export async function getDataClient(): Promise<DataClient> {
  if (dataBackend() === "supabase") {
    return createSupabaseDataClient();
  }
  // Inside `withAuthContext(...)` the explicit context wins; otherwise the
  // request's session cookie decides (RLS is what actually enforces access).
  const context = getCurrentAuthContext() ?? (await getLocalAuthContext());
  return createLocalDataClient(context);
}

/**
 * Client that bypasses RLS. Server-only and used only for audited privileged
 * operations (admin bootstrap, moderation, imports). Throws when unavailable so
 * a missing service-role key becomes a clear error instead of a silent one.
 */
export async function getServiceDataClient(): Promise<DataClient> {
  if (dataBackend() === "supabase") {
    const client = createSupabaseAdminDataClient();
    if (!client) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured. This operation needs the service-role key (server-side only).",
      );
    }
    return client;
  }
  return createLocalDataClient(serviceContext);
}

/** Same as getServiceDataClient but returns null instead of throwing. */
export async function tryGetServiceDataClient(): Promise<DataClient | null> {
  try {
    return await getServiceDataClient();
  } catch {
    return null;
  }
}

export async function logAuditEvent(event: {
  action: string;
  entity?: string;
  entityId?: string | null;
  actorId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDataClient();
    await db.from("audit_logs").insert({
      actor_id: event.actorId ?? null,
      action: event.action,
      entity: event.entity ?? null,
      entity_id: event.entityId ?? null,
      meta: event.meta ?? {},
    });
  } catch {
    // Audit logging must never break the user-facing operation.
  }
}
