import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { dataBackend } from "@/lib/env";
import {
  BUCKET_LIMITS,
  createSignedUrl,
  isPublicBucket,
  readLocalObject,
  type StorageBucket,
} from "@/lib/storage";

/**
 * Serves stored images.
 *
 * - avatars / listing-images are public by design (they appear in the
 *   marketplace), so they are streamed directly.
 * - crop-images is PRIVATE: the request must come from the owning signed-in
 *   farmer (or an administrator). Object paths are always `<user-id>/<file>`,
 *   matching the Supabase Storage policy, so the same rule holds in both modes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [bucket, ...rest] = segments;
  const objectPath = rest.join("/");

  if (!(bucket in BUCKET_LIMITS) || objectPath.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const typedBucket = bucket as StorageBucket;

  if (!isPublicBucket(bucket)) {
    const user = await getSessionUser();
    const folder = objectPath.split("/")[0];
    const isOwner = user?.id === folder;
    const isAdmin = user?.profile.role === "admin";
    if (!isOwner && !isAdmin) {
      // Same response whether the object exists or not: no information leak.
      return new NextResponse("Not found", { status: 404 });
    }
  }

  if (dataBackend() === "supabase") {
    const signed = await createSignedUrl(typedBucket, objectPath, 120);
    if (!signed) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(signed, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const file = await readLocalObject(bucket, objectPath);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": isPublicBucket(bucket) ? "public, max-age=3600" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
