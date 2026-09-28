"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  addListingImages,
  createListing,
  createMachinery,
  deleteListing,
  deleteListingImage,
  toggleFavorite,
  updateListing,
  updateMachinery,
} from "@/lib/repos/listings";
import { createNotification } from "@/lib/repos/messaging";
import { removeObject, uploadObject, validateImageFile, buildStoragePath } from "@/lib/storage";
import { actionError, actionOk, fieldErrorsFrom, formBool, formNumber, formValue, type ActionState } from "@/lib/actions/state";
import { listingSchema, machinerySchema, reportSchema } from "@/lib/validation/schemas";
import { getDataClient } from "@/lib/db";

function parseListing(formData: FormData) {
  return listingSchema.safeParse({
    kind: formValue(formData, "kind") || "produce",
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    crop_name: formValue(formData, "crop_name"),
    category_id: formValue(formData, "category_id"),
    quantity: formNumber(formData, "quantity"),
    unit: formValue(formData, "unit"),
    price_per_unit: formNumber(formData, "price_per_unit"),
    is_negotiable: formBool(formData, "is_negotiable"),
    min_order_quantity: formNumber(formData, "min_order_quantity"),
    village: formValue(formData, "village"),
    district: formValue(formData, "district"),
    state: formValue(formData, "state") || "Andhra Pradesh",
    pincode: formValue(formData, "pincode"),
    latitude: formNumber(formData, "latitude"),
    longitude: formNumber(formData, "longitude"),
    harvest_date: formValue(formData, "harvest_date"),
    available_from: formValue(formData, "available_from"),
    available_until: formValue(formData, "available_until"),
    status: formValue(formData, "status") || "active",
    contact_phone: formValue(formData, "contact_phone"),
  });
}

/** Uploads the validated listing photos and returns their stored metadata. */
async function storeListingImages(
  userId: string,
  listingId: string,
  files: File[],
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = [];
  let uploaded = 0;

  for (const file of files.slice(0, 5)) {
    if (!file || file.size === 0) continue;
    const validation = await validateImageFile(file, "listing-images");
    if (!validation.ok) {
      errors.push(validation.error);
      continue;
    }
    const objectPath = buildStoragePath(userId, file.name || "listing", validation.extension);
    const stored = await uploadObject({
      bucket: "listing-images",
      objectPath,
      bytes: validation.bytes,
      mimeType: validation.mimeType,
      fileName: file.name,
    });
    if ("error" in stored) {
      errors.push(stored.error);
      continue;
    }
    const saved = await addListingImages(listingId, [
      { url: stored.url, storage_path: stored.path, mime_type: stored.mimeType, file_size: stored.size },
    ]);
    if (!saved.ok) errors.push(saved.error ?? "Could not attach that photo.");
    else uploaded += 1;
  }

  return { uploaded, errors };
}

function collectImages(formData: FormData): File[] {
  return formData
    .getAll("images")
    .filter((entry): entry is File => typeof entry === "object" && entry !== null && "size" in entry && entry.size > 0);
}

export async function createListingAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/listings/new");
  const parsed = parseListing(formData);

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const listing = await createListing(user.id, {
    ...parsed.data,
    category_id: parsed.data.category_id ?? null,
    description: parsed.data.description ?? null,
    crop_name: parsed.data.crop_name ?? null,
    quantity: parsed.data.quantity ?? null,
    unit: parsed.data.unit ?? null,
    price_per_unit: parsed.data.price_per_unit ?? null,
    village: parsed.data.village ?? null,
    district: parsed.data.district ?? null,
    state: parsed.data.state ?? "Andhra Pradesh",
    pincode: parsed.data.pincode ?? null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    harvest_date: parsed.data.harvest_date ?? null,
    available_from: parsed.data.available_from ?? null,
    available_until: parsed.data.available_until ?? null,
    contact_phone: parsed.data.contact_phone ?? null,
  });

  if (!listing.ok || !listing.id) {
    return actionError(listing.error ?? "Could not publish that listing.");
  }

  // Machinery listings carry a 1:1 machinery detail row (required by the schema).
  if (parsed.data.kind === "machinery") {
    const machinery = machinerySchema.safeParse({
      machine_type: formValue(formData, "machine_type") || "tractor",
      brand: formValue(formData, "brand"),
      model: formValue(formData, "model"),
      manufacture_year: formNumber(formData, "manufacture_year"),
      horsepower: formNumber(formData, "horsepower"),
      rental_price_per_day: formNumber(formData, "rental_price_per_day"),
      rental_price_per_hour: formNumber(formData, "rental_price_per_hour"),
      rental_price_per_acre: formNumber(formData, "rental_price_per_acre"),
      with_operator: formBool(formData, "with_operator"),
      service_radius_km: formNumber(formData, "service_radius_km"),
      availability_start: formValue(formData, "availability_start"),
      availability_end: formValue(formData, "availability_end"),
      status: formValue(formData, "machine_status") || "available",
      description: formValue(formData, "description"),
    });

    if (!machinery.success) {
      return actionError("Please complete the machinery details.", {
        fieldErrors: fieldErrorsFrom(machinery.error.issues),
        listingId: listing.id,
      });
    }

    const created = await createMachinery(user.id, listing.id, {
      ...machinery.data,
      brand: machinery.data.brand ?? null,
      model: machinery.data.model ?? null,
      description: machinery.data.description ?? null,
      availability_start: machinery.data.availability_start ?? null,
      availability_end: machinery.data.availability_end ?? null,
    });
    if (!created.ok) {
      return actionError(created.error ?? "Machinery details could not be saved.", { listingId: listing.id });
    }
  }

  const images = collectImages(formData);
  let imageWarning: string | undefined;
  if (images.length > 0) {
    const { errors } = await storeListingImages(user.id, listing.id, images);
    if (errors.length) imageWarning = `Some photos were skipped: ${errors[0]}`;
  }

  revalidatePath("/market");
  revalidatePath("/listings/mine");
  revalidatePath("/dashboard");
  return actionOk("Listing published.", { listingId: listing.id, warning: imageWarning });
}

