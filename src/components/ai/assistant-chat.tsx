"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bot, Loader2, Mic, MicOff, Send, Sparkles, User, Volume2 } from "lucide-react";
import { FormMessage, Select, SubmitButton, TextArea } from "@/components/forms";
import { Callout } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS, SPEECH_TAGS } from "@/lib/i18n/config";
import type { ActionState } from "@/lib/actions/state";
import { askAssistantAction } from "@/app/actions/ai";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function subscribeSpeechSupport() {
  return () => {};
}

function getSpeechSupport(): boolean {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return Boolean(scope.SpeechRecognition ?? scope.webkitSpeechRecognition);
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

export function AssistantChat({
  configured,
  initialMessages,
  initialConversationId,
  defaultLanguage,
  suggestedQuestions,
  farms,
}: {
  configured: boolean;
  initialMessages: ChatMessage[];
  initialConversationId: string | null;
  defaultLanguage: string;
  suggestedQuestions: string[];
  farms: Array<{ id: string; name: string }>;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    askAssistantAction,
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [question, setQuestion] = useState("");
  const [listening, setListening] = useState(false);
  const seenAnswer = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Speech support is an external system, so it is read instead of stored.
  const speechSupported = useSyncExternalStore(subscribeSpeechSupport, getSpeechSupport, () => false);

  // A brand-new chat gets its id from the action result, so the URL in the
  // address bar is derived rather than synchronised into state.
  const returnedId = state?.ok && typeof state.conversationId === "string" ? state.conversationId : null;
  const conversationId = returnedId ?? initialConversationId;

  // Append the answer returned by the server action (the real model reply —
  // the component never invents text of its own).
  useEffect(() => {
    if (!state || !state.ok) return;
    const answer = typeof state.answer === "string" ? state.answer : null;
    if (!answer || seenAnswer.current === answer) return;
    seenAnswer.current = answer;

    const asked = question || t("ai.youAsked");
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: "user", content: asked, createdAt: new Date().toISOString() },
      { id: `local-${Date.now()}-a`, role: "assistant", content: answer, createdAt: new Date().toISOString() },
    ]);
  }, [state, question, t]);

  // Keep the address bar in sync so a new chat can be reopened or shared.
  useEffect(() => {
    if (returnedId) window.history.replaceState(null, "", `/assistant/${returnedId}`);
  }, [returnedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_TAGS[defaultLanguage as keyof typeof SPEECH_TAGS] ?? "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    const scope = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Recognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = SPEECH_TAGS[defaultLanguage as keyof typeof SPEECH_TAGS] ?? "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) setQuestion((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scrollRef}
        className="min-h-[18rem] max-h-[32rem] overflow-y-auto rounded-[var(--radius-card)] border border-ink-200 bg-white p-3.5"
      >
        {messages.length === 0 ? (
          <div className="space-y-4 py-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-field-100 text-field-700">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-ink-700">{t("ai.emptyState")}</p>
            <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuestion(suggestion)}
                  className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-700 hover:border-field-300 hover:bg-field-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`flex items-start gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${
                    message.role === "user" ? "bg-soil-100 text-soil-700" : "bg-field-100 text-field-700"
                  }`}
                >
                  {message.role === "user" ? <User className="size-4" aria-hidden /> : <Bot className="size-4" aria-hidden />}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user" ? "bg-soil-50 text-ink-800" : "bg-ink-50 text-ink-800"
                  }`}
                >
                  {message.content}
                  {message.role === "assistant" ? (
                    <button
                      type="button"
                      onClick={() => speak(message.content)}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-field-700 hover:underline"
                    >
                      <Volume2 className="size-3.5" aria-hidden />
                      {t("ai.listen")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="flex items-center gap-2 text-sm text-ink-500">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("ai.thinking")}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 rounded-[var(--radius-card)] border border-ink-200 bg-white p-3.5"
        onSubmit={() => {
          // Lets the same answer be appended again if the same question is asked twice.
          seenAnswer.current = null;
        }}
      >
        <input type="hidden" name="conversationId" value={conversationId ?? ""} />
        <FormMessage state={state} />

        {!configured ? <Callout tone="warning" title={t("ai.notConfigured")} /> : null}

        <TextArea
          id="question"
          name="question"
          rows={3}
          required
          maxLength={1500}
          placeholder={t("ai.placeholder")}
          defaultValue=""
        />
        <input
          type="hidden"
          name="language"
          value={defaultLanguage}
          key={defaultLanguage}
        />
        <span className="sr-only">{question}</span>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="language-picker" className="mb-1 block text-xs font-semibold text-ink-600">
              {t("ai.answerLanguage")}
            </label>
            <Select id="language-picker" name="answerLanguage" defaultValue={defaultLanguage}>
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale].native}
                </option>
              ))}
            </Select>
          </div>

          {farms.length > 0 ? (
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="farm-picker" className="mb-1 block text-xs font-semibold text-ink-600">
                {t("ai.usingFarm")}
              </label>
              <Select id="farm-picker" name="farmId" defaultValue="">
                <option value="">{t("ai.noFarmContext")}</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {speechSupported ? (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={listening ? t("ai.stopSpeaking") : t("ai.speak")}
                className={`grid size-11 place-items-center rounded-xl border ${
                  listening
                    ? "border-danger-300 bg-danger-50 text-danger-600 animate-soft-pulse"
                    : "border-ink-200 bg-white text-ink-600 hover:border-field-300"
                }`}
              >
                {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              </button>
            ) : null}
            <SubmitButton dataPrimary disabled={!configured} pendingLabel={t("ai.thinking")}>
              <Send className="size-4" aria-hidden />
              {t("ai.send")}
            </SubmitButton>
          </div>
        </div>

        <p className="text-xs text-ink-400">{t("ai.disclaimer")}</p>
      </form>
    </div>
  );
}
