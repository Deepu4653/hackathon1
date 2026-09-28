import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getDataClient } from "@/lib/db";
import { isLocale } from "@/lib/i18n/config";

/**
 * Persists display preferences (Simple Mode, language) to the caller's profile.
 * The cookie is written client-side for instant feedback; the profile is the
 * source of truth across devices.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let payload: { simple_mode?: unknown; preferred_language?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof payload.simple_mode === "boolean") patch.simple_mode = payload.simple_mode;
  if (isLocale(payload.preferred_language)) patch.preferred_language = payload.preferred_language;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const db = await getDataClient();
  const { error } = await db.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not save that preference." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...patch });
}
