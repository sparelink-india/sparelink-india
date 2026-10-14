"use client";

/**
 * The tracking-preference control.
 *
 * WHAT THIS IS FOR
 *
 * Two jobs, both of them the customer's:
 *
 *   1. ASK, once, clearly. Nothing is measured before this is answered. There is no
 *      pre-ticked box and no "continue implies consent" — the default state is
 *      declined and the visitor has to actively choose.
 *
 *   2. CHANGE, at any time, from the account page. A preference that cannot be
 *      changed is not a preference, so the same component is reused there with a
 *      persistent variant.
 *
 * WHY THREE LEVELS
 *
 *   ESSENTIAL ONLY   Operational error reporting only. Enough to fix a broken
 *                    checkout, no behavioural history at all.
 *   ANALYTICS        Adds page views, searches and product interest. Still no
 *                    location of any kind.
 *   PLUS LOCATION    Adds the approximate city derived from the network.
 *
 *   Precise GPS is NOT among them. It is a separate, contextual request made at the
 *   moment a customer asks for something that needs their position, with the reason
 *   stated. Bundling it into a settings dialog is exactly how precise location
 *   consent becomes meaningless.
 *
 * VISUAL LANGUAGE
 *
 * Built from the Precision (`sl-*`) tokens so it belongs to the site it sits
 * on. It adds no new colour and introduces no visual system of its own: every
 * surface, rule and ink here is a `--sl-*` token and every action is a
 * canonical `.sl-btn`.
 */

import { useEffect, useState } from "react";

import {
  CONSENT_POLICY_VERSION,
  type ConsentState,
} from "@/lib/analytics/privacy";
import { setAnalyticsConsent } from "@/lib/analytics/client";
import { notifyConsentChanged } from "@/components/analytics/analytics-provider";

type Choice = "essential" | "analytics" | "location";

const COPY: Record<
  Choice,
  { title: string; body: string; detail: string[]; button: string }
> = {
  essential: {
    title: "Help us fix problems",
    body: "We would like to record errors and failed requests so we can fix them.",
    detail: [
      "This records a fault, not your browsing. No pages you visited, no searches, no products.",
      "It does not create a profile of you and is not used for marketing.",
    ],
    button: "Allow error reports",
  },
  analytics: {
    title: "Help us improve the site",
    body: "We would like to understand which pages and searches are useful, and which are not.",
    detail: [
      "Records which pages you view, what you search for, and which parts you look at, so we can improve them.",
      "It does not record what you type into any form, your payment details, or your name.",
      "Search terms have phone numbers, email addresses and one-time codes removed before they are stored.",
      "Your data is never sold or shared with advertisers.",
    ],
    button: "Allow usage analytics",
  },
  location: {
    title: "Understand where demand comes from",
    body: "We would like to know roughly which city our customers browse from, so we can stock and deliver better.",
    detail: [
      "We derive a city from your network connection. Your IP address itself is never stored or used to identify you.",
      "This is an approximate city, not your exact position, and it is never shown to other customers.",
      "We do not ask for your precise location here. If we ever need it, we will ask you at that moment and explain why.",
    ],
    button: "Allow analytics and city",
  },
};

