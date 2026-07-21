import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationDetail } from "@/components/verify/verification-detail";

type SessionDetailPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  const { sessionId } = await params;

  return <VerificationDetail sessionId={sessionId} />;
}
