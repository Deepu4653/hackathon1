import Link from "next/link";
import { Bell, CheckCheck, CloudRain, Heart, MessageSquare, ShieldAlert, Store, TriangleAlert } from "lucide-react";
import { Badge, Card, CardBody, EmptyState, PageHeader, formatDateTime } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/messaging";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listNotifications } from "@/lib/repos/messaging";
import type { Notification } from "@/lib/db/types";

export const metadata = { title: "Notifications" };

const TYPE_ICON: Record<Notification["type"], typeof Bell> = {
  weather_alert: CloudRain,
  marketplace: Store,
  message: MessageSquare,
  listing: Heart,
  reminder: Bell,
  system: ShieldAlert,
  admin: ShieldAlert,
};

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);
  const notifications = await listNotifications(user.id, 60);
  const unread = notifications.filter((notification) => !notification.is_read).length;

  const typeLabel = (type: Notification["type"]) => {
    switch (type) {
      case "weather_alert":
        return t("notifications.weather");
      case "marketplace":
        return t("notifications.marketplace");
      case "message":
        return t("notifications.message");
      case "listing":
        return t("notifications.listing");
      case "reminder":
        return t("notifications.reminder");
      default:
        return t("notifications.system");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        badge={unread > 0 ? <Badge tone="amber">{unread} {t("notifications.unread")}</Badge> : null}
        action={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="secondary">
                <CheckCheck className="size-4" aria-hidden />
                {t("notifications.markAllRead")}
              </SubmitButton>
            </form>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" aria-hidden />} title={t("notifications.empty")} body={t("notifications.emptyBody")} />
      ) : (
        <ul className="space-y-2.5">
          {notifications.map((notification) => {
            const Icon = TYPE_ICON[notification.type] ?? Bell;
            const tone =
              notification.severity === "critical"
                ? "critical"
                : notification.severity === "warning"
                  ? "warning"
                  : notification.severity === "success"
                    ? "success"
                    : "info";
            return (
              <li key={notification.id}>
                <Card className={notification.is_read ? "" : "border-field-200 bg-field-50/40"}>
                  <CardBody className="flex gap-3">
                    <span
                      className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${
                        tone === "critical"
                          ? "bg-danger-100 text-danger-700"
                          : tone === "warning"
                            ? "bg-soil-100 text-soil-700"
                            : tone === "success"
                              ? "bg-field-100 text-field-700"
                              : "bg-info-100 text-info-700"
                      }`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900">{notification.title}</p>
                        <Badge tone={notification.severity === "critical" ? "red" : notification.severity === "warning" ? "amber" : "neutral"}>
                          {typeLabel(notification.type)}
                        </Badge>
                        {!notification.is_read ? <span aria-hidden className="size-2 rounded-full bg-field-600" /> : null}
                      </div>
                      {notification.body ? <p className="mt-1 text-sm leading-relaxed text-ink-600">{notification.body}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-ink-400">{formatDateTime(notification.created_at, locale)}</span>
                        {notification.link ? (
                          <Link href={notification.link} className="text-xs font-semibold text-field-700 hover:underline">
                            {t("notifications.open")}
                          </Link>
                        ) : null}
                        {!notification.is_read ? (
                          <form action={markNotificationReadAction}>
                            <input type="hidden" name="notificationId" value={notification.id} />
                            <button type="submit" className="text-xs font-semibold text-ink-500 hover:underline">
                              {t("notifications.markRead")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("notifications.noSpam")}
      </p>
    </div>
  );
}
