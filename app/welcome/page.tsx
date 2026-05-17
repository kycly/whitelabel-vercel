import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { WelcomeScreen } from "@/components/screens/welcome-screen";

export default async function WelcomePage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  return <WelcomeScreen userLabel={session.email ?? session.sub} demoAccountId={session.demoAccountId} />;
}