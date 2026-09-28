"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createFarm, deleteFarm, updateFarm } from "@/lib/repos/farms";
import { actionError, actionOk, fieldErrorsFrom, formBool, formNumber, formValue, type ActionState } from "@/lib/actions/state";
import { farmSchema } from "@/lib/validation/schemas";

function parseFarm(formData: FormData) {
  return farmSchema.safeParse({
    name: formValue(formData, "name"),
    size_acres: formNumber(formData, "size_acres"),
    soil_type: formValue(formData, "soil_type"),
    irrigation_source: formValue(formData, "irrigation_source"),
    village: formValue(formData, "village"),
    district: formValue(formData, "district"),
    state: formValue(formData, "state") || "Andhra Pradesh",
    pincode: formValue(formData, "pincode"),
    latitude: formNumber(formData, "latitude"),
    longitude: formNumber(formData, "longitude"),
    is_primary: formBool(formData, "is_primary"),
    notes: formValue(formData, "notes"),
  });
}

export async function createFarmAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/farms");
  const parsed = parseFarm(formData);

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await createFarm(user.id, {
    ...parsed.data,
    is_primary: parsed.data.is_primary ?? false,
  });

  if (!result.ok) return actionError(result.error ?? "Could not save that farm.");

  revalidatePath("/farms");
  revalidatePath("/dashboard");
  return actionOk("Farm saved.", { farmId: result.id });
}

export async function updateFarmAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/farms");
  const farmId = formValue(formData, "farmId");
  if (!farmId) return actionError("That farm could not be found.");

  const parsed = parseFarm(formData);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await updateFarm(user.id, farmId, parsed.data);
  if (!result.ok) return actionError(result.error ?? "Could not update that farm.");

  revalidatePath("/farms");
  revalidatePath("/dashboard");
  return actionOk("Farm updated.");
}

export async function deleteFarmAction(formData: FormData): Promise<void> {
  const user = await requireUser("/farms");
  const farmId = formValue(formData, "farmId");
  if (farmId) {
    await deleteFarm(user.id, farmId);
  }
  revalidatePath("/farms");
  revalidatePath("/dashboard");
  redirect("/farms?deleted=1");
}

export async function setPrimaryFarmAction(formData: FormData): Promise<void> {
  const user = await requireUser("/farms");
  const farmId = formValue(formData, "farmId");
  if (farmId) {
    await updateFarm(user.id, farmId, { is_primary: true });
  }
  revalidatePath("/farms");
  revalidatePath("/dashboard");
  redirect("/farms");
}
