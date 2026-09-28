import { NextResponse } from "next/server";
import { dataBackend } from "@/lib/env";
import { getSessionUser, resolveSessionForRequest } from "@/lib/auth/session";
import { createLocalSession, createLocalUser } from "@/lib/auth/local-store";
import { createOpaqueToken, REFRESH_TOKEN_TTL_SECONDS } from "@/lib/auth/tokens";
import { createFarm } from "@/lib/repos/farms";
import { createListing, toggleFavorite } from "@/lib/repos/listings";
import { sendMessage, startConversation } from "@/lib/repos/messaging";
import { withAuthContext } from "@/lib/db/local/engine";
import { serviceContext } from "@/lib/db/local/auth-context";
import type { Language, UserRole } from "@/lib/db/types";

/**
 * Test-fixture harness for the end-to-end flow test (`npm run test:flow`).
 *
 * Why it exists: the local reference database (PGlite) is a single-connection
 * embedded PostgreSQL, so a test script and the server it is testing cannot both
 * hold the data directory. Fixtures therefore have to be created BY the server,
 * through the same repositories, contexts and RLS policies the application uses.
 *
 * Safety: this route answers 404 unless BOTH of these are true —
 *   · the deployment runs the local backend (never a Supabase deployment), and
 *   · `X_FARM_ALLOW_TEST_FIXTURES=1` with a matching `X_FARM_FIXTURE_TOKEN`
 *     (both provided by the test runner at spawn time).
 * Without them the route is indistinguishable from a missing page, and it never
 * fabricates a feature: every row it writes goes through real validation, real
 * constraints and real row level security.
 */

const TOKEN_HEADER = "x-fixture-token";

function fixtureToken(): string {
  return process.env.X_FARM_FIXTURE_TOKEN ?? "";
}

function isEnabled(): boolean {
  return (
    process.env.X_FARM_ALLOW_TEST_FIXTURES === "1" &&
    fixtureToken().length >= 16 &&
    dataBackend() === "local"
  );
}

function authorised(request: Request): boolean {
  if (!isEnabled()) return false;
  const provided = request.headers.get(TOKEN_HEADER) ?? "";
  return provided.length === fixtureToken().length && provided === fixtureToken();
}

interface FixtureBody {
  action?: string;
  email?: string;
  role?: UserRole;
  simpleMode?: boolean;
  fullName?: string;
  farmName?: string;
  listingTitle?: string;
  listingId?: string;
  message?: string;
}

function notFound() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

/**
 * Any method other than POST looks like a missing page, exactly like a disabled
 * harness — a 405 would tell a scanner that this route exists at all.
 */
export async function GET() {
  return notFound();
}

export async function POST(request: Request) {
  if (!authorised(request)) return notFound();

  const body = (await request.json().catch(() => ({}))) as FixtureBody;

  switch (body.action) {
    /** Removes every account the flow test ever created. */
    case "reset": {
      await withAuthContext(serviceContext, async (auth) => {
        await auth.query("delete from auth.users where email like 'flow.%@example.com'");
      });
      return NextResponse.json({ ok: true });
    }

    /** Creates one disposable account and signs it in (real session cookie). */
    case "account": {
      const email = (body.email ?? "").trim().toLowerCase();
      const role = body.role ?? "farmer";
      if (!/^[^@\s]+@example\.com$/.test(email)) {
        return NextResponse.json({ ok: false, error: "Fixture emails must be *@example.com." }, { status: 400 });
      }

      await withAuthContext(serviceContext, async (auth) => {
        await auth.query("delete from auth.users where email = $1", [email]);
      });

      const user = await createLocalUser({
        email,
        password: "FlowTest!2026",
        fullName: body.fullName ?? "Flow User",
        village: "Kurnool",
        district: "Kurnool",
        state: "Andhra Pradesh",
        role: role === "admin" ? "farmer" : role,
        preferredLanguage: (process.env.FIXTURE_LANGUAGE as Language) ?? "en",
        simpleMode: Boolean(body.simpleMode),
        adminBootstrap: role === "admin",
      });

      const refreshToken = createOpaqueToken();
      const session = await createLocalSession(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS, "test-flow", null);
      await resolveSessionForRequest(user.id, user.email, session.id, refreshToken);

      return NextResponse.json({ ok: true, userId: user.id, email: user.email });
    }

    /** Everything below runs as the caller: the session cookie decides who. */
    case "farm": {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
      const result = await createFarm(user.id, {
        name: body.farmName ?? "Flow test farm",
        size_acres: 3.5,
        soil_type: "black",
        irrigation_source: "borewell",
        village: "Kurnool",
        district: "Kurnool",
        state: "Andhra Pradesh",
        is_primary: true,
      });
      return NextResponse.json(result);
    }

    case "listing": {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
      const result = await createListing(user.id, {
        kind: "produce",
        title: body.listingTitle ?? "Flow test paddy, 20 quintals",
        description: "Freshly harvested, dried and cleaned. Created by the end-to-end flow test.",
        category_id: null,
        crop_name: "Paddy",
        quantity: 20,
        unit: "quintal",
        price_per_unit: 2320,
        is_negotiable: true,
        district: "Kurnool",
        village: "Kurnool",
        state: "Andhra Pradesh",
        status: "active",
      });
      return NextResponse.json(result);
    }

    case "favorite": {
      const user = await getSessionUser();
      if (!user || !body.listingId) return NextResponse.json({ ok: false, error: "Missing listing." }, { status: 400 });
      return NextResponse.json(await toggleFavorite(user.id, body.listingId));
    }

    case "conversation": {
      const user = await getSessionUser();
      if (!user || !body.listingId) return NextResponse.json({ ok: false, error: "Missing listing." }, { status: 400 });
      const listing = await withAuthContext(serviceContext, async (auth) => {
        const { rows } = await auth.query<{ seller_id: string; title: string }>(
          "select seller_id, title from public.listings where id = $1",
          [body.listingId],
        );
        return rows[0] ?? null;
      });
      if (!listing) return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });

      const started = await startConversation({
        buyerId: user.id,
        listingId: body.listingId,
        listingTitle: listing.title,
        sellerId: listing.seller_id,
        firstMessage: body.message ?? "Is this still available?",
      });
      if (started.ok && started.conversationId) {
        await sendMessage(user.id, started.conversationId, "I can collect tomorrow morning.");
      }
      return NextResponse.json(started);
    }

    /** Row counts for assertions the pages cannot prove on their own. */
    case "inspect": {
      return NextResponse.json({
        ok: true,
        counts: await withAuthContext(serviceContext, async (auth) => {
          const scalar = async (sql: string) => {
            const { rows } = await auth.query<{ count: string }>(sql);
            return Number(rows[0]?.count ?? 0);
          };
          return {
            profiles: await scalar("select count(*)::text as count from public.profiles"),
            listings: await scalar("select count(*)::text as count from public.listings"),
            farms: await scalar("select count(*)::text as count from public.farms"),
            favorites: await scalar("select count(*)::text as count from public.favorites"),
            conversations: await scalar("select count(*)::text as count from public.conversations"),
            messages: await scalar("select count(*)::text as count from public.messages"),
            notifications: await scalar("select count(*)::text as count from public.notifications"),
          };
        }),
      });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown fixture action." }, { status: 400 });
  }
}
