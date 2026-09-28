import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth/session";

/**
 * Sign-out endpoint used by the account menu (a plain form POST, so it works
 * without JavaScript). Always redirects back to the landing page.
 */
export async function POST(request: NextRequest) {
  await signOut();
  return NextResponse.redirect(new URL("/?signedOut=1", request.url), { status: 303 });
}
