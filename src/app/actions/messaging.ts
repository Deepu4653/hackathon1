"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markConversationRead,
  markNotificationRead,
  sendMessage,
  startConversation,
} from "@/lib/repos/messaging";
import { actionError, actionOk, fieldErrorsFrom, formValue, type ActionState } from "@/lib/actions/state";
import { messageSchema, startConversationSchema } from "@/lib/validation/schemas";
import { getDataClient } from "@/lib/db";

export async function startConversationAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/market");
  const parsed = startConversationSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    message: formValue(formData, "message"),
  });

  if (!parsed.success) {
    return actionError("Please write a short message.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const db = await getDataClient();
  const { data: listing } = await db
    .from("listings")
    .select("id,title,seller_id,contact_phone")
    .eq("id", parsed.data.listingId)
    .maybeSingle();

  const row = listing as { id: string; title: string; seller_id: string } | null;
  if (!row) return actionError("That listing is no longer available.");
  if (row.seller_id === user.id) return actionError("This is your own listing.");

  const result = await startConversation({
    buyerId: user.id,
    listingId: row.id,
    listingTitle: row.title,
    sellerId: row.seller_id,
    firstMessage: parsed.data.message ?? null,
  });

  if (!result.ok || !result.conversationId) {
    return actionError(result.error ?? "Could not start that conversation.");
  }

  revalidatePath("/messages");
  redirect(`/messages/${result.conversationId}`);
}

export async function sendMessageAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/messages");
  const parsed = messageSchema.safeParse({
    conversationId: formValue(formData, "conversationId"),
    body: formValue(formData, "body"),
  });

  if (!parsed.success) {
    return actionError("Please write a message.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await sendMessage(user.id, parsed.data.conversationId, parsed.data.body);
  if (!result.ok) return actionError(result.error ?? "Message could not be sent.");

  revalidatePath(`/messages/${parsed.data.conversationId}`);
  revalidatePath("/messages");
  return actionOk();
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const user = await requireUser("/messages");
  await markConversationRead(user.id, conversationId);
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser("/notifications");
  const id = formValue(formData, "notificationId");
  if (id) await markNotificationRead(user.id, id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser("/notifications");
  await markAllNotificationsRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
