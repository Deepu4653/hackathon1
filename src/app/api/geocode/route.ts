import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces, reverseGeocode } from "@/lib/maps/geocode";

/**
 * Geocoding proxy. The browser never calls a third-party geocoder directly, so
 * tokens stay server-side (when Mapbox is used) and failures degrade to a clear
 * message instead of a broken widget.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");

  if (lat && lon) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json({ ok: false, error: "Invalid coordinates." }, { status: 400 });
    }
    const place = await reverseGeocode(latitude, longitude);
    return NextResponse.json({
      ok: true,
      places: place ? [place] : [{ id: "point", name: "Selected point", fullName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude, source: "manual" }],
      degraded: place === null,
    });
  }

  if (query.length < 3) {
    return NextResponse.json(
      { ok: false, reason: "too_short", error: "Type at least three characters of a village, town or district." },
      { status: 400 },
    );
  }

  const outcome = await searchPlaces(query);
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.message, reason: outcome.reason }, { status: 200 });
  }

  return NextResponse.json({ ok: true, places: outcome.places });
}
