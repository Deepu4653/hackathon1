import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Trash2 } from "lucide-react";
import { Badge, Callout, Card, CardBody, PageHeader } from "@/components/ui";
import { AssistantChat } from "@/components/ai/assistant-chat";
import { SubmitButton } from "@/components/forms";
import { deleteAiConversationAction } from "@/app/actions/ai";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getAiConversation, listAiConversations, listAiMessages } from "@/lib/repos/ai";
import { listFarms } from "@/lib/repos/farms";
import { isGeminiConfigured } from "@/lib/gemini";
import { countUsageSince } from "@/lib/repos/ai";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("meta.aiConversation");

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export default async function AssistantConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("/assistant");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const conversation = await getAiConversation(user.id, id);
  if (!conversation) notFound();

  const [messages, conversations, farms, usedToday] = await Promise.all([
    listAiMessages(conversation.id, 100),
    listAiConversations(user.id, 12),
    listFarms(user.id),
    countUsageSince("ai_chat", startOfTodayIso()),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/assistant" className="inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("ai.title")}
      </Link>

      <PageHeader
        title={conversation.title}
        subtitle={new Date(conversation.created_at).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        badge={<Badge tone="neutral">{usedToday} / 60 {t("ai.todayUsage")}</Badge>}
        action={
          <form action={deleteAiConversationAction}>
            <input type="hidden" name="conversationId" value={conversation.id} />
            <SubmitButton variant="ghost">{t("ai.deleteChat")}</SubmitButton>
          </form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <AssistantChat
          configured={isGeminiConfigured()}
          initialConversationId={conversation.id}
          defaultLanguage={conversation.language}
          initialMessages={messages
            .filter((message) => message.role !== "system")
            .map((message) => ({
              id: message.id,
              role: message.role === "user" ? ("user" as const) : ("assistant" as const),
              content: message.content,
              createdAt: message.created_at,
            }))}
          suggestedQuestions={[t("ai.suggestion1"), t("ai.suggestion2")]}
          farms={farms.map((farm) => ({ id: farm.id, name: farm.name }))}
        />

        <aside className="space-y-3">
          <Card>
            <CardBody className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-800">
                <Bot className="size-4 text-field-700" aria-hidden />
                {t("ai.recentChats")}
              </h2>
              <ul className="space-y-1.5">
                {conversations.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/assistant/${item.id}`}
                      className={`block truncate rounded-xl border px-3 py-2 text-sm ${
                        item.id === conversation.id
                          ? "border-field-300 bg-field-50 font-semibold text-field-900"
                          : "border-ink-100 text-ink-700 hover:border-field-300"
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/assistant"
                className="block rounded-xl border border-dashed border-ink-200 px-3 py-2 text-center text-sm font-semibold text-field-700 hover:bg-field-50"
              >
                <Trash2 className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
                {t("ai.newChat")}
              </Link>
            </CardBody>
          </Card>

          <Callout tone="warning" title={t("ai.disclaimer")} />
        </aside>
      </div>
    </div>
  );
}
