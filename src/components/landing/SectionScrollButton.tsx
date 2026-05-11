"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const pendingSectionKey = "conformal.pendingSectionScroll";

function cleanCurrentUrl() {
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
}

function scrollToSection(targetId: string, behavior: ScrollBehavior = "smooth") {
  if (targetId === "top") {
    window.scrollTo({ top: 0, behavior });
    cleanCurrentUrl();
    return true;
  }

  const target = document.getElementById(targetId);

  if (!target) {
    return false;
  }

  target.scrollIntoView({ behavior, block: "start" });
  cleanCurrentUrl();
  return true;
}

type SectionScrollButtonProps = Omit<ComponentProps<typeof Link>, "href"> & {
  targetId: string;
};

export function SectionScrollButton({ targetId, onClick, ...props }: SectionScrollButtonProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    if (pathname === "/" && scrollToSection(targetId)) {
      return;
    }

    window.sessionStorage.setItem(pendingSectionKey, targetId);
    router.push("/");
  }

  return <Link {...props} href="/" onClick={handleClick} />;
}

export function PendingSectionScroll() {
  useEffect(() => {
    const pendingTarget = window.sessionStorage.getItem(pendingSectionKey);
    const hashTarget = window.location.hash ? window.location.hash.slice(1) : "";
    const targetId = pendingTarget || hashTarget;

    if (!targetId) {
      return;
    }

    window.sessionStorage.removeItem(pendingSectionKey);

    const attemptScroll = (attempt = 0) => {
      if (scrollToSection(targetId, pendingTarget ? "smooth" : "auto") || attempt >= 8) {
        return;
      }

      window.setTimeout(() => attemptScroll(attempt + 1), 50);
    };

    window.requestAnimationFrame(() => attemptScroll());
  }, []);

  return null;
}
