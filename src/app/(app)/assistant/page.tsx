import Link from "next/link";
import { Bot, MessageSquare, Sparkles } from "lucide-react";
import { Badge, Callout, Card, CardBody, EmptyState, PageHeader } from "@/components/ui";
import { AssistantChat } from "@/components/ai/assistant-chat";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listAiConversations } from "@/lib/repos/ai";
import { listFarms } from "@/lib/repos/farms";
import { isGeminiConfigured } from "@/lib/gemini";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("nav.assistant");

export default async function AssistantPage() {
  const user = await requireUser("/assistant");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [conversations, farms] = await Promise.all([listAiConversations(user.id, 12), listFarms(user.id)]);
  const configured = isGeminiConfigured();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("ai.title")}
        subtitle={t("ai.subtitle")}
        badge={
          <Badge tone={configured ? "green" : "amber"} icon={<Sparkles className="size-3.5" aria-hidden />}>
            {configured ? t("ai.modelNote") : t("ai.notConfigured")}
          </Badge>
        }
      />

      <Callout tone="info" title={t("ai.contextTitle")}>
        {t("ai.contextBody")}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <AssistantChat
          configured={configured}
          initialMessages={[]}
          initialConversationId={null}
          defaultLanguage={locale}
          suggestedQuestions={[t("ai.suggestion1"), t("ai.suggestion2"), t("ai.suggestion3"), t("ai.suggestion4")]}
          farms={farms.map((farm) => ({ id: farm.id, name: farm.name }))}
        />

        <aside className="space-y-3">
          <Card>
            <CardBody className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-800">
                <MessageSquare className="size-4 text-field-700" aria-hidden />
                {t("ai.recentChats")}
              </h2>
              {conversations.length === 0 ? (
                <p className="text-sm text-ink-500">{t("ai.noChats")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        href={`/assistant/${conversation.id}`}
                        className="flex items-start gap-2 rounded-xl border border-ink-100 px-3 py-2 hover:border-field-300 hover:bg-field-50"
                      >
                        <Bot className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-800">{conversation.title}</span>
                          <span className="block text-xs text-ink-400">
                            {new Date(conversation.updated_at).toLocaleDateString(locale, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {!configured ? <EmptyState title={t("ai.notConfigured")} body={t("ai.notConfiguredBody")} /> : null}
        </aside>
      </div>
    </div>
  );
}
