import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { SurfacePanel } from "@/components/ui/surface-panel";

type FailureScreenProps = {
  sessionId?: string;
  code?: string;
  message?: string;
};

export function FailureScreen({ sessionId, code, message }: FailureScreenProps) {
  return (
    <PageShell>
      <SurfacePanel className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">FAILURE</p>
            <p>
              {message ??
                "Le parcours KycLink a remonte une erreur recuperable. Vous pouvez revenir au contexte, verifier les informations de session et relancer sereinement une nouvelle tentative."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="font-medium text-slate-950">Session ID</p>
            <p className="break-all">{sessionId ?? "—"}</p>
          </div>
          <div>
            <p className="font-medium text-slate-950">Code</p>
            <p>{code ?? "UNKNOWN_ERROR"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Revenir au contexte guide
          </Link>

          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Se deconnecter
            </button>
          </form>
        </div>
      </SurfacePanel>
    </PageShell>
  );
}