import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationComplete } from "@/components/verify/verification-complete";

type CompletePageProps = {
  searchParams: Promise<{
    sessionId?: string;
  }>;
};

export default async function CompletePage({ searchParams }: CompletePageProps) {
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

  return <VerificationComplete sessionId={sessionId} />;
}