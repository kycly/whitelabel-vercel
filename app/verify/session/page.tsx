import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationSessionGate } from "@/components/verify/verification-session-gate";

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

  return <VerificationSessionGate sessionId={sessionId} />;
}