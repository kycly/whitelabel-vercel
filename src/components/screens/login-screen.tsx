"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import {
  cognitoCompleteNewPassword,
  cognitoConfirmForgotPassword,
  cognitoSignIn,
  cognitoSignOut,
  cognitoStartForgotPassword,
  getExistingSession,
} from "@/auth/cognito-client";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

const trustPoints = [
  "Connexion securisee via Cognito",
  "Acces reserve aux comptes demo autorises",
  "Aucun secret KYCLY expose dans le navigateur",
];

type LoginStep = "login" | "new-password" | "forgot-password-request" | "forgot-password-confirm";

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

  return (
    <PageShell className="flex items-center" maxWidthClassName="max-w-6xl">
      <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <section className="animate-fade-in space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <Sparkles className="size-4 text-blue-600" />
            Espace demo KYCLY
          </div>

          <div className="max-w-2xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Verification guidee</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Connectez-vous pour ouvrir un parcours de verification rassurant.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-600">
              Accedez a votre espace demo securise, retrouvez votre historique et lancez une session KYC en quelques etapes claires.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustPoints.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 text-sm leading-6 text-slate-600 shadow-[var(--shadow-card)] backdrop-blur-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <SurfacePanel className="animate-slide-up">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <KeyRound className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Connexion securisee</h2>
                <p className="text-sm text-slate-500">Votre acces depend d&apos;un compte demo deja autorise.</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              Utilisez directement vos identifiants Cognito. L&apos;application verifie ensuite le JWT cote serveur et ouvre la session HTTP-only deja consommee par le reste du parcours.
            </div>

            {bootstrapping ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600">
                <LoaderCircle className="size-4 animate-spin" />
                Verification d&apos;une session Cognito existante...
              </div>
            ) : null}

            {error ?? urlError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error ?? urlError}</p>
            ) : null}
            {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

            {step === "login" ? (
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-slate-700">
                    Identifiant Cognito
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    placeholder="email@example.com"
                    disabled={submitting || bootstrapping}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting || bootstrapping}
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  disabled={submitting || bootstrapping}
                >
                  {submitting ? "Connexion..." : "Se connecter"}
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  className="w-full text-sm font-medium text-slate-600 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
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
                <p className="text-sm leading-6 text-slate-600">
                  Votre compte demande un nouveau mot de passe avant de poursuivre.
                </p>

                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-new-password" className="text-sm font-medium text-slate-700">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  disabled={submitting}
                >
                  {submitting ? "Validation..." : "Valider le nouveau mot de passe"}
                </button>
              </form>
            ) : null}

            {step === "forgot-password-request" ? (
              <form className="space-y-4" onSubmit={handleForgotPasswordRequestSubmit}>
                <p className="text-sm leading-6 text-slate-600">
                  Saisissez votre identifiant Cognito pour demander un code de reinitialisation.
                </p>

                <div className="space-y-2">
                  <label htmlFor="forgot-username" className="text-sm font-medium text-slate-700">
                    Identifiant Cognito
                  </label>
                  <input
                    id="forgot-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    placeholder="email@example.com"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  disabled={submitting}
                >
                  {submitting ? "Demande en cours..." : "Demander un code"}
                </button>

                <button
                  type="button"
                  className="w-full text-sm font-medium text-slate-600 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => {
                    setStep("login");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={submitting}
                >
                  Retour a la connexion
                </button>
              </form>
            ) : null}

            {step === "forgot-password-confirm" ? (
              <form className="space-y-4" onSubmit={handleForgotPasswordConfirmSubmit}>
                <p className="text-sm leading-6 text-slate-600">
                  Saisissez le code recu {resetDestination ? `sur ${resetDestination}` : "depuis Cognito"}, puis votre nouveau mot de passe.
                </p>

                <div className="space-y-2">
                  <label htmlFor="reset-code" className="text-sm font-medium text-slate-700">
                    Code de verification
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="forgot-new-password" className="text-sm font-medium text-slate-700">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="forgot-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="forgot-confirm-new-password" className="text-sm font-medium text-slate-700">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="forgot-confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  disabled={submitting}
                >
                  {submitting ? "Validation..." : "Confirmer le nouveau mot de passe"}
                </button>

                <button
                  type="button"
                  className="w-full text-sm font-medium text-slate-600 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => {
                    setStep("login");
                    setError(null);
                  }}
                  disabled={submitting}
                >
                  Retour a la connexion
                </button>
              </form>
            ) : null}

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-950">
                <ShieldCheck className="size-4 text-blue-600" />
                Controle d&apos;acces J1
              </div>
              <ul className="space-y-2">
                <li>Le compte doit etre provisionne dans le meme user pool Cognito.</li>
                <li>Le backend verifie le JWT Cognito avant toute creation de session.</li>
                <li>La session applicative reste cote serveur via cookie HTTP-only.</li>
              </ul>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </PageShell>
  );
}