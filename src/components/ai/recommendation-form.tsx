"use client";

import { useActionState, useEffect, useRef } from "react";
import { Droplets, Lightbulb, Ruler, Sprout, TrendingUp } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, DataRow } from "@/components/ui";
import { FieldError, FormMessage, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import type { ActionState } from "@/lib/actions/state";
import { recommendCropsAction } from "@/app/actions/ai";

interface RecommendationItem {
  cropName: string;
  suitability: "best" | "good" | "possible";
  reasoning: string;
  considerations: string[];
  growingInfo: {
    season: string;
    durationDays: string;
    waterNeed: string;
    sowingWindow: string;
    spacingOrSeedRate?: string;
  };
}

interface RecommendationResult {
  recommendations: RecommendationItem[];
  generalAdvice: string;
  uncertainties: string[];
}

export function CropRecommender({
  configured,
  defaults,
}: {
  configured: boolean;
  defaults: {
    location: string;
    soilType: string;
    ph: string;
    water: string;
    farmSize: string;
    previousCrop: string;
    language: string;
  };
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(recommendCropsAction, null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);

  const result = (state?.result as RecommendationResult | undefined) ?? null;

  useEffect(() => {
    if (result) resultCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const suitabilityTone = (value: RecommendationItem["suitability"]) =>
    value === "best" ? "green" : value === "good" ? "amber" : "neutral";

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardHeader icon={<Lightbulb className="size-5" aria-hidden />} title={t("recommend.title")} subtitle={t("recommend.subtitle")} />
        <CardBody>
          <form action={formAction} className="space-y-3.5">
            <FormMessage state={state} />
            {!configured ? <Callout tone="warning" title={t("ai.notConfigured")} /> : null}

            <div>
              <Label htmlFor="location">{t("recommend.location")}</Label>
              <TextInput id="location" name="location" required defaultValue={defaults.location} maxLength={120} />
              <FieldError>{state?.fieldErrors?.location}</FieldError>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="season">{t("recommend.season")}</Label>
                <Select id="season" name="season" defaultValue="kharif">
                  <option value="kharif">{t("crops.season.kharif")}</option>
                  <option value="rabi">{t("crops.season.rabi")}</option>
                  <option value="zaid">{t("crops.season.zaid")}</option>
                  <option value="perennial">{t("crops.season.perennial")}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="water_availability">{t("recommend.water")}</Label>
                <Select id="water_availability" name="water_availability" defaultValue={defaults.water}>
                  <option value="low">{t("recommend.water.low")}</option>
                  <option value="medium">{t("recommend.water.medium")}</option>
                  <option value="high">{t("recommend.water.high")}</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="soil_type">{t("recommend.soilType")}</Label>
                <Select id="soil_type" name="soil_type" defaultValue={defaults.soilType}>
                  <option value="">{t("recommend.soilUnknown")}</option>
                  <option value="black">{t("soil.type.black")}</option>
                  <option value="red">{t("soil.type.red")}</option>
                  <option value="loamy">{t("soil.type.loamy")}</option>
                  <option value="sandy">{t("soil.type.sandy")}</option>
                  <option value="clay">{t("soil.type.clay")}</option>
                  <option value="alluvial">{t("soil.type.alluvial")}</option>
                  <option value="laterite">{t("soil.type.laterite")}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ph" hint={t("common.optional")}>
                  {t("recommend.ph")}
                </Label>
                <TextInput id="ph" name="ph" type="number" step="0.1" min={0} max={14} inputMode="decimal" defaultValue={defaults.ph} />
                <FieldError>{state?.fieldErrors?.ph}</FieldError>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="farm_size_acres" hint={t("common.optional")}>
                  {t("recommend.farmSize")}
                </Label>
                <TextInput id="farm_size_acres" name="farm_size_acres" type="number" step="0.1" min={0} inputMode="decimal" defaultValue={defaults.farmSize} />
              </div>
              <div>
                <Label htmlFor="previous_crop" hint={t("common.optional")}>
                  {t("recommend.previousCrop")}
                </Label>
                <TextInput id="previous_crop" name="previous_crop" maxLength={80} defaultValue={defaults.previousCrop} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="preference">{t("recommend.preference")}</Label>
                <Select id="preference" name="preference" defaultValue="any">
                  <option value="any">{t("recommend.preference.any")}</option>
                  <option value="food">{t("recommend.preference.food")}</option>
                  <option value="cash">{t("recommend.preference.cash")}</option>
                  <option value="pulse">{t("recommend.preference.pulse")}</option>
                  <option value="oilseed">{t("recommend.preference.oilseed")}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="language">{t("recommend.answerLanguage")}</Label>
                <Select id="language" name="language" defaultValue={defaults.language}>
                  {LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {LOCALE_LABELS[locale].native}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" hint={t("common.optional")}>
                {t("recommend.notes")}
              </Label>
              <TextArea id="notes" name="notes" rows={2} maxLength={400} placeholder={t("recommend.notesHint")} />
            </div>

            <SubmitButton dataPrimary disabled={!configured || pending} className="w-full" pendingLabel={t("recommend.working")}>
              <Sprout className="size-4" aria-hidden />
              {t("recommend.getAdvice")}
            </SubmitButton>
          </form>
        </CardBody>
      </Card>

      <div ref={resultCardRef} className="space-y-3">
        {result ? (
          <>
            <Callout tone="info" title={t("recommend.basedOn")}>
              {result.generalAdvice}
            </Callout>

            {result.recommendations.map((item) => (
              <Card key={item.cropName}>
                <CardHeader
                  title={item.cropName}
                  subtitle={t(`recommend.suitability.${item.suitability}` as never)}
                  action={<Badge tone={suitabilityTone(item.suitability)}>{t(`recommend.suitability.${item.suitability}` as never)}</Badge>}
                />
                <CardBody className="space-y-3">
                  <p className="text-sm leading-relaxed text-ink-700">{item.reasoning}</p>

                  <dl>
                    <DataRow label={t("recommend.season")} value={item.growingInfo.season} />
                    <DataRow label={t("recommend.duration")} value={item.growingInfo.durationDays} />
                    <DataRow label={t("recommend.waterNeed")} value={item.growingInfo.waterNeed} />
                    <DataRow label={t("recommend.sowingWindow")} value={item.growingInfo.sowingWindow} />
                    {item.growingInfo.spacingOrSeedRate ? (
                      <DataRow label={t("recommend.spacing")} value={item.growingInfo.spacingOrSeedRate} />
                    ) : null}
                  </dl>

                  {item.considerations.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{t("recommend.considerations")}</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {item.considerations.map((consideration) => (
                          <li key={consideration} className="flex gap-2 text-sm text-ink-700">
                            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-soil-500" />
                            {consideration}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ))}

            {result.uncertainties.length > 0 ? (
              <Callout tone="warning" title={t("doctor.uncertainty")}>
                <ul className="space-y-1">
                  {result.uncertainties.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <Callout tone="critical" title={t("recommend.noGuarantee")}>
              {t("recommend.disclaimer")}
            </Callout>
          </>
        ) : (
          <Card>
            <CardBody className="space-y-3 text-sm leading-relaxed text-ink-600">
              <p className="flex items-center gap-2 font-semibold text-ink-800">
                <TrendingUp className="size-4 text-field-600" aria-hidden />
                {t("recommend.howItWorks")}
              </p>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <Ruler className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {t("recommend.how1")}
                </li>
                <li className="flex gap-2">
                  <Droplets className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {t("recommend.how2")}
                </li>
                <li className="flex gap-2">
                  <Sprout className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  {t("recommend.how3")}
                </li>
              </ul>
              <Callout tone="critical" title={t("recommend.noGuarantee")}>
                {t("recommend.disclaimer")}
              </Callout>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
