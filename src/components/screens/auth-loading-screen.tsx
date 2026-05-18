"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProtectedScreenShell } from "@/components/layout/protected-screen-shell";
import { surfaceInfoCardClassName } from "@/components/ui/fixed-action-layout";

export function AuthLoadingScreen({ target }: { target: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <ProtectedScreenShell
      backHref="/auth/logout"
      title="Redirection"
      showLogout={false}
      maxWidthClassName="max-w-3xl"
      panelClassName="flex flex-1 flex-col justify-center text-center"
    >
      <div className="flex flex-1 items-center justify-center">
        <div className={[surfaceInfoCardClassName, "animate-scale-in"].join(" ")}>
          <div className="inline-flex items-center gap-3">
            <LoaderCircle className="size-4 animate-spin text-brand" />
            Redirection en cours...
          </div>
        </div>
      </div>
    </ProtectedScreenShell>
  );
}