import { getDataClient } from "@/lib/db";
import type { Conversation, Listing, Message, Notification, PublicProfile } from "@/lib/db/types";

export interface ConversationSummary extends Conversation {
  listing_title: string | null;
  other_participant: PublicProfile | null;
  last_message: string | null;
  unread_count: number;
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Conversation>("conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];

  const conversations = data as Conversation[];
  if (conversations.length === 0) return [];

  const listingIds = conversations.map((conversation) => conversation.listing_id).filter((id): id is string => Boolean(id));
  const otherIds = Array.from(
    new Set(
      conversations.map((conversation) => (conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id)),
    ),
  );

  const [listingsResult, profilesResult, messagesResult] = await Promise.all([
    listingIds.length
      ? db.from<Listing>("listings").select("id,title").in("id", listingIds).limit(50)
      : Promise.resolve({ data: [], error: null, count: null }),
    otherIds.length
      ? db.from<PublicProfile>("public_profiles").select("*").in("id", otherIds).limit(50)
      : Promise.resolve({ data: [], error: null, count: null }),
    db
      .from<Message>("messages")
      .select("*")
      .in("conversation_id", conversations.map((conversation) => conversation.id))
      .order("created_at", { ascending: true })
      .limit(400),
  ]);

  const listingTitles = new Map(((listingsResult.data ?? []) as Listing[]).map((row) => [row.id, row.title]));
  const profiles = new Map(((profilesResult.data ?? []) as PublicProfile[]).map((row) => [row.id, row]));
  const messages = (messagesResult.data ?? []) as Message[];

  return conversations.map((conversation) => {
    const conversationMessages = messages.filter((message) => message.conversation_id === conversation.id);
    const lastMessage = conversationMessages[conversationMessages.length - 1] ?? null;
    const otherId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
    return {
      ...conversation,
      listing_title: conversation.listing_id ? listingTitles.get(conversation.listing_id) ?? null : null,
      other_participant: profiles.get(otherId) ?? null,
      last_message: lastMessage?.body ?? null,
      unread_count: conversationMessages.filter(
        (message) => message.sender_id !== userId && message.read_at === null,
      ).length,
    };
  });
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  otherParticipant: PublicProfile | null;
  listing: Pick<Listing, "id" | "title" | "price_per_unit" | "unit" | "kind" | "status"> | null;
  viewerId: string;
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<Conversation>("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  const conversation = data as Conversation | null;
  if (!conversation) return null;
  // RLS already restricts this; the check keeps the invariant obvious in code.
  if (conversation.buyer_id !== userId && conversation.seller_id !== userId) return null;

  const otherId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;

  const [messagesResult, profileResult, listingResult] = await Promise.all([
    db
      .from<Message>("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200),
    db.from<PublicProfile>("public_profiles").select("*").eq("id", otherId).maybeSingle(),
    conversation.listing_id
      ? db
          .from<Listing>("listings")
          .select("id,title,price_per_unit,unit,kind,status")
          .eq("id", conversation.listing_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null, count: null }),
  ]);

  return {
    conversation,
    messages: (messagesResult.data ?? []) as Message[],
    otherParticipant: (profileResult.data as PublicProfile) ?? null,
    listing: (listingResult.data as Listing) ?? null,
    viewerId: userId,
  };
}

/** Finds or creates the (listing, buyer, seller) thread. */
export async function startConversation(input: {
  buyerId: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  firstMessage?: string | null;
}): Promise<{ ok: boolean; conversationId?: string; error?: string }> {
  const db = await getDataClient();

  if (input.buyerId === input.sellerId) {
    return { ok: false, error: "This is your own listing." };
  }

  const { data: existing } = await db
    .from<Conversation>("conversations")
    .select("*")
    .eq("listing_id", input.listingId)
    .eq("buyer_id", input.buyerId)
    .eq("seller_id", input.sellerId)
    .maybeSingle();

  let conversation = existing as Conversation | null;

  if (!conversation) {
    const { data, error } = await db
      .from<Conversation>("conversations")
      .insert({
        listing_id: input.listingId,
        buyer_id: input.buyerId,
        seller_id: input.sellerId,
        subject: input.listingTitle.slice(0, 120),
      })
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    conversation = data as Conversation;
  }

  if (!conversation) return { ok: false, error: "Could not start that conversation." };

  if (input.firstMessage && input.firstMessage.trim()) {
    const sent = await sendMessage(input.buyerId, conversation.id, input.firstMessage);
    if (!sent.ok) return { ok: false, error: sent.error };
  }

  return { ok: true, conversationId: conversation.id };
}

export async function sendMessage(
  senderId: string,
  conversationId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Please write a message." };
  if (trimmed.length > 4000) return { ok: false, error: "That message is too long." };

  const db = await getDataClient();
  const { error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed });
  if (error) return { ok: false, error: "Message could not be sent. Please try again." };
  return { ok: true };
}

/** Marks every message from the other participant as read. */
export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  try {
    const db = await getDataClient();
    const { data } = await db
      .from<Message>("messages")
      .select("id,sender_id,read_at")
      .eq("conversation_id", conversationId)
      .is("read_at", null)
      .limit(200);
    const unread = ((data ?? []) as Message[]).filter((message) => message.sender_id !== userId);
    if (unread.length === 0) return;
    await db
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((message) => message.id));
  } catch {
    // Read receipts are best-effort.
  }
}

