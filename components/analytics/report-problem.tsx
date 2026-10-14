"use client";

/**
 * "Report a problem" — the customer-facing intake.
 *
 * WHY A BUTTON AND NOT A SCREEN RECORDER
 *
 * There is no screen capture anywhere in this module. A screenshot exists only if the
 * customer picks a file with a file picker. That is a deliberate structural choice:
 * nothing in this codebase calls a screen-capture API, a `getDisplayMedia`, or a
 * canvas snapshot of the page, so the feature cannot leak into silent recording even
 * by accident.
 *
 * The button is placed in the site footer rather than floating over the content, so it
 * adds nothing to the visual language of the storefront. It uses the same Precision
 * tokens, the same radius and the same type scale as every other footer control.
 *
 * WORKS WITHOUT SIGNING IN. A customer who cannot find the report control is exactly
 * the customer with a problem, so an anonymous report is accepted.
 */

import { useEffect, useRef, useState } from "react";

import { T } from "@/components/t";

const CATEGORIES = [
  { id: "search", label: "I could not find a part" },
  { id: "product", label: "A product page is wrong" },
  { id: "checkout", label: "Checkout did not work" },
  { id: "payment", label: "Payment did not work" },
  { id: "account", label: "My account" },
  { id: "other", label: "Something else" },
] as const;

const MAX_DESCRIPTION = 2000;

export function ReportProblemControl() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotAllowed, setScreenshotAllowed] = useState(false);
  const [category, setCategory] = useState<string>("search");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/v1/analytics/problem-reports", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { screenshotStorageAvailable?: boolean } | null) => {
        if (!cancelled) setScreenshotAllowed(payload?.screenshotStorageAvailable === true);
      })
      .catch(() => {
        if (!cancelled) setScreenshotAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus], button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("category", category);
      if (description.trim()) form.set("description", description.trim().slice(0, MAX_DESCRIPTION));
      form.set("path", window.location.pathname);
      const visitorId = readStored("sparelink-analytics-visitor");
      if (visitorId) form.set("visitorId", JSON.parse(visitorId));
      if (file) form.set("screenshot", file);

      const response = await fetch("/api/v1/analytics/problem-reports", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Your report could not be sent. Please try again.");
        return;
      }
      setSent(true);
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Your report could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="text-[12px] underline underline-offset-2 transition-colors hover:text-[var(--sl-ink)]"
        style={{ color: "var(--sl-ink-2)" }}
      >
        Report a problem
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--sl-overlay)] backdrop-blur-[2px]"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-problem-title"
            className="relative max-h-[92vh] w-full overflow-y-auto border-t p-5 shadow-[var(--sl-e-3)] sm:max-w-lg sm:rounded-lg sm:border"
            style={{ backgroundColor: "var(--sl-surface)", borderColor: "var(--sl-rule-2)" }}
          >
            {sent ? (
              <div className="py-6 text-center">
                <p className="text-[15px] font-semibold" style={{ color: "var(--sl-ok)" }}>
                  Thank you — your report has been sent
                </p>
                <p className="mt-2 text-[12px]" style={{ color: "var(--sl-ink-2)" }}>
                  Our team will look into it. If it was urgent, please call or WhatsApp us and
                  quote the page you were on.
                </p>
                <button
                  type="button"
                  data-autofocus
                  onClick={() => setOpen(false)}
                  className="sl-btn sl-btn-primary sl-btn-sm mt-5"
                >
                  <T k="common.close" />
                </button>
              </div>
            ) : (
              <>
                <h2
                  id="report-problem-title"
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--sl-ink)" }}
                >
                  Report a problem
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--sl-ink-2)" }}>
                  Tell us what went wrong. You do not need an account, and you do not need to
                  describe anything in detail.
                </p>

                {error ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-md px-3 py-2 text-[12px]"
                    style={{ backgroundColor: "var(--sl-bad-soft)", color: "var(--sl-bad)" }}
                  >
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="report-category" className="sl-label">
                      What kind of problem?
                    </label>
                    <select
                      id="report-category"
                      data-autofocus
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="mt-1 sl-select"
                    >
                      {CATEGORIES.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="report-description" className="sl-label">
                      What happened? (optional)
                    </label>
                    <textarea
                      id="report-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION))}
                      rows={4}
                      placeholder="For example: I searched for a brake pad and nothing came up."
                      className="mt-1 sl-textarea"
                    />
                    <p className="mt-1 text-[11px]" style={{ color: "var(--sl-ink-3)" }}>
                      Passwords, one-time codes, card numbers and email addresses are removed from
                      this before it is stored.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="report-screenshot" className="sl-label">
                      Attach a screenshot (optional)
                    </label>
                    <input
                      ref={fileRef}
                      id="report-screenshot"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={!screenshotAllowed}
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-[12px]"
                      style={{ color: "var(--sl-ink-2)" }}
                    />
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--sl-ink-3)" }}>
                      {screenshotAllowed
                        ? "You choose the file — we never capture your screen. Attachments are deleted after 90 days."
                        : "Screenshot upload is not available right now. Your written description will still reach us."}
                    </p>
                  </div>

                  <p className="text-[11px]" style={{ color: "var(--sl-ink-3)" }}>
                    Sending: <span className="font-mono">{typeof window === "undefined" ? "" : window.location.pathname}</span>
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={sending}
                    className="sl-btn sl-btn-primary sl-btn-sm disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="sl-btn sl-btn-secondary sl-btn-sm"
                  >
                    <T k="common.cancel" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * "Was this helpful?" — the lightweight counterpart to the problem report.
 *
 * A single yes/no on a normal page is far higher response rate than an opened form,
 * and it is enough to know whether a page is working for people.
 */
export function HelpfulVote({
  pagePath,
  partNumber,
}: {
  pagePath: string;
  partNumber?: string;
}) {
  const [voted, setVoted] = useState<number | null>(null);

  const vote = async (score: number) => {
    if (voted !== null) return;
    setVoted(score);
    try {
      const form = new FormData();
      form.set("category", "other");
      form.set("helpfulScore", String(score));
      form.set("path", pagePath);
      if (partNumber) form.set("partNumber", partNumber);
      const visitorId = readStored("sparelink-analytics-visitor");
      if (visitorId) form.set("visitorId", JSON.parse(visitorId));
      await fetch("/api/v1/analytics/problem-reports", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
    } catch {
      /* A failed vote must never surface as an error to the customer. */
    }
  };

  if (voted !== null) {
    return (
      <p className="text-[12px]" style={{ color: "var(--sl-ink-3)" }} role="status">
        Thank you for the feedback.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px]" style={{ color: "var(--sl-ink-2)" }}>
        Was this page helpful?
      </span>
      <button
        type="button"
        onClick={() => vote(1)}
        className="sl-btn sl-btn-sm sl-btn-secondary"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => vote(0)}
        className="sl-btn sl-btn-sm sl-btn-secondary"
      >
        No
      </button>
    </div>
  );
}