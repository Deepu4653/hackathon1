"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import {
  saveCategory,
  setCategoryActive,
  setListingFeatured,
  setListingStatus,
  setUserBlocked,
  setUserRole,
  updateReport,
} from "@/lib/repos/admin";
import { importMarketPrices } from "@/lib/market/service";
import { createNotification } from "@/lib/repos/messaging";
import { actionError, actionOk, fieldErrorsFrom, formValue, type ActionState } from "@/lib/actions/state";
import { categorySchema } from "@/lib/validation/schemas";
import { integrationStatus } from "@/lib/env.server";
import type { UserRole } from "@/lib/db/types";

/**
 * Every action here re-checks the administrator role server-side.
 * The middleware only guarantees "has a session" — this is the real gate, and
 * the mutations run through the service-role client with an audit-log entry.
 */

async function guardAdmin() {
  const admin = await requireAdmin();
  return admin;
}

export async function setUserRoleAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const userId = formValue(formData, "userId");
  const role = formValue(formData, "role") as UserRole;
  if (!userId || !["farmer", "seller", "buyer", "distributor", "machine_owner", "admin"].includes(role)) {
    return actionError("That role is not valid.");
  }
  if (userId === admin.id && role !== "admin") {
    return actionError("You cannot remove your own administrator role.");
  }

  const result = await setUserRole(admin.id, userId, role);
  if (!result.ok) return actionError(result.error ?? "Could not update that role.");

  await createNotification({
    userId,
    type: "system",
    title: "Your account role was updated",
    body: `An administrator set your role to ${role}.`,
    severity: "info",
    dedupeKey: `role:${role}:${new Date().toISOString().slice(0, 10)}`,
  });

  revalidatePath("/admin/users");
  return actionOk("User updated.");
}

export async function setUserBlockedAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const userId = formValue(formData, "userId");
  const blocked = formValue(formData, "blocked") === "true";
  if (!userId) return actionError("That user could not be found.");
  if (userId === admin.id) return actionError("You cannot block your own account.");

  const result = await setUserBlocked(admin.id, userId, blocked);
  if (!result.ok) return actionError(result.error ?? "Could not update that account.");

  revalidatePath("/admin/users");
  return actionOk(blocked ? "Account blocked." : "Account unblocked.");
}

export async function setListingStatusAdminAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const listingId = formValue(formData, "listingId");
  const status = formValue(formData, "status");
  if (!listingId || !["draft", "active", "sold", "archived", "removed"].includes(status)) {
    return actionError("That action is not valid.");
  }

  const result = await setListingStatus(admin.id, listingId, status as never);
  if (!result.ok) return actionError(result.error ?? "Could not update that listing.");

  revalidatePath("/admin/listings");
  revalidatePath("/market");
  return actionOk(status === "removed" ? "Listing removed from the marketplace." : "Listing updated.");
}

export async function setListingFeaturedAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const listingId = formValue(formData, "listingId");
  const featured = formValue(formData, "featured") === "true";
  if (!listingId) return actionError("That listing could not be found.");

  const result = await setListingFeatured(admin.id, listingId, featured);
  if (!result.ok) return actionError(result.error ?? "Could not update that listing.");

  revalidatePath("/admin/listings");
  revalidatePath("/market");
  return actionOk(featured ? "Listing featured." : "Listing unfeatured.");
}

export async function updateReportAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const reportId = formValue(formData, "reportId");
  const status = formValue(formData, "status");
  const note = formValue(formData, "note");
  if (!reportId || !["open", "reviewing", "resolved", "dismissed"].includes(status)) {
    return actionError("That action is not valid.");
  }

  const result = await updateReport(admin.id, reportId, status as never, note || undefined);
  if (!result.ok) return actionError(result.error ?? "Could not update that report.");

  revalidatePath("/admin/reports");
  return actionOk("Report updated.");
}

export async function saveCategoryAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const parsed = categorySchema.safeParse({
    id: formValue(formData, "id") || undefined,
    slug: formValue(formData, "slug"),
    name_en: formValue(formData, "name_en"),
    name_te: formValue(formData, "name_te"),
    name_hi: formValue(formData, "name_hi"),
    kind: formValue(formData, "kind") || "produce",
    icon: formValue(formData, "icon"),
    sort_order: formValue(formData, "sort_order") || 100,
    is_active: formValue(formData, "is_active") !== "false",
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await saveCategory(admin.id, parsed.data);
  if (!result.ok) return actionError(result.error ?? "Could not save that category.");

  revalidatePath("/admin/categories");
  revalidatePath("/market");
  return actionOk(parsed.data.id ? "Category updated." : "Category created.");
}

export async function setCategoryActiveAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();
  const categoryId = formValue(formData, "categoryId");
  const active = formValue(formData, "active") === "true";
  if (!categoryId) return actionError("That category could not be found.");

  const result = await setCategoryActive(admin.id, categoryId, active);
  if (!result.ok) return actionError(result.error ?? "Could not update that category.");

  revalidatePath("/admin/categories");
  return actionOk(active ? "Category activated." : "Category deactivated.");
}

export async function importMarketPricesAction(
  _prev: ActionState | null,
  _formData: FormData,
): Promise<ActionState> {
  const admin = await guardAdmin();

  if (!integrationStatus.dataGov) {
    return actionError(
      "Price import needs DATA_GOV_IN_API_KEY. Add it to the environment and restart to pull the official Agmarknet feed.",
      { code: "not_configured" },
    );
  }

  const summary = await importMarketPrices({ actorId: admin.id, state: "Andhra Pradesh", limit: 500 });

  revalidatePath("/admin/prices");
  revalidatePath("/market-prices");

  if (!summary.ok) {
    return actionError(summary.message, { code: summary.reason === "not_configured" ? "not_configured" : undefined });
  }
  return actionOk(summary.message, { imported: summary.imported });
}