export async function countUnreadMessages(userId: string): Promise<number> {
  try {
    const db = await getDataClient();
    const { data: conversations } = await db
      .from<Conversation>("conversations")
      .select("id,buyer_id,seller_id")
      .limit(50);
    const ids = ((conversations ?? []) as Conversation[]).map((conversation) => conversation.id);
    if (ids.length === 0) return 0;
    const { data: messages, count } = await db
      .from<Message>("messages")
      .select("id,sender_id,read_at", { count: "exact" })
      .in("conversation_id", ids)
      .is("read_at", null)
      .limit(200);
    const rows = (messages ?? []) as Message[];
    return count ?? rows.filter((message) => message.sender_id !== userId).length;
  } catch {
    return 0;
  }
}

export async function listConversationMessagesForAI(conversationId: string, limit = 20): Promise<Message[]> {
  const db = await getDataClient();
  const { data } = await db
    .from<Message>("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Message[]).reverse();
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Notification>("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));
  if (error) return [];
  return (data ?? []) as Notification[];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = await getDataClient();
  const { count } = await db
    .from<Notification>("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const db = await getDataClient();
  await db
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const db = await getDataClient();
  await db
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);
}

/**
 * Creates a notification unless an identical one already exists.
 * The unique (user_id, dedupe_key) constraint makes dedupe a database guarantee.
 */
export async function createNotification(input: {
  userId: string;
  type: Notification["type"];
  title: string;
  body?: string | null;
  link?: string | null;
  severity?: Notification["severity"];
  dedupeKey?: string | null;
}): Promise<void> {
  try {
    const db = await getDataClient();
    await db.from("notifications").upsert(
      {
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        severity: input.severity ?? "info",
        dedupe_key: input.dedupeKey ?? null,
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    );
  } catch (error) {
    console.warn("[notifications] create failed", error);
  }
}

/** Weather alert notifications, deduped per farm per day. */
export async function createWeatherAlertNotifications(input: {
  userId: string;
  farmId: string | null;
  alerts: Array<{ code: string; severity: string; detail: string }>;
  dateStamp: string;
}): Promise<number> {
  let created = 0;
  for (const alert of input.alerts) {
    if (alert.severity === "info" && alert.code !== "rain_today" && alert.code !== "dry_spell") continue;
    await createNotification({
      userId: input.userId,
      type: "weather_alert",
      title: alert.code,
      body: alert.detail,
      severity: alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "info",
      dedupeKey: `${input.dateStamp}:${input.farmId ?? "none"}:${alert.code}`,
      link: "/weather",
    });
    created += 1;
  }
  return created;
}