export async function updateListingAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/listings/mine");
  const listingId = formValue(formData, "listingId");
  if (!listingId) return actionError("That listing could not be found.");

  const parsed = parseListing(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await updateListing(user.id, listingId, {
    ...parsed.data,
    category_id: parsed.data.category_id ?? null,
  });
  if (!result.ok) return actionError(result.error ?? "Could not update that listing.");

  if (parsed.data.kind === "machinery") {
    await updateMachinery(user.id, listingId, {
      machine_type: (formValue(formData, "machine_type") || "tractor") as never,
      rental_price_per_day: formNumber(formData, "rental_price_per_day") ?? null,
      rental_price_per_hour: formNumber(formData, "rental_price_per_hour") ?? null,
      rental_price_per_acre: formNumber(formData, "rental_price_per_acre") ?? null,
      with_operator: formBool(formData, "with_operator"),
      status: (formValue(formData, "machine_status") || "available") as never,
    });
  }

  const images = collectImages(formData);
  if (images.length > 0) {
    await storeListingImages(user.id, listingId, images);
  }

  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  revalidatePath("/listings/mine");
  return actionOk("Listing updated.");
}

export async function setListingStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser("/listings/mine");
  const listingId = formValue(formData, "listingId");
  const status = formValue(formData, "status");
  if (listingId && ["draft", "active", "sold", "archived"].includes(status)) {
    await updateListing(user.id, listingId, { status: status as "draft" | "active" | "sold" | "archived" });
  }
  revalidatePath("/listings/mine");
  revalidatePath("/market");
}

export async function deleteListingAction(formData: FormData): Promise<void> {
  const user = await requireUser("/listings/mine");
  const listingId = formValue(formData, "listingId");
  if (!listingId) redirect("/listings/mine");

  const db = await getDataClient();
  const { data } = await db.from("listing_images").select("storage_path").eq("listing_id", listingId).limit(20);
  for (const row of (data ?? []) as Array<{ storage_path: string | null }>) {
    if (row.storage_path) {
      await removeObject("listing-images", row.storage_path);
    }
  }

  await deleteListing(user.id, listingId);
  revalidatePath("/listings/mine");
  revalidatePath("/market");
  redirect("/listings/mine?deleted=1");
}

export async function deleteListingImageAction(formData: FormData): Promise<void> {
  const user = await requireUser("/listings/mine");
  const listingId = formValue(formData, "listingId");
  const imageId = formValue(formData, "imageId");
  const storagePath = formValue(formData, "storagePath");
  if (listingId && imageId) {
    await deleteListingImage(listingId, imageId, user.id);
    if (storagePath) await removeObject("listing-images", storagePath);
  }
  revalidatePath(`/listings/${listingId}/edit`);
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const user = await requireUser("/market");
  const listingId = formValue(formData, "listingId");
  if (listingId) {
    await toggleFavorite(user.id, listingId);
  }
  revalidatePath("/market");
  revalidatePath(`/market/${listingId}`);
  revalidatePath("/favorites");
}

export async function reportListingAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/market");
  const parsed = reportSchema.safeParse({
    listingId: formValue(formData, "listingId"),
    reason: formValue(formData, "reason") || "other",
    details: formValue(formData, "details"),
  });

  if (!parsed.success) {
    return actionError("Please choose a reason.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const db = await getDataClient();
  const { data: listing } = await db
    .from("listings")
    .select("id,seller_id")
    .eq("id", parsed.data.listingId)
    .maybeSingle();

  const { error } = await db.from("reports").insert({
    reporter_id: user.id,
    listing_id: parsed.data.listingId,
    reported_user_id: (listing as { seller_id: string } | null)?.seller_id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });

  if (error) return actionError("The report could not be sent. Please try again.");

  await createNotification({
    userId: user.id,
    type: "system",
    title: "Report submitted",
    body: "Thank you. Our team will review this listing.",
    severity: "info",
  });

  return actionOk("Thank you. Our team will review this listing.");
}
