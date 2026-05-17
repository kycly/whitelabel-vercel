"use client";

import { FormEvent, useMemo, useState } from "react";
import { KycLink } from "@kycly/link/react";
import type { KycLinkErrorPayload, KycLinkStep } from "@kycly/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BadgeCheck, ChevronDown, LoaderCircle, Plus, Shield, Trash2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  MAX_CUSTOM_CONTEXT_ENTRIES,
  COUNTRY_OPTIONS,
  NOTIFICATION_CHANNEL_OPTIONS,
  PRIORITY_OPTIONS,
  PRODUCT_OPTIONS,
  SEGMENT_OPTIONS,
  VERIFICATION_TYPE_OPTIONS,
  buildSessionMetadata,
  defaultSessionContext,
  sessionContextSchema,
  type SessionContextInput,
} from "@/lib/verification";

type CreatedSession = {
  sessionId: string;
  kyclinkUrl: string;
  expiresAt: string;
};

type Viewer = {
  email: string | null;
  demoAccountId: string | null;
};

const STEP_LABELS: Record<KycLinkStep, string> = {
  document_select: "Selection du document",
  document_scan: "Capture du document",
  liveness: "Verification de presence",
  completed: "Parcours termine",
};

const SCENARIO_DESCRIPTIONS: Record<SessionContextInput["scenario"], string> = {
  onboarding: "Demarrer un nouveau dossier client avec un point d'entree clair.",
  profile_update: "Mettre a jour un dossier deja existant avec moins de friction.",
  one_off_check: "Lancer une verification isolee hors parcours recurrent.",
  other: "Couvrir un cas hors preset tout en gardant un cadre guide.",
};

const VISIBLE_NOTIFICATION_CHANNELS = NOTIFICATION_CHANNEL_OPTIONS.filter((option) => option.value !== "push");

function inputClassName(hasError: boolean): string {
  return [
    "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
    hasError
      ? "border-red-300 ring-2 ring-red-100"
      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
  ].join(" ");
}

