export type SiteVariant = "conformal" | "dcmshriram";

export function siteVariant(): SiteVariant {
  return process.env.SITE_VARIANT === "dcmshriram" || process.env.NEXT_PUBLIC_SITE_VARIANT === "dcmshriram"
    ? "dcmshriram"
    : "conformal";
}

export function isDcmshriramSite() {
  return siteVariant() === "dcmshriram";
}
