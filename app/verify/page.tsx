import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { SessionContextScreen } from "@/components/screens/session-context-screen";

export default async function VerifyPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  return (
    <SessionContextScreen
      viewer={{
        email: session.email,
        demoAccountId: session.demoAccountId,
      }}
    />
  );
}