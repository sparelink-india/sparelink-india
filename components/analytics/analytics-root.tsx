"use client";

/**
 * The single client boundary for the analytics module in the root layout.
 *
 * The root layout is a server component, so the provider and the consent control
 * need one thin client wrapper to sit inside it. Keeping the pair together here
 * means:
 *
 *   - one place decides whether tracking is mounted at all;
 *   - the storefront chrome is untouched: this renders two siblings (an invisible
 *     provider and a banner that appears only when the customer has not answered),
 *     and changes nothing about layout, spacing or the V3 design system.
 */

import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { PrivacyConsentBanner } from "@/components/analytics/privacy-consent";

export function AnalyticsRoot() {
  return (
    <>
      {/*
        Default consent is DENIED. Nothing is measured until the customer actively
        chooses, because a system that has not asked the question yet has no answer
        to record.
      */}
      <AnalyticsProvider
        defaultConsent={{
          state: "denied",
          analyticsAllowed: false,
          locationAllowed: false,
          preciseLocationAllowed: false,
          policyVersion: "2026-10-analytics-v1",
          decidedAt: new Date(0).toISOString(),
        }}
      />
      <PrivacyConsentBanner />
    </>
  );
}