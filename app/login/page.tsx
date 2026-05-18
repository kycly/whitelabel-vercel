import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { LoginScreen } from "@/components/screens/login-screen";

export default async function LoginPage() {
  const session = await readSession();

  if (session) {
    redirect("/auth-loading");
  }

  return <LoginScreen />;
}