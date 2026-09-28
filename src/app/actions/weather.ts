"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { saveWeatherSnapshot } from "@/lib/weather/weather-repo";
import { createWeatherAlertNotifications } from "@/lib/repos/messaging";
import { formNumber, formValue } from "@/lib/actions/state";
import { checkAndRecordUsage } from "@/lib/repos/ai";

/**
 * Stores the current snapshot for a farm and raises weather alerts.
 * Alerts are deduplicated per farm, per day and per alert type, so a farmer is
 * never spammed by the same warning on every page load.
 */
export async function saveWeatherAction(formData: FormData): Promise<void> {
  const user = await requireUser("/weather");
  const farmId = formValue(formData, "farmId") || null;
  const latitude = formNumber(formData, "latitude");
  const longitude = formNumber(formData, "longitude");

  if (latitude === undefined || longitude === undefined) {
    redirect("/weather?error=invalid-location");
  }

  const usage = await checkAndRecordUsage(user.id, "weather_fetch");
  if (!usage.allowed) redirect("/weather?error=rate-limited");

  const outcome = await fetchWeather(latitude, longitude);
  if (!outcome.ok) redirect("/weather?error=unavailable");

  await saveWeatherSnapshot({ userId: user.id, farmId, snapshot: outcome.snapshot });

  if (outcome.snapshot.alerts.length > 0) {
    await createWeatherAlertNotifications({
      userId: user.id,
      farmId,
      alerts: outcome.snapshot.alerts.map((alert) => ({
        code: alert.code,
        severity: alert.severity,
        detail: alert.detail,
      })),
      dateStamp: new Date().toISOString().slice(0, 10),
    });
  }

  revalidatePath("/weather");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  redirect("/weather?saved=1");
}
