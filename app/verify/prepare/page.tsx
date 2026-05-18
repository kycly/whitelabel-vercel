import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { VerificationPrepareScreen } from "@/components/verify/verification-prepare-screen";

export default async function VerificationPreparePage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  return <VerificationPrepareScreen />;
}