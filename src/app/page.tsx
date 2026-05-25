import type { Metadata } from "next";
import { CockpitShell } from "@/components/CockpitShell";
import { ConformalHomePage } from "@/components/landing/ConformalHomePage";
import { isDcmshriramSite } from "@/lib/site-variant";

export const metadata: Metadata = isDcmshriramSite()
  ? {}
  : {
      title: "Conformal — Enterprise AI",
    };

export default function Home() {
  if (isDcmshriramSite()) {
    return <CockpitShell />;
  }

  return <ConformalHomePage />;
}
