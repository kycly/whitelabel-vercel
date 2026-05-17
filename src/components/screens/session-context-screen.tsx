import { VerificationWorkspace } from "@/components/verify/verification-workspace";

type Viewer = {
  email: string | null;
  demoAccountId: string | null;
};

export function SessionContextScreen({ viewer }: { viewer: Viewer }) {
  return <VerificationWorkspace viewer={viewer} />;
}