import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationRunScreen } from "@/components/verify/verification-run-screen";

type VerificationSessionPageProps = {
  searchParams: Promise<{
    sessionId?: string;
  }>;
};

export default async function VerificationSessionPage({ searchParams }: VerificationSessionPageProps) {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  const params = await searchParams;
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;

  if (!sessionId) {
    redirect("/verify");
  }

  return <VerificationRunScreen sessionId={sessionId} />;
}