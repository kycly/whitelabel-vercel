import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { AuthLoadingScreen } from "@/components/screens/auth-loading-screen";

export default async function AuthLoadingPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.canAccess) {
    redirect("/access-denied");
  }

  return <AuthLoadingScreen target="/welcome" />;
}