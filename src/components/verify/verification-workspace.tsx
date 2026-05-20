"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Dices, FileText, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import {
  checklistCardClassName,
  destructiveIconButtonClassName,
  fixedFooterSafeAreaClassName,
  formFieldClassName,
  primaryCtaClassName,
  scrollablePanelBodyClassName,
  secondaryButtonClassName,
} from "@/components/ui/fixed-action-layout";
import {
  MAX_CUSTOM_CONTEXT_ENTRIES,
  COUNTRY_OPTIONS,
  PRIORITY_OPTIONS,
  PRODUCT_OPTIONS,
  SEGMENT_OPTIONS,
  VERIFICATION_TYPE_OPTIONS,
  defaultSessionContext,
  sessionContextSchema,
  type SessionContextInput,
} from "@/lib/verification";
import { saveVerificationDraft } from "@/lib/verification-draft";

type Viewer = {
  email: string | null;
  demoAccountId: string | null;
};

type OptionalField = "scenario" | "country" | "product" | "segment" | "priority" | "email" | "custom";
type OptionalContextGroup = "business" | "routing" | "email" | "custom";

const OPTIONAL_CONTEXT_GROUPS: Array<{ id: OptionalContextGroup; label: string }> = [
  { id: "business", label: "Contexte métier" },
  { id: "routing", label: "Contexte routage" },
  { id: "email", label: "Email" },
  { id: "custom", label: "Contexte libre" },
];

const GROUP_FIELDS: Record<OptionalContextGroup, OptionalField[]> = {
  business: ["country", "product", "segment"],
  routing: ["scenario", "priority"],
  email: ["email"],
  custom: ["custom"],
};

function getFieldError(errors: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const message = errors[key];
    if (message) {
      return message;
    }
  }

  return null;
}

function isGroupActive(group: OptionalContextGroup, activeFields: Record<OptionalField, boolean>): boolean {
  return GROUP_FIELDS[group].some((field) => activeFields[field]);
}

const EXTERNAL_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXTERNAL_ID_PREFIX = "KYCLY_";

function generateExternalId(length = 8): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  return EXTERNAL_ID_PREFIX + Array.from(randomBytes, (value) => EXTERNAL_ID_ALPHABET[value & 31]).join("");
}

