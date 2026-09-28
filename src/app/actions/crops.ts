"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createCropRecord, deleteCropRecord, updateCropRecord } from "@/lib/repos/crops";
import { createSoilRecord, deleteSoilRecord, updateSoilRecord } from "@/lib/repos/soil";
import { actionError, actionOk, fieldErrorsFrom, formNumber, formValue, type ActionState } from "@/lib/actions/state";
import { cropRecordSchema, soilSchema } from "@/lib/validation/schemas";

function parseCrop(formData: FormData) {
  return cropRecordSchema.safeParse({
    crop_name: formValue(formData, "crop_name"),
    crop_id: formValue(formData, "crop_id") || undefined,
    farm_id: formValue(formData, "farm_id") || undefined,
    season: formValue(formData, "season") || "kharif",
    variety: formValue(formData, "variety"),
    area_acres: formNumber(formData, "area_acres"),
    sowing_date: formValue(formData, "sowing_date"),
    expected_harvest_date: formValue(formData, "expected_harvest_date"),
    status: formValue(formData, "status") || "planned",
    notes: formValue(formData, "notes"),
  });
}

export async function createCropRecordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/crops");
  const parsed = parseCrop(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await createCropRecord(user.id, {
    ...parsed.data,
    crop_id: parsed.data.crop_id ?? null,
    farm_id: parsed.data.farm_id ?? null,
    variety: parsed.data.variety ?? null,
    area_acres: parsed.data.area_acres ?? null,
    sowing_date: parsed.data.sowing_date ?? null,
    expected_harvest_date: parsed.data.expected_harvest_date ?? null,
    notes: parsed.data.notes ?? null,
  });

  if (!result.ok) return actionError(result.error ?? "Could not save that crop.");
  revalidatePath("/crops");
  revalidatePath("/dashboard");
  return actionOk("Crop added.");
}

export async function updateCropRecordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/crops");
  const recordId = formValue(formData, "recordId");
  if (!recordId) return actionError("That crop record could not be found.");

  const parsed = parseCrop(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await updateCropRecord(user.id, recordId, {
    ...parsed.data,
    crop_id: parsed.data.crop_id ?? null,
    farm_id: parsed.data.farm_id ?? null,
  });
  if (!result.ok) return actionError(result.error ?? "Could not update that crop.");

  revalidatePath("/crops");
  revalidatePath("/dashboard");
  return actionOk("Crop updated.");
}

export async function deleteCropRecordAction(formData: FormData): Promise<void> {
  const user = await requireUser("/crops");
  const recordId = formValue(formData, "recordId");
  if (recordId) await deleteCropRecord(user.id, recordId);
  revalidatePath("/crops");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Soil
// ---------------------------------------------------------------------------

function parseSoil(formData: FormData) {
  return soilSchema.safeParse({
    soil_type: formValue(formData, "soil_type"),
    farm_id: formValue(formData, "farm_id") || undefined,
    ph: formNumber(formData, "ph"),
    nitrogen: formNumber(formData, "nitrogen"),
    phosphorus: formNumber(formData, "phosphorus"),
    potassium: formNumber(formData, "potassium"),
    moisture_pct: formNumber(formData, "moisture_pct"),
    organic_matter_pct: formNumber(formData, "organic_matter_pct"),
    electrical_conductivity: formNumber(formData, "electrical_conductivity"),
    source: formValue(formData, "source") || "manual",
    dataset_name: formValue(formData, "dataset_name"),
    dataset_reference: formValue(formData, "dataset_reference"),
    measured_at: formValue(formData, "measured_at"),
    village: formValue(formData, "village"),
    district: formValue(formData, "district"),
    state: formValue(formData, "state") || "Andhra Pradesh",
    notes: formValue(formData, "notes"),
  });
}

export async function createSoilRecordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/soil");
  const parsed = parseSoil(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await createSoilRecord(user.id, {
    ...parsed.data,
    farm_id: parsed.data.farm_id ?? null,
  });
  if (!result.ok) return actionError(result.error ?? "Could not save those soil values.");

  revalidatePath("/soil");
  revalidatePath("/dashboard");
  return actionOk("Soil record saved.");
}

export async function updateSoilRecordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/soil");
  const recordId = formValue(formData, "recordId");
  if (!recordId) return actionError("That soil record could not be found.");

  const parsed = parseSoil(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  const result = await updateSoilRecord(user.id, recordId, parsed.data);
  if (!result.ok) return actionError(result.error ?? "Could not update those soil values.");

  revalidatePath("/soil");
  return actionOk("Soil record updated.");
}

export async function deleteSoilRecordAction(formData: FormData): Promise<void> {
  const user = await requireUser("/soil");
  const recordId = formValue(formData, "recordId");
  if (recordId) await deleteSoilRecord(user.id, recordId);
  revalidatePath("/soil");
  revalidatePath("/dashboard");
}
