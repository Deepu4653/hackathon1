import { FolderTree, PlusCircle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextInput } from "@/components/forms";
import { saveCategoryAction, setCategoryActiveAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listAllCategories } from "@/lib/repos/categories";

export const metadata = { title: "Admin categories" };

export default async function AdminCategoriesPage() {
  const admin = await requireAdmin();
  const { t } = await getTranslatorForRequest(admin.profile.simple_mode);
  const categories = await listAllCategories();

  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <EmptyState icon={<FolderTree className="size-6" aria-hidden />} title={t("admin.noCategories")} />
      ) : (
        <Card>
          <CardHeader icon={<FolderTree className="size-5" aria-hidden />} title={t("admin.nav.categories")} subtitle={t("admin.categoriesSubtitle")} />
          <CardBody>
            <ul className="space-y-3">
              {categories.map((category) => (
                <li key={category.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-800">
                        {category.name_en}
                        <Badge tone="neutral">{t(`market.kind.${category.kind}` as never)}</Badge>
                        <Badge tone={category.is_active ? "green" : "neutral"}>
                          {category.is_active ? t("admin.active") : t("admin.inactive")}
                        </Badge>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {category.slug} · {category.name_te ?? "—"} · {category.name_hi ?? "—"} · #{category.sort_order}
                      </p>
                    </div>
                    <ActionForm action={setCategoryActiveAction} showMessage>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="active" value={category.is_active ? "false" : "true"} />
                      <SubmitButton variant="ghost">
                        {category.is_active ? t("admin.deactivate") : t("admin.activate")}
                      </SubmitButton>
                    </ActionForm>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-field-700">{t("common.edit")}</summary>
                    <div className="mt-2 border-t border-ink-100 pt-3">
                      <ActionForm action={saveCategoryAction} showMessage>
                            <input type="hidden" name="id" value={category.id} />
                            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <Label htmlFor={`slug-${category.id}`}>{t("admin.slug")}</Label>
                                <TextInput id={`slug-${category.id}`} name="slug" defaultValue={category.slug} required maxLength={60} />
                              </div>
                              <div>
                                <Label htmlFor={`name_en-${category.id}`}>{t("admin.nameEn")}</Label>
                                <TextInput id={`name_en-${category.id}`} name="name_en" defaultValue={category.name_en} required maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`name_te-${category.id}`}>{t("admin.nameTe")}</Label>
                                <TextInput id={`name_te-${category.id}`} name="name_te" defaultValue={category.name_te ?? ""} maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`name_hi-${category.id}`}>{t("admin.nameHi")}</Label>
                                <TextInput id={`name_hi-${category.id}`} name="name_hi" defaultValue={category.name_hi ?? ""} maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`kind-${category.id}`}>{t("market.form.kind")}</Label>
                                <Select id={`kind-${category.id}`} name="kind" defaultValue={category.kind}>
                                  <option value="produce">{t("market.kind.produce")}</option>
                                  <option value="input">{t("market.kind.input")}</option>
                                  <option value="machinery">{t("market.kind.machinery")}</option>
                                  <option value="service">{t("market.kind.service")}</option>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`sort-${category.id}`}>{t("admin.sortOrder")}</Label>
                                <TextInput
                                  id={`sort-${category.id}`}
                                  name="sort_order"
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  defaultValue={category.sort_order}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`icon-${category.id}`} hint={t("common.optional")}>
                                  {t("admin.icon")}
                                </Label>
                                <TextInput id={`icon-${category.id}`} name="icon" defaultValue={category.icon ?? ""} maxLength={40} />
                              </div>
                            </div>
                            <input type="hidden" name="is_active" value={category.is_active ? "true" : "false"} />
                            <div className="mt-3">
                              <SubmitButton variant="secondary">{t("common.save")}</SubmitButton>
                            </div>
                      </ActionForm>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader icon={<PlusCircle className="size-5" aria-hidden />} title={t("admin.addCategory")} subtitle={t("admin.categoriesSubtitle")} />
        <CardBody>
          <ActionForm action={saveCategoryAction} showMessage>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="slug">{t("admin.slug")}</Label>
                    <TextInput id="slug" name="slug" required maxLength={60} placeholder="vegetables" />
                  </div>
                  <div>
                    <Label htmlFor="name_en">{t("admin.nameEn")}</Label>
                    <TextInput id="name_en" name="name_en" required maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="name_te" hint={t("common.optional")}>
                      {t("admin.nameTe")}
                    </Label>
                    <TextInput id="name_te" name="name_te" maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="name_hi" hint={t("common.optional")}>
                      {t("admin.nameHi")}
                    </Label>
                    <TextInput id="name_hi" name="name_hi" maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="kind">{t("market.form.kind")}</Label>
                    <Select id="kind" name="kind" defaultValue="produce">
                      <option value="produce">{t("market.kind.produce")}</option>
                      <option value="input">{t("market.kind.input")}</option>
                      <option value="machinery">{t("market.kind.machinery")}</option>
                      <option value="service">{t("market.kind.service")}</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sort_order">{t("admin.sortOrder")}</Label>
                    <TextInput id="sort_order" name="sort_order" type="number" min={0} inputMode="numeric" defaultValue={100} />
                  </div>
                </div>
                <input type="hidden" name="is_active" value="true" />
                <div className="mt-3">
                  <SubmitButton dataPrimary>{t("admin.addCategory")}</SubmitButton>
                </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
