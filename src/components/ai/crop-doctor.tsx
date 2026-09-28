"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, ImagePlus, Loader2, ShieldCheck, Sparkles, Stethoscope, X } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader } from "@/components/ui";
import { FieldError, FormMessage, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { useI18n } from "@/lib/i18n/provider";
import type { ActionState } from "@/lib/actions/state";
import { analyseCropImageAction } from "@/app/actions/ai";

interface AnalysisResult {
  possibleProblem: string;
  visibleSymptoms: string[];
  confidence: "low" | "medium" | "high";
  severity: "low" | "moderate" | "high" | "unknown";
  nextSteps: string[];
  prevention: string[];
  uncertaintyNote: string;
  isPlantImage: boolean;
}

const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

export function CropDoctorUploader({
  configured,
  farms,
}: {
  configured: boolean;
  farms: Array<{ id: string; name: string }>;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    analyseCropImageAction,
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const result = (state?.result as AnalysisResult | undefined) ?? null;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(file: File | null) {
    setLocalError(null);
    if (!file) {
      setPreview(null);
      setFileName(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setLocalError(t("doctor.invalidType"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PREVIEW_BYTES) {
      setLocalError(t("doctor.tooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
  }

  const confidenceTone = result?.confidence === "high" ? "green" : result?.confidence === "medium" ? "amber" : "neutral";
  const severityTone = result?.severity === "high" ? "red" : result?.severity === "moderate" ? "amber" : "neutral";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <CardHeader icon={<Stethoscope className="size-5" aria-hidden />} title={t("doctor.upload")} subtitle={t("doctor.subtitle")} />
        <CardBody>
          <form action={formAction} className="space-y-4">
            <FormMessage state={state} />

            <div
              className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${
                preview ? "border-field-300 bg-field-50" : "border-ink-200 bg-ink-50/50"
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0] ?? null;
                if (file && fileInputRef.current) {
                  const transfer = new DataTransfer();
                  transfer.items.add(file);
                  fileInputRef.current.files = transfer.files;
                  handleFile(file);
                }
              }}
            >
              {preview ? (
                <div className="relative mx-auto max-w-xs">
                  <Image
                    src={preview}
                    alt={t("doctor.preview")}
                    width={640}
                    height={480}
                    unoptimized
                    className="mx-auto max-h-64 w-auto rounded-xl object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (preview) URL.revokeObjectURL(preview);
                      setPreview(null);
                      setFileName(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label={t("doctor.removePhoto")}
                    className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 shadow"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="py-6">
                  <ImagePlus className="mx-auto mb-2 size-8 text-field-500" aria-hidden />
                  <p className="text-sm text-ink-500">{t("doctor.dropHint")}</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                id="image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                required
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:border-field-300"
              >
                <Camera className="size-4" aria-hidden />
                {fileName ? t("doctor.changePhoto") : t("doctor.choosePhoto")}
              </button>
              {fileName ? <p className="mt-2 truncate text-xs text-ink-500">{fileName}</p> : null}
            </div>

            <FieldError>{localError ?? state?.fieldErrors?.image}</FieldError>

            <p className="flex items-start gap-1.5 text-xs text-ink-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t("doctor.imageStoredPrivately")}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cropName" hint={t("common.optional")}>
                  {t("doctor.cropName")}
                </Label>
                <TextInput id="cropName" name="cropName" maxLength={80} placeholder={t("crops.name")} />
              </div>
              <div>
                <Label htmlFor="farmId" hint={t("common.optional")}>
                  {t("nav.farms")}
                </Label>
                <Select id="farmId" name="farmId" defaultValue="">
                  <option value="">{t("ai.noFarmContext")}</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" hint={t("common.optional")}>
                {t("doctor.notes")}
              </Label>
              <TextArea id="notes" name="notes" rows={2} maxLength={300} placeholder={t("doctor.notesHint")} />
            </div>

            <SubmitButton dataPrimary disabled={!configured || pending} className="w-full" pendingLabel={t("doctor.analyzing")}>
              <Sparkles className="size-4" aria-hidden />
              {t("doctor.analyze")}
            </SubmitButton>

            {!configured ? <Callout tone="warning" title={t("ai.notConfigured")} /> : null}
          </form>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {pending ? (
          <Card>
            <CardBody className="flex items-center gap-3 text-sm text-ink-600">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("doctor.analyzing")}
            </CardBody>
          </Card>
        ) : null}

        {result ? (
          <Card>
            <CardHeader
              icon={<Stethoscope className="size-5" aria-hidden />}
              title={t("doctor.result")}
              action={
                <div className="flex gap-1.5">
                  <Badge tone={confidenceTone}>{t("doctor.confidence")}: {t(`doctor.confidence.${result.confidence}` as never)}</Badge>
                  <Badge tone={severityTone}>{t("doctor.severity")}: {t(`doctor.severity.${result.severity}` as never)}</Badge>
                </div>
              }
            />
            <CardBody className="space-y-4">
              {!result.isPlantImage ? (
                <Callout tone="warning" title={t("doctor.notAPlant")}>
                  {result.possibleProblem}
                </Callout>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("doctor.possibleProblem")}</p>
                    <p className="mt-1 text-base font-semibold text-ink-900">{result.possibleProblem}</p>
                  </div>

                  {result.visibleSymptoms.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("doctor.symptoms")}</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {result.visibleSymptoms.map((symptom) => (
                          <li key={symptom} className="flex gap-2 text-sm text-ink-700">
                            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-soil-500" />
                            {symptom}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {result.nextSteps.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("doctor.nextSteps")}</p>
                      <ol className="mt-1.5 space-y-1.5">
                        {result.nextSteps.map((step, index) => (
                          <li key={step} className="flex gap-2 text-sm text-ink-700">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-field-100 text-[0.65rem] font-bold text-field-800">
                              {index + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {result.prevention.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("doctor.prevention")}</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {result.prevention.map((item) => (
                          <li key={item} className="flex gap-2 text-sm text-ink-700">
                            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-field-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}

              {result.uncertaintyNote ? (
                <Callout tone="info" title={t("doctor.uncertainty")}>
                  {result.uncertaintyNote}
                </Callout>
              ) : null}

              <Callout tone="warning" title={t("doctor.notADiagnosis")}>
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("doctor.disclaimer")}
                </span>
              </Callout>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="space-y-2 text-sm leading-relaxed text-ink-600">
              <p className="font-semibold text-ink-800">{t("doctor.tipsTitle")}</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>{t("doctor.tip1")}</li>
                <li>{t("doctor.tip2")}</li>
                <li>{t("doctor.tip3")}</li>
              </ul>
              <p className="text-xs text-ink-500">{t("doctor.disclaimer")}</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