export function VerificationWorkspace({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const [form, setForm] = useState<SessionContextInput>(() => ({
    ...defaultSessionContext,
    notificationEmail: viewer.email ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(null);
  const [kycReady, setKycReady] = useState(false);
  const [kycStep, setKycStep] = useState<KycLinkStep | null>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const notificationChannelOptions = useMemo(() => {
    return VISIBLE_NOTIFICATION_CHANNELS.filter((option) => {
      if (option.value === "sms") {
        return (form.notificationPhone ?? "").trim().length > 0;
      }

      if (option.value === "email") {
        return (form.notificationEmail ?? "").trim().length > 0;
      }

      return true;
    });
  }, [form.notificationEmail, form.notificationPhone]);

  const metadataPreview = useMemo(() => {
    return JSON.stringify(buildSessionMetadata(form), null, 2);
  }, [form]);

  const hasAdvancedCapacity = form.customContextEntries.length < MAX_CUSTOM_CONTEXT_ENTRIES;

  const hasInlineErrors = Object.keys(errors).length > 0;

  function updateVerificationType(value: SessionContextInput["verificationType"]) {
    setForm((current) => ({
      ...current,
      scenario: value,
      verificationType: value,
    }));
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

  function redirectToFailure(payload: KycLinkErrorPayload) {
    const query = new URLSearchParams();

    query.set("sessionId", payload.sessionId ?? createdSession?.sessionId ?? "unknown-session");

    if (payload.code) {
      query.set("code", payload.code);
    }

    if (payload.message) {
      query.set("message", payload.message);
    } else if (payload.error) {
      query.set("message", payload.error);
    }

    router.push(`/failure?${query.toString()}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setKycReady(false);
    setKycStep(null);
    setIframeError(null);

    const parsed = sessionContextSchema.safeParse(form);
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
      const response = await fetch("/api/kyc/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json()) as
        | CreatedSession
        | {
            message?: string;
          };

      if (!response.ok) {
        throw new Error(payload && "message" in payload && payload.message ? payload.message : "Creation impossible.");
      }

      setCreatedSession(payload as CreatedSession);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Creation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const flowStatus = createdSession ? (kycReady ? "active" : "launching") : "idle";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="grid gap-8 xl:grid-cols-[0.84fr_1.16fr]">
        <section className="space-y-6 rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[var(--shadow-soft)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">SESSION_CONTEXT</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Configurez la session KYC.</h1>
              <p className="text-sm leading-6 text-slate-600">
                Choisissez un scenario simple, renseignez juste le contexte utile, puis l&apos;application mappe automatiquement les contexts backend et derive l&apos;externalId depuis votre reference client.
              </p>
            </div>

            <LogoutButton className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-70" label="Deconnexion" />
          </div>

          <div className="grid gap-4 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-950">Compte demo</p>
              <p>{viewer.demoAccountId ?? "Non determine"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-950">Utilisateur</p>
              <p>{viewer.email ?? "Email non disponible"}</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">1. Scenario</p>
                <h2 className="text-xl font-semibold text-slate-950">Choisissez un point de depart clair.</h2>
                <p className="text-sm leading-6 text-slate-600">
                  Le scenario rassure l&apos;utilisateur et pre-remplit le type de verification sans exposer de jargon technique.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {VERIFICATION_TYPE_OPTIONS.map((option) => {
                  const selected = form.scenario === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateVerificationType(option.value)}
                      className={[
                        "rounded-3xl border p-5 text-left transition",
                        selected
                          ? "border-blue-300 bg-blue-50 shadow-[var(--shadow-card)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-slate-950">{option.label}</p>
                        <p className="text-sm leading-6 text-slate-600">{SCENARIO_DESCRIPTIONS[option.value]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">2. Contexte de verification</p>
                <h2 className="text-xl font-semibold text-slate-950">Renseignez juste les informations utiles au parcours.</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Type de verification</span>
                  <select
                    className={inputClassName(Boolean(errors.verificationType))}
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

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Reference client</span>
                  <input
                    className={inputClassName(Boolean(errors.referenceClient))}
                    maxLength={128}
                    placeholder="cust_0042"
                    value={form.referenceClient}
                    onChange={(event) => updateField("referenceClient", event.target.value)}
                  />
                  <span className="text-xs text-slate-500">Identifiant metier de la demande. L&apos;externalId est derive cote serveur.</span>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Pays</span>
                  <select
                    className={inputClassName(Boolean(errors.country) || Boolean(errors.countryOther))}
                    value={form.country}
                    onChange={(event) => updateField("country", event.target.value as SessionContextInput["country"])}
                  >
                    <option value="">Selectionner</option>
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {form.country === "OTHER" ? (
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Pays (autre)</span>
                    <input
                      className={inputClassName(Boolean(errors.countryOther))}
                      placeholder="Ghana"
                      value={form.countryOther}
                      onChange={(event) => updateField("countryOther", event.target.value)}
                    />
                  </label>
                ) : null}

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Produit concerne</span>
                  <select
                    className={inputClassName(Boolean(errors.product))}
                    value={form.product}
                    onChange={(event) => updateField("product", event.target.value as SessionContextInput["product"])}
                  >
                    <option value="">Selectionner</option>
                    {PRODUCT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {form.product === "other" ? (
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Produit (autre)</span>
                    <input
                      className={inputClassName(Boolean(errors.productOther))}
                      placeholder="Nom court du produit"
                      value={form.productOther}
                      onChange={(event) => updateField("productOther", event.target.value)}
                    />
                  </label>
                ) : null}

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Segment</span>
                  <select
                    className={inputClassName(Boolean(errors.segment))}
                    value={form.segment}
                    onChange={(event) => updateField("segment", event.target.value as SessionContextInput["segment"])}
                  >
                    <option value="">Selectionner</option>
                    {SEGMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Priorite de traitement</span>
                  <select
                    className={inputClassName(Boolean(errors.priority))}
                    value={form.priority}
                    onChange={(event) => updateField("priority", event.target.value as SessionContextInput["priority"])}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">3. Notifications</p>
                <h2 className="text-xl font-semibold text-slate-950">Recevoir des notifications sur cette verification</h2>
                <p className="text-sm leading-6 text-slate-600">Choisissez le canal qui vous convient le mieux. Aucun de ces champs n&apos;est obligatoire.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Email de notification</span>
                  <input
                    className={inputClassName(Boolean(errors.notificationEmail))}
                    placeholder="demo.user@example.com"
                    type="email"
                    value={form.notificationEmail}
                    onChange={(event) => updateField("notificationEmail", event.target.value)}
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Telephone de notification</span>
                  <input
                    className={inputClassName(Boolean(errors.notificationPhone))}
                    placeholder="+221771234567"
                    value={form.notificationPhone}
                    onChange={(event) => updateField("notificationPhone", event.target.value)}
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
                  <span className="font-medium">Canal prefere</span>
                  <select
                    className={inputClassName(Boolean(errors.notificationChannel))}
                    value={form.notificationChannel}
                    onChange={(event) =>
                      updateField("notificationChannel", event.target.value as SessionContextInput["notificationChannel"])
                    }
                  >
                    <option value="">Aucun</option>
                    {notificationChannelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">4. Options avancees</p>
                  <h2 className="text-xl font-semibold text-slate-950">Ajoutez un contexte supplementaire si la demo le justifie.</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  <ChevronDown className={["size-4 transition", showAdvanced ? "rotate-180" : ""].join(" ")} />
                  {showAdvanced ? "Masquer les options avancees" : "Afficher les options avancees"}
                </button>
              </div>

              {showAdvanced ? (
                <div className="space-y-4">
                  <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <p>Ajoutez quelques paires cle / valeur simples. Elles seront mappees vers customContext.</p>
                    <p>Les cles reservees de l&apos;application sont refusees automatiquement et les structures imbriquees ne sont pas autorisees.</p>
                  </div>

                  <div className="space-y-3">
                    {form.customContextEntries.map((entry, index) => (
                      <div key={`${index}-${entry.key}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-medium">Cle</span>
                          <input
                            className={inputClassName(Boolean(errors[`customContextEntries.${index}.key`]))}
                            placeholder="campaign"
                            value={entry.key}
                            onChange={(event) => updateCustomContextEntry(index, "key", event.target.value)}
                          />
                        </label>

                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-medium">Valeur</span>
                          <input
                            className={inputClassName(Boolean(errors[`customContextEntries.${index}.value`]))}
                            placeholder="spring_demo"
                            value={entry.value}
                            onChange={(event) => updateCustomContextEntry(index, "value", event.target.value)}
                          />
                        </label>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeCustomContextEntry(index)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                          >
                            <Trash2 className="size-4" />
                            Retirer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">{form.customContextEntries.length} / {MAX_CUSTOM_CONTEXT_ENTRIES} entree(s) avancee(s)</p>
                    <button
                      type="button"
                      onClick={addCustomContextEntry}
                      disabled={!hasAdvancedCapacity}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                      Ajouter une paire cle / valeur
                    </button>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-950 p-4 text-sm text-slate-200">
                    <p className="font-medium text-white">Apercu JSON genere</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6">{metadataPreview}</pre>
                  </div>
                </div>
              ) : null}
            </div>

            {hasInlineErrors ? (
              <div className="animate-shake rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Verifiez les champs requis avant de continuer.
              </div>
            ) : null}

            {submitError ? (
              <div className="animate-shake flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="size-4 shrink-0" />
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {submitting ? "Preparation de la session..." : "Continuer"}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[var(--shadow-soft)] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Shield className="size-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-950">Regles J1 appliquees</h2>
                <ul className="space-y-2 text-sm leading-6 text-slate-600">
                  <li>Reference client limitee a 128 caracteres avant normalisation.</li>
                  <li>Le telephone reste optionnel et le canal SMS n&apos;apparait que si un numero est fourni.</li>
                  <li>La session KYC est creee cote serveur avec une cle demo resolue par compte.</li>
                </ul>
              </div>
            </div>
          </div>

          {createdSession ? (
            <div className="space-y-4 rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {flowStatus === "launching" ? "Session KYC creee." : "Parcours KycLink actif."}
                  </p>
                  <p>
                    {flowStatus === "launching"
                      ? `Session ${createdSession.sessionId} prete. Le composant KycLink va se charger.`
                      : `Etape courante: ${kycStep ? STEP_LABELS[kycStep] : "initialisation"}.`}
                  </p>
                </div>
              </div>

              {iframeError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {iframeError}
                </div>
              ) : null}

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-950">Session ID</p>
                  <p className="break-all">{createdSession.sessionId}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-950">Expiration</p>
                  <p>{createdSession.expiresAt}</p>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-950">Etat UI</p>
                  <p>
                    {flowStatus === "launching"
                      ? "SESSION_PREPARE"
                      : flowStatus === "active"
                        ? "KYC_LINK"
                        : "IDLE"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-950">SDK pret</p>
                  <p>{kycReady ? "oui" : "non"}</p>
                </div>
              </div>

              {flowStatus === "launching" || flowStatus === "active" ? (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
                  <KycLink
                    kyclinkUrl={createdSession.kyclinkUrl}
                    className="w-full border-0 bg-white"
                    height={780}
                    onReady={() => {
                      setKycReady(true);
                    }}
                    onStep={(step) => {
                      setKycStep(step);
                    }}
                    onComplete={(payload) => {
                      setKycStep("completed");
                      router.push(`/complete?sessionId=${encodeURIComponent(payload.sessionId)}`);
                    }}
                    onError={(payload) => {
                      setIframeError(payload.message ?? payload.error ?? "Le parcours KycLink a remonte une erreur.");
                      redirectToFailure(payload);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[32px] border border-dashed border-slate-300 bg-white/60 p-10 text-sm leading-7 text-slate-500 shadow-[var(--shadow-card)] backdrop-blur-sm">
              La surface KycLink s&apos;affichera ici apres creation de session. Les etats finaux sont maintenant rediriges vers des pages dediees `complete` et `failure`.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}