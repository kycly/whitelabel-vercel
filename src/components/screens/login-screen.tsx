"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  cognitoCompleteNewPassword,
  cognitoConfirmForgotPassword,
  cognitoSignIn,
  cognitoSignOut,
  cognitoStartForgotPassword,
  getExistingSession,
} from "@/auth/cognito-client";
import { PageShell } from "@/components/layout/page-shell";
import { BackIconButton } from "@/components/navigation/back-icon-button";
import {
  errorAlertClassName,
  formFieldClassName,
  primaryCtaClassName,
  successAlertClassName,
} from "@/components/ui/fixed-action-layout";
import { SurfacePanel } from "@/components/ui/surface-panel";

type LoginStep = "login" | "new-password" | "forgot-password-request" | "forgot-password-confirm";

function loginStepTitle(step: LoginStep): string {
  if (step === "new-password") {
    return "Mot de passe";
  }

  if (step === "forgot-password-request" || step === "forgot-password-confirm") {
    return "Réinitialisation";
  }

  return "KYCLY Demo";
}

function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Echec de l'authentification.";
  const lower = message.toLowerCase();

  if (message === "NEW_PASSWORD_REQUIRED") {
    return "Votre compte exige la definition d'un nouveau mot de passe.";
  }

  if (
    lower.includes("notauthorizedexception")
    || lower.includes("usernotfoundexception")
    || lower.includes("incorrect username or password")
  ) {
    return "Identifiant ou mot de passe invalide.";
  }

  if (lower.includes("usernotconfirmedexception")) {
    return "Votre compte Cognito n'est pas encore confirme.";
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return "Connexion impossible. Verifiez votre reseau puis reessayez.";
  }

  return message;
}

function mapNewPasswordError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Echec du changement de mot de passe.";
  const lower = message.toLowerCase();

  if (lower.includes("password did not conform") || lower.includes("invalidpasswordexception")) {
    return "Le mot de passe ne respecte pas les regles de complexite du user pool.";
  }

  return mapAuthError(error);
}

function mapForgotPasswordError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Echec du reset de mot de passe.";
  const lower = message.toLowerCase();

  if (lower.includes("codemismatchexception") || lower.includes("code mismatch")) {
    return "Le code de verification est invalide.";
  }

  if (lower.includes("expiredcodeexception") || lower.includes("expired")) {
    return "Le code de verification a expire. Demandez-en un nouveau.";
  }

  if (lower.includes("limitexceededexception") || lower.includes("toomanyrequests")) {
    return "Trop de tentatives. Reessayez dans quelques minutes.";
  }

  return mapAuthError(error);
}

