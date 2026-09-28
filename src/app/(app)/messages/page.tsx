import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Badge, Card, CardBody, EmptyState, PageHeader, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listConversations } from "@/lib/repos/messaging";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("messages.title");

export default async function MessagesPage() {
  const user = await requireUser("/messages");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);
  const conversations = await listConversations(user.id);
  const unread = conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("messages.title")}
        subtitle={t("messages.subtitle")}
        badge={unread > 0 ? <Badge tone="amber">{unread} {t("notifications.unread")}</Badge> : null}
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" aria-hidden />}
          title={t("messages.empty")}
          body={t("messages.emptyBody")}
          action={
            <Link
              href="/market"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
            >
              {t("nav.market")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link href={`/messages/${conversation.id}`} className="block">
                <Card
                  className={`transition hover:border-field-300 ${
                    conversation.unread_count > 0 ? "border-field-200 bg-field-50/40" : ""
                  }`}
                >
                  <CardBody className="flex items-start gap-3.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-field-100 text-base font-bold text-field-700">
                      {(conversation.other_participant?.full_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {conversation.other_participant?.full_name ?? t("messages.unknownUser")}
                        </p>
                        <span className="shrink-0 text-xs text-ink-400">{formatDateTime(conversation.last_message_at, locale)}</span>
                      </div>
                      {conversation.listing_title ? (
                        <p className="mt-0.5 truncate text-xs font-medium text-field-700">{conversation.listing_title}</p>
                      ) : null}
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">
                        {conversation.last_message ?? t("messages.noMessages")}
                      </p>
                    </div>
                    {conversation.unread_count > 0 ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-field-700 text-xs font-bold text-white">
                        {conversation.unread_count}
                      </span>
                    ) : null}
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-500">{t("messages.privacyNote")}</p>
    </div>
  );
}
