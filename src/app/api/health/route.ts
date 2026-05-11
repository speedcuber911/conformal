import { siteVariant } from "@/lib/site-variant";

export const runtime = "nodejs";

export function GET() {
  const variant = siteVariant();

  return Response.json({
    ok: true,
    service: variant,
  });
}