async function createServerSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
  throw new Error(payload?.message ?? payload?.code ?? "INVALID_COGNITO_SESSION");
}

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<LoginStep>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetDestination, setResetDestination] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const urlError = searchParams.get("error") ? "La connexion precedente n'a pas pu etre finalisee." : null;

  useEffect(() => {
    let active = true;

    async function restoreExistingSession() {
      try {
        const session = await getExistingSession();

        if (!active || !session) {
          return;
        }

        await createServerSession(session.idToken);
        router.replace("/auth-loading");
        router.refresh();
      } catch (restoreError) {
        cognitoSignOut();

        if (active) {
          setError(mapAuthError(restoreError));
        }
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }

    void restoreExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function finalizeLogin(idToken: string) {
    await createServerSession(idToken);
    router.replace("/auth-loading");
    router.refresh();
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Saisissez un identifiant et un mot de passe.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const session = await cognitoSignIn(username.trim(), password);
      await finalizeLogin(session.idToken);
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message === "NEW_PASSWORD_REQUIRED") {
        setStep("new-password");
        setError(null);
      } else {
        setError(mapAuthError(submitError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword) {
      setError("Saisissez un nouveau mot de passe.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const session = await cognitoCompleteNewPassword(newPassword);
      await finalizeLogin(session.idToken);
    } catch (submitError) {
      setError(mapNewPasswordError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPasswordRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim()) {
      setError("Saisissez d'abord votre identifiant Cognito.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const delivery = await cognitoStartForgotPassword(username.trim());
      setResetDestination(delivery.destination);
      setStep("forgot-password-confirm");
      setMessage("Un code de verification a ete demande pour votre compte.");
    } catch (submitError) {
      setError(mapForgotPasswordError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPasswordConfirmSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim()) {
      setError("Identifiant manquant.");
      return;
    }

    if (!resetCode.trim()) {
      setError("Saisissez le code recu.");
      return;
    }

    if (!newPassword) {
      setError("Saisissez un nouveau mot de passe.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await cognitoConfirmForgotPassword(username.trim(), resetCode.trim(), newPassword);
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetCode("");
      setStep("login");
      setMessage("Mot de passe reinitialise. Vous pouvez maintenant vous connecter.");
    } catch (submitError) {
      setError(mapForgotPasswordError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackNavigation() {
    if (step === "forgot-password-confirm") {
      setStep("forgot-password-request");
      setError(null);
      setMessage(null);
      return;
    }

    if (step !== "login") {
      setStep("login");
      setError(null);
      setMessage(null);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/login");
  }

  return (
    <PageShell maxWidthClassName="max-w-4xl">
        <SurfacePanel className="px-5 pb-6 pt-8">
          <div className="flex h-full flex-col">
            <div className="mb-6 flex items-center justify-between">
              {step === "login" ? (
                <span className="w-9" />
              ) : (
                <BackIconButton
                  fallbackHref="/login"
                  onClick={handleBackNavigation}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-light)] text-[var(--muted-foreground)] transition-all duration-150 hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                />
              )}
              <p className="text-sm font-semibold text-[var(--foreground)]">{loginStepTitle(step)}</p>
              <span className="w-9" />
            </div>

            <div className="mb-6 flex animate-fade-in flex-col items-center justify-center text-center">
              <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--surface-light)]">
                <KeyRound className="h-10 w-10 text-brand" strokeWidth={1.7} aria-hidden="true" />
                <div className="absolute -right-1 top-0 rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]">
                  <ShieldCheck className="h-4 w-4 text-green-500" aria-hidden="true" />
                </div>
              </div>
              <h1 className="mb-1 text-2xl font-bold text-brand">Connectez-vous</h1>
              <p className="text-xs tracking-wide text-[var(--muted-foreground)]">Compte demo requis.</p>
            </div>

            <div className="animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface-light)] px-4 py-4" style={{ animationDelay: "0.1s" }}>

            {bootstrapping ? (
              <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-sm font-medium text-[var(--muted-foreground)]">
                <LoaderCircle className="size-4 animate-spin" />
                Verification de la session...
              </div>
            ) : null}

            {error ?? urlError ? (
              <p className={[errorAlertClassName, "mb-4 px-4 py-3"].join(" ")}>{error ?? urlError}</p>
            ) : null}
            {message ? <p className={[successAlertClassName, "mb-4"].join(" ")}>{message}</p> : null}

            {step === "login" ? (
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    aria-label="Identifiant de connexion"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className={formFieldClassName()}
                    placeholder="email@example.com"
                    disabled={submitting || bootstrapping}
                  />
                </div>

                <div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    aria-label="Secret de connexion"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={formFieldClassName()}
                    placeholder="••••••••"
                    disabled={submitting || bootstrapping}
                  />
                </div>

                <button
                  type="submit"
                  className={primaryCtaClassName}
                  disabled={submitting || bootstrapping}
                >
                  {submitting ? "Connexion..." : "Se connecter"}
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  className="w-full text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => {
                    setStep("forgot-password-request");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={submitting || bootstrapping}
                >
                  Mot de passe oublie ?
                </button>
              </form>
            ) : null}

            {step === "new-password" ? (
              <form className="space-y-4" onSubmit={handleNewPasswordSubmit}>
                <p className="text-sm text-[var(--muted-foreground)]">Définissez un nouveau mot de passe.</p>

                <div className="space-y-2">
                  <label htmlFor="new-password" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={formFieldClassName()}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    className={formFieldClassName()}
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className={primaryCtaClassName}
                  disabled={submitting}
                >
                  {submitting ? "Validation..." : "Valider le nouveau mot de passe"}
                </button>
              </form>
            ) : null}

            {step === "forgot-password-request" ? (
              <form className="space-y-4" onSubmit={handleForgotPasswordRequestSubmit}>
                <p className="text-sm text-[var(--muted-foreground)]">Demandez un code de reinitialisation.</p>

                <div className="space-y-2">
                  <label htmlFor="forgot-username" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Identifiant Cognito
                  </label>
                  <input
                    id="forgot-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className={formFieldClassName()}
                    placeholder="email@example.com"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className={primaryCtaClassName}
                  disabled={submitting}
                >
                  {submitting ? "Demande en cours..." : "Demander un code"}
                </button>
              </form>
            ) : null}

            {step === "forgot-password-confirm" ? (
              <form className="space-y-4" onSubmit={handleForgotPasswordConfirmSubmit}>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Saisissez le code recu {resetDestination ? `sur ${resetDestination}` : "depuis Cognito"}.
                </p>

                <div className="space-y-2">
                  <label htmlFor="reset-code" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Code de verification
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    className={formFieldClassName()}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="forgot-new-password" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="forgot-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={formFieldClassName()}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="forgot-confirm-new-password" className="block text-sm font-medium text-[var(--muted-foreground)]">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="forgot-confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    className={formFieldClassName()}
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className={primaryCtaClassName}
                  disabled={submitting}
                >
                  {submitting ? "Validation..." : "Confirmer le nouveau mot de passe"}
                </button>
              </form>
            ) : null}

            </div>
          </div>
        </SurfacePanel>
    </PageShell>
  );
}