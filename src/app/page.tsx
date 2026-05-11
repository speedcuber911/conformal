import { ConformalLandingPage } from "@/components/landing";
import { CockpitShell } from "@/components/CockpitShell";
import { isDcmshriramSite } from "@/lib/site-variant";

export default function Home() {
  if (isDcmshriramSite()) {
    return <CockpitShell />;
  }

  return <ConformalLandingPage />;
}
