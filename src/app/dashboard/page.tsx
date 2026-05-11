import { DashboardGrid } from "@/components/DashboardGrid";
import { redirect } from "next/navigation";
import { isDcmshriramSite } from "@/lib/site-variant";

export default function DashboardPage() {
  if (isDcmshriramSite()) {
    return <DashboardGrid />;
  }

  redirect("/");
}
