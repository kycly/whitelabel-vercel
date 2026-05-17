import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationSessions } from "@/components/verify/verification-sessions";

export default async function SessionsPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  return <VerificationSessions />;
}