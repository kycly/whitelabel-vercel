import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { AccessDeniedScreen } from "@/components/screens/access-denied-screen";

export default async function AccessDeniedPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  return <AccessDeniedScreen userLabel={session.email ?? session.sub} />;
}