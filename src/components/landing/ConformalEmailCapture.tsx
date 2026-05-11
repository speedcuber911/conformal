"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

export function ConformalEmailCapture() {
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const subject = encodeURIComponent("Conformal conversation");
    const body = encodeURIComponent(`Email: ${trimmedEmail}\n\nI'd like to start a conversation.`);
    window.location.href = `mailto:hello@conformal.live?subject=${subject}&body=${body}`;
  }

  return (
    <form className="conformal-email-capture mx-auto flex w-full max-w-[480px] items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] p-2 pl-[18px]" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="conformal-email">Email address</label>
      <input
        id="conformal-email"
        name="email"
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[color:var(--foreground)] outline-none"
        placeholder="your@company.com"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button className={buttonClassName("px-[18px] py-[9px]")} type="submit">
        Start a conversation <ArrowRight size={14} aria-hidden="true" />
      </button>
    </form>
  );
}

function buttonClassName(className?: string) {
  return [
    "conformal-button conformal-button-primary inline-flex items-center gap-1.5 rounded-full bg-[#B8232E] px-4 py-2 text-[13px] font-medium text-white no-underline transition duration-200 hover:bg-[#991C26]",
    className,
  ].filter(Boolean).join(" ");
}