export function VerificationWorkspace({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<SessionContextInput>(() => ({
    ...defaultSessionContext,
    notificationEmail: "",
    notificationPhone: "",
    priority: "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeFields, setActiveFields] = useState<Record<OptionalField, boolean>>({
    scenario: false,
    country: false,
    product: false,
    segment: false,
    priority: false,
    email: false,
    custom: false,
  });

  const hasAdvancedCapacity = form.customContextEntries.length < MAX_CUSTOM_CONTEXT_ENTRIES;
  const hasOptionalFieldsVisible = Object.values(activeFields).some(Boolean);
  const hasInlineErrors = Object.keys(errors).length > 0;

  function scrollContextBodyToBottom() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;

        if (!container) {
          return;
        }

        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    });
  }

  function updateVerificationType(value: SessionContextInput["verificationType"]) {
    setForm((current) => ({
      ...current,
      scenario: value,
      verificationType: value,
    }));
  }

  function clearFieldErrors(keys: string[]) {
    setErrors((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !keys.some((candidate) => key === candidate || key.startsWith(`${candidate}.`)),
      );

      return Object.fromEntries(nextEntries);
    });
  }

  function activateField(field: OptionalField) {
    setActiveFields((current) => ({
      ...current,
      [field]: true,
    }));

    if (field === "email") {
      setForm((current) => ({
        ...current,
        notificationEmail: current.notificationEmail || viewer.email || "",
      }));
    }

    if (field === "custom") {
      setForm((current) => ({
        ...current,
        customContextEntries:
          current.customContextEntries.length > 0 ? current.customContextEntries : [{ key: "", value: "" }],
      }));
    }
  }

  function activateGroup(group: OptionalContextGroup) {
    for (const field of GROUP_FIELDS[group]) {
      activateField(field);
    }

    scrollContextBodyToBottom();
  }

  function deactivateField(field: OptionalField) {
    setActiveFields((current) => ({
      ...current,
      [field]: false,
    }));

    setForm((current) => {
      switch (field) {
        case "scenario":
          return {
            ...current,
            scenario: "onboarding",
            verificationType: "onboarding",
          };
        case "country":
          return {
            ...current,
            country: "",
            countryOther: "",
          };
        case "product":
          return {
            ...current,
            product: "",
            productOther: "",
          };
        case "segment":
          return {
            ...current,
            segment: "",
          };
        case "priority":
          return {
            ...current,
            priority: "",
          };
        case "email":
          return {
            ...current,
            notificationEmail: "",
          };
        case "custom":
          return {
            ...current,
            customContextEntries: [],
          };
        default:
          return current;
      }
    });

    switch (field) {
      case "scenario":
        clearFieldErrors(["scenario", "verificationType"]);
        break;
      case "country":
        clearFieldErrors(["country", "countryOther"]);
        break;
      case "product":
        clearFieldErrors(["product", "productOther"]);
        break;
      case "segment":
        clearFieldErrors(["segment"]);
        break;
      case "priority":
        clearFieldErrors(["priority"]);
        break;
      case "email":
        clearFieldErrors(["notificationEmail"]);
        break;
      case "custom":
        clearFieldErrors(["customContextEntries"]);
        break;
    }
  }

  function deactivateGroup(group: OptionalContextGroup) {
    for (const field of GROUP_FIELDS[group]) {
      deactivateField(field);
    }
  }

  function addCustomContextEntry() {
    if (!hasAdvancedCapacity) {
      return;
    }

    setForm((current) => ({
      ...current,
      customContextEntries: [...current.customContextEntries, { key: "", value: "" }],
    }));
  }

  function updateCustomContextEntry(index: number, field: "key" | "value", value: string) {
    setForm((current) => ({
      ...current,
      customContextEntries: current.customContextEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  function removeCustomContextEntry(index: number) {
    setForm((current) => ({
      ...current,
      customContextEntries: current.customContextEntries.filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function updateField<Key extends keyof SessionContextInput>(key: Key, value: SessionContextInput[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleGenerateReferenceClient() {
    const nextValue = generateExternalId();

    setForm((current) => ({
      ...current,
      referenceClient: nextValue,
    }));

    clearFieldErrors(["referenceClient"]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const notificationPhone = form.notificationPhone?.trim() ?? "";
    const notificationEmail = form.notificationEmail?.trim() ?? "";

    const notificationChannel: SessionContextInput["notificationChannel"] = notificationPhone.length > 0
      ? "sms"
      : notificationEmail.length > 0
        ? "email"
        : "";

    const parsed = sessionContextSchema.safeParse({
      ...form,
      notificationChannel,
    });

    if (!parsed.success) {
      const nextErrors = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.length > 0 ? issue.path.join(".") : "form", issue.message]),
      );
      setErrors(nextErrors);
      setSubmitting(false);
      return;
    }

    setErrors({});

    try {
      saveVerificationDraft(parsed.data);
      router.push("/verify/prepare");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Creation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedScreenShell
      backHref="/welcome"
      preferBackHref
      title="Contexte"
      maxWidthClassName="sm:max-w-[430px]"
      lockViewportScroll
      panelClassName="flex h-full flex-col gap-4 !pt-0"
    >
      <form className="flex h-full min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div ref={scrollContainerRef} data-testid="session-context-scroll-body" className={[scrollablePanelBodyClassName, "pt-1"].join(" ")}>
        <div className="mb-5 flex animate-fade-in flex-col items-center justify-center text-center">
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-light)]">
            <FileText className="h-7 w-7 text-brand" strokeWidth={1.7} aria-hidden="true" />
            <div className="absolute -right-1 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
              <ShieldCheck className="h-4 w-4 text-green-500" aria-hidden="true" />
            </div>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Contexte de vérification</h2>
          <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
            Préparez seulement les informations utiles au lancement du parcours.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface-light)] px-4 py-5 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <span className="font-medium">External ID</span>
              <div className="flex items-center gap-2">
                <input
                  className={formFieldClassName({ hasError: Boolean(errors.referenceClient) })}
                  maxLength={128}
                  placeholder="cust_0042"
                  value={form.referenceClient}
                  onChange={(event) => updateField("referenceClient", event.target.value)}
                />
                <button
                  type="button"
                  onClick={handleGenerateReferenceClient}
                  aria-label="Générer un external ID"
                  title="Générer un external ID"
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition hover:bg-white"
                >
                  <Dices className="size-5" aria-hidden="true" />
                </button>
              </div>
              {errors.referenceClient ? <p className="text-sm text-red-600">{errors.referenceClient}</p> : null}
            </label>

            <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <span className="font-medium">Notification SMS</span>
              <input
                className={formFieldClassName({ hasError: Boolean(errors.notificationPhone) })}
                placeholder="+221771234567"
                value={form.notificationPhone}
                onChange={(event) => updateField("notificationPhone", event.target.value)}
              />
              {errors.notificationPhone ? <p className="text-sm text-red-600">{errors.notificationPhone}</p> : null}
            </label>
          </div>

          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Besoins optionnels</p>
            <div className="grid gap-2">
              {OPTIONAL_CONTEXT_GROUPS.map(({ id, label }) => {
                const checked = isGroupActive(id, activeFields);

                return (
                  <label
                    key={id}
                    className={checklistCardClassName}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          activateGroup(id);
                          return;
                        }

                        deactivateGroup(id);
                      }}
                      className="h-4 w-4 rounded border-[var(--border)] text-brand focus:ring-brand"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {hasOptionalFieldsVisible ? (
            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              {isGroupActive("business", activeFields) ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Contexte métier</p>
                    <button
                      type="button"
                      onClick={() => deactivateGroup("business")}
                      className={destructiveIconButtonClassName}
                      aria-label="Supprimer le contexte métier"
                      title="Supprimer le contexte métier"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-3">
                    <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium">Pays</span>
                      <select
                        className={formFieldClassName({ hasError: Boolean(errors.country) || Boolean(errors.countryOther) })}
                        value={form.country}
                        onChange={(event) => updateField("country", event.target.value as SessionContextInput["country"])}
                      >
                        <option value="">Sélectionner</option>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {form.country === "OTHER" ? (
                      <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                        <span className="font-medium">Pays (autre)</span>
                        <input
                          className={formFieldClassName({ hasError: Boolean(errors.countryOther) })}
                          placeholder="Pays"
                          value={form.countryOther}
                          onChange={(event) => updateField("countryOther", event.target.value)}
                        />
                      </label>
                    ) : null}

                    <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium">Produit</span>
                      <select
                        className={formFieldClassName({ hasError: Boolean(errors.product) || Boolean(errors.productOther) })}
                        value={form.product}
                        onChange={(event) => updateField("product", event.target.value as SessionContextInput["product"])}
                      >
                        <option value="">Sélectionner</option>
                        {PRODUCT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {form.product === "other" ? (
                      <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                        <span className="font-medium">Produit (autre)</span>
                        <input
                          className={formFieldClassName({ hasError: Boolean(errors.productOther) })}
                          placeholder="Produit"
                          value={form.productOther}
                          onChange={(event) => updateField("productOther", event.target.value)}
                        />
                      </label>
                    ) : null}

                    <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium">Segment</span>
                      <select
                        className={formFieldClassName({ hasError: Boolean(errors.segment) })}
                        value={form.segment}
                        onChange={(event) => updateField("segment", event.target.value as SessionContextInput["segment"])}
                      >
                        <option value="">Sélectionner</option>
                        {SEGMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {getFieldError(errors, ["country", "countryOther", "product", "productOther", "segment"]) ? (
                    <p className="text-sm text-red-600">
                      {getFieldError(errors, ["country", "countryOther", "product", "productOther", "segment"])}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isGroupActive("routing", activeFields) ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Contexte routage</p>
                    <button
                      type="button"
                      onClick={() => deactivateGroup("routing")}
                      className={destructiveIconButtonClassName}
                      aria-label="Supprimer le contexte routage"
                      title="Supprimer le contexte routage"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-3">
                    <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium">Scénario</span>
                      <select
                        className={formFieldClassName({ hasError: Boolean(errors.verificationType) })}
                        value={form.verificationType}
                        onChange={(event) => updateVerificationType(event.target.value as SessionContextInput["verificationType"])}
                      >
                        {VERIFICATION_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <span className="font-medium">Priorité</span>
                      <select
                        className={formFieldClassName({ hasError: Boolean(errors.priority) })}
                        value={form.priority}
                        onChange={(event) => updateField("priority", event.target.value as SessionContextInput["priority"])}
                      >
                        <option value="">Sélectionner</option>
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {getFieldError(errors, ["verificationType", "priority"]) ? (
                    <p className="text-sm text-red-600">{getFieldError(errors, ["verificationType", "priority"])} </p>
                  ) : null}
                </div>
              ) : null}

              {isGroupActive("email", activeFields) ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Email</p>
                    <button
                      type="button"
                      onClick={() => deactivateGroup("email")}
                      className={destructiveIconButtonClassName}
                      aria-label="Supprimer l'email"
                      title="Supprimer l'email"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <label className="space-y-2 text-sm text-[var(--muted-foreground)]">
                    <input
                      className={formFieldClassName({ hasError: Boolean(errors.notificationEmail) })}
                      placeholder="demo.user@example.com"
                      type="email"
                      value={form.notificationEmail}
                      onChange={(event) => updateField("notificationEmail", event.target.value)}
                    />
                    {errors.notificationEmail ? <p className="text-sm text-red-600">{errors.notificationEmail}</p> : null}
                  </label>
                </div>
              ) : null}

              {isGroupActive("custom", activeFields) ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Contexte libre</p>
                    <button
                      type="button"
                      onClick={() => deactivateGroup("custom")}
                      className={destructiveIconButtonClassName}
                      aria-label="Supprimer le contexte libre"
                      title="Supprimer le contexte libre"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.customContextEntries.map((entry, index) => (
                      <div key={`${index}-${entry.key}`} className="grid gap-3">
                        <input
                          className={formFieldClassName({ hasError: Boolean(errors[`customContextEntries.${index}.key`]) })}
                          placeholder="Clé"
                          value={entry.key}
                          onChange={(event) => updateCustomContextEntry(index, "key", event.target.value)}
                        />
                        <input
                          className={formFieldClassName({ hasError: Boolean(errors[`customContextEntries.${index}.value`]) })}
                          placeholder="Valeur"
                          value={entry.value}
                          onChange={(event) => updateCustomContextEntry(index, "value", event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomContextEntry(index)}
                          className={destructiveIconButtonClassName}
                          aria-label="Supprimer cette paire"
                          title="Supprimer cette paire"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {getFieldError(errors, ["customContextEntries.0.key", "customContextEntries.0.value", "customContextEntries"]) ? (
                    <p className="text-sm text-red-600">
                      {getFieldError(errors, ["customContextEntries.0.key", "customContextEntries.0.value", "customContextEntries"])}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={addCustomContextEntry}
                    disabled={!hasAdvancedCapacity}
                    className={secondaryButtonClassName}
                  >
                    <Plus className="size-4" />
                    Ajouter une paire
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>

        {hasInlineErrors ? (
          <div className="mt-4 shrink-0 animate-shake rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Vérifiez les champs avant de continuer.
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-4 flex shrink-0 animate-shake items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {submitError}
          </div>
        ) : null}

        <div className={fixedFooterSafeAreaClassName}>
          <button
            type="submit"
            disabled={submitting}
            className={[primaryCtaClassName, "inline-flex"].join(" ")}
          >
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {submitting ? "Création de la session..." : "Créer la session"}
          </button>
        </div>
      </form>
    </ProtectedScreenShell>
  );
}