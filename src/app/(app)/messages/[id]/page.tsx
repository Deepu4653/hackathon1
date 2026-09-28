import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageSquare, ShieldCheck } from "lucide-react";
import { Badge, Card, CardBody, Callout, formatCurrency, formatDateTime } from "@/components/ui";
import { ActionForm, Label, SubmitButton, TextArea } from "@/components/forms";
import { markConversationReadAction, sendMessageAction } from "@/app/actions/messaging";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getConversation, markConversationRead } from "@/lib/repos/messaging";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("meta.conversation");

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("/messages");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const detail = await getConversation(user.id, id);
  if (!detail) notFound();

  // Opening the thread is the read receipt. The repo scopes this to the viewer.
  if (detail.messages.some((message) => message.sender_id !== user.id && !message.read_at)) {
    await markConversationRead(user.id, detail.conversation.id);
  }

  const { conversation, messages, otherParticipant, listing } = detail;
  const markRead = markConversationReadAction.bind(null, conversation.id);

  return (
    <div className="space-y-4">
      <Link href="/messages" className="inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("messages.title")}
      </Link>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-field-100 text-base font-bold text-field-700">
              {(otherParticipant?.full_name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-bold text-ink-900">{otherParticipant?.full_name ?? t("messages.unknownUser")}</p>
              <p className="text-xs text-ink-500">
                {[otherParticipant?.village, otherParticipant?.district].filter(Boolean).join(", ") || t("common.notAvailable")}
              </p>
            </div>
          </div>
          <Badge tone="green" icon={<ShieldCheck className="size-3.5" aria-hidden />}>
            {t("messages.privateBadge")}
          </Badge>
        </CardBody>
      </Card>

      {listing ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link href={`/market/${listing.id}`} className="font-semibold text-field-700 hover:underline">
              {listing.title}
            </Link>
            <span className="text-ink-600">
              {listing.price_per_unit != null ? formatCurrency(listing.price_per_unit) : "—"}
              {listing.unit ? ` / ${listing.unit}` : ""}
            </span>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <h1 className="sr-only">{t("messages.title")}</h1>
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">{t("messages.noMessages")}</p>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const mine = message.sender_id === user.id;
                return (
                  <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${mine ? "text-right" : "text-left"}`}>
                      <div
                        className={`whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          mine ? "bg-field-700 text-white" : "bg-ink-50 text-ink-800"
                        }`}
                      >
                        {message.body}
                      </div>
                      <p className="mt-1 text-[0.7rem] text-ink-400">
                        {formatDateTime(message.created_at, locale)}
                        {mine ? ` · ${message.read_at ? t("messages.read") : t("messages.sent")}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <ActionForm action={sendMessageAction} showMessage>
                <input type="hidden" name="conversationId" value={conversation.id} />
                <Label htmlFor="body">{t("messages.reply")}</Label>
                <TextArea id="body" name="body" rows={3} required maxLength={2000} placeholder={t("messages.placeholder")} />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <SubmitButton dataPrimary>
                    <MessageSquare className="size-4" aria-hidden />
                    {t("messages.send")}
                  </SubmitButton>
                  <button type="submit" formAction={markRead} className="text-xs font-semibold text-ink-500 hover:underline">
                    {t("messages.markRead")}
                  </button>
                </div>
          </ActionForm>
        </CardBody>
      </Card>

      <Callout tone="info" title={t("messages.safetyTitle")}>
        <span className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("messages.safetyBody")}
        </span>
      </Callout>
    </div>
  );
}
