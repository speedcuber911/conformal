export function sectionTargetFromHref(href: string) {
  if (href.startsWith("#")) {
    return href.slice(1);
  }

  if (href.startsWith("/#")) {
    return href.slice(2);
  }

  return null;
}
