import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { FailureScreen } from "@/components/screens/failure-screen";

type FailurePageProps = {
  searchParams: Promise<{
    sessionId?: string;
    code?: string;
    message?: string;
  }>;
};

export default async function FailurePage({ searchParams }: FailurePageProps) {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  const params = await searchParams;

  return <FailureScreen sessionId={params.sessionId} code={params.code} message={params.message} />;
}