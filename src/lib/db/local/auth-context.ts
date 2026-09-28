export type AuthContextRole = "anon" | "authenticated" | "service_role" | "postgres";

/**
 * The security context a database statement runs under. It is derived from a
 * verified session only — never from client-supplied input.
 */
export interface AuthContext {
  role: AuthContextRole;
  userId: string | null;
  email: string | null;
}

export const anonContext: AuthContext = { role: "anon", userId: null, email: null };

export function userContext(userId: string, email: string | null = null): AuthContext {
  return { role: "authenticated", userId, email };
}

export const serviceContext: AuthContext = { role: "service_role", userId: null, email: null };

export const internalContext: AuthContext = { role: "postgres", userId: null, email: null };