export function PrivacyConsentBanner({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"ask" | "detail">("ask");

  useEffect(() => {
    /* Shown only when the visitor has not already answered. An answered preference
       is final until they change it themselves from the account page. */
    try {
      if (window.localStorage.getItem("sparelink-analytics-consent")) return;
    } catch {
      /* storage unavailable: asking again is harmless */
    }
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const decide = (choice: Choice | "decline") => {
    const state: ConsentState = choice === "decline" ? "denied" : choice === "essential" ? "partial" : "granted";
    setAnalyticsConsent({
      state,
      /* Essential error reporting is on even when analytics is declined: a refused
         analytics grant must not mean losing the ability to fix a broken checkout. */
      analyticsAllowed: choice !== "decline",
      locationAllowed: choice === "location",
      preciseLocationAllowed: false,
      policyVersion: CONSENT_POLICY_VERSION,
      decidedAt: new Date().toISOString(),
    });
    /* Tell React the external store changed, so any other component reading the
       preference (the account page panel) updates without a page reload. */
    notifyConsentChanged();
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  if (mode === "detail") {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="consent-detail-title"
        className="fixed inset-x-0 bottom-0 z-[70] border-t shadow-[var(--sl-e-3)] sm:inset-x-4 sm:bottom-4 sm:rounded-lg sm:border"
        style={{
          backgroundColor: "var(--sl-surface)",
          borderColor: "var(--sl-rule-2)",
          color: "var(--sl-ink)",
        }}
      >
        <div className="mx-auto max-w-2xl p-4 sm:p-5">
          <h2
            id="consent-detail-title"
            className="text-[15px] font-semibold"
            style={{ color: "var(--sl-ink)" }}
          >
            What each choice means
          </h2>
          <div className="mt-3 space-y-3">
            {(["essential", "analytics", "location"] as const).map((choice) => (
              <div
                key={choice}
                className="rounded-md p-3"
                style={{ backgroundColor: "var(--sl-sunken)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--sl-ink)" }}>
                  {COPY[choice].title}
                </p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--sl-ink-2)" }}>
                  {COPY[choice].body}
                </p>
                <ul className="mt-2 space-y-1">
                  {COPY[choice].detail.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-[11px] leading-relaxed"
                      style={{ color: "var(--sl-ink-3)" }}
                    >
                      <span aria-hidden="true">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode("ask")}
            className="mt-4 text-[12px] font-semibold underline underline-offset-2"
            style={{ color: "var(--sl-brand-ink)" }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-body"
      className="fixed inset-x-0 bottom-0 z-[70] border-t shadow-[var(--sl-e-3)] sm:inset-x-4 sm:bottom-4 sm:rounded-lg sm:border"
      style={{
        backgroundColor: "var(--sl-surface)",
        borderColor: "var(--sl-rule-2)",
        color: "var(--sl-ink)",
      }}
    >
      <div className="mx-auto max-w-2xl p-4 sm:p-5">
        <h2 id="consent-title" className="text-[15px] font-semibold">
          Help us make SpareLink India better
        </h2>
        <p id="consent-body" className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--sl-ink-2)" }}>
          Nothing about your browsing is recorded until you choose below. You can change your
          choice at any time from your account. We never record payment details, passwords or
          one-time codes, and we never record your screen.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ChoiceButton choice="location" onChoose={() => decide("location")} primary />
          <ChoiceButton choice="analytics" onChoose={() => decide("analytics")} />
          <ChoiceButton choice="essential" onChoose={() => decide("essential")} />
          <button
            type="button"
            onClick={() => decide("decline")}
            className="sl-btn sl-btn-secondary sl-btn-sm"
          >
            Decline all optional
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => setMode("detail")}
            className="text-[11px] font-semibold underline underline-offset-2"
            style={{ color: "var(--sl-brand-ink)" }}
          >
            What does each choice include?
          </button>
          <a
            href="/privacy-policy"
            className="text-[11px] underline underline-offset-2"
            style={{ color: "var(--sl-ink-3)" }}
          >
            Read the privacy policy
          </a>
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({
  choice,
  onChoose,
  primary,
}: {
  choice: Choice;
  onChoose: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className={
        primary
          ? "sl-btn sl-btn-primary sl-btn-sm"
          : "sl-btn sl-btn-secondary sl-btn-sm"
      }
    >
      {COPY[choice].button}
    </button>
  );
}

/**
 * The persistent variant, rendered inside the account page.
 *
 * Shows what is currently granted and offers a way to change or withdraw it. A
 * withdrawal that only hid a control would not be a withdrawal, so `denied` is
 * reachable here and takes effect server-side on the next request.
 */
export function PrivacyPreferencesPanel() {
  const [current, setCurrent] = useState<ConsentState | null>(null);
  const [locationOn, setLocationOn] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/analytics/consent", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { state?: ConsentState; locationAllowed?: boolean } | null) => {
        if (cancelled || !payload) return;
        setCurrent(payload.state ?? "pending");
        setLocationOn(payload.locationAllowed === true);
      })
      .catch(() => {
        if (!cancelled) setCurrent("pending");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (choice: Choice | "decline") => {
    const state: ConsentState =
      choice === "decline" ? "denied" : choice === "essential" ? "partial" : "granted";
    setAnalyticsConsent({
      state,
      analyticsAllowed: choice !== "decline",
      locationAllowed: choice === "location",
      preciseLocationAllowed: false,
      policyVersion: CONSENT_POLICY_VERSION,
      decidedAt: new Date().toISOString(),
    });
    setCurrent(state);
    setLocationOn(choice === "location");
    setSaved(true);
    notifyConsentChanged();
  };

  return (
    <section
      className="rounded-lg border p-4"
      style={{ backgroundColor: "var(--sl-surface)", borderColor: "var(--sl-rule)" }}
    >
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--sl-ink)" }}>
        Your privacy choices
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: "var(--sl-ink-2)" }}>
        Currently:{" "}
        <strong>
          {current === "granted"
            ? "Analytics and city allowed"
            : current === "partial"
              ? "Error reports only"
              : current === "denied"
                ? "All optional measurement declined"
                : "No choice recorded yet"}
        </strong>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--sl-ink-3)" }}>
        Withdrawing permission takes effect immediately: no further events are accepted, and any
        precise location already stored is deleted. Records already collected under a previous
        choice are removed on the schedule described in the{" "}
        <a href="/privacy-policy" className="underline underline-offset-2">
          privacy policy
        </a>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ChoiceButton choice="location" onChoose={() => apply("location")} primary />
        <ChoiceButton choice="analytics" onChoose={() => apply("analytics")} />
        <ChoiceButton choice="essential" onChoose={() => apply("essential")} />
        <button
          type="button"
          onClick={() => apply("decline")}
          className="sl-btn sl-btn-secondary sl-btn-sm"
        >
          Withdraw consent
        </button>
      </div>

      {saved ? (
        <p role="status" className="mt-3 text-[12px] font-medium" style={{ color: "var(--sl-ok)" }}>
          Your choice has been saved.
        </p>
      ) : null}

      <p className="mt-3 text-[11px]" style={{ color: "var(--sl-ink-3)" }}>
        Approximate city: {locationOn ? "allowed" : "not collected"}. Precise GPS: never collected
        from this page — it is only ever requested at the moment you ask for something that needs
        it, with the reason explained.
      </p>
    </section>
  );
}