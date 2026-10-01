"use client";

import { useEffect, useState } from "react";

import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Profile -> Addresses.
 *
 * Reads the customer's OWN profile from /api/profile - the same endpoint the
 * editable Business Details form uses, so there is one source and not two.
 * Billing and shipping are whatever the customer actually saved; empty fields
 * render as "Not set" rather than being filled with a placeholder address.
 */
type ProfileAddress = {
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingPreference: string;
};

function joinAddress(parts: string[]) {
  const kept = parts.map((p) => (p ?? "").trim()).filter(Boolean);
  return kept.length ? kept.join(", ") : null;
}

function AddressBlock({
  titleKey,
  lines,
  editHref,
  editLabel,
}: {
  titleKey: "profile.billingAddress" | "profile.shippingAddress";
  lines: Array<string | null>;
  editHref: string;
  editLabel: string;
}) {
  const { t } = useI18n();
  const filled = lines.filter(Boolean);
  return (
    <div className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
      <h2 className="text-sm font-bold text-[var(--v3-text)]">{t(titleKey)}</h2>
      {filled.length ? (
        <address className="mt-2 not-italic text-[13px] leading-relaxed text-[var(--v3-text-2)]">
          {filled.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </address>
      ) : (
        <p className="mt-2 text-[13px] text-[var(--v3-text-3)]">{t("profile.notSet")}</p>
      )}
      <a
        href={editHref}
        className="mt-3 inline-flex text-[12px] font-semibold text-[var(--v3-brand-ink)] hover:underline"
      >
        {editLabel}
      </a>
    </div>
  );
}

export function ProfileAddresses() {
  const { t } = useI18n();
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error" } | { kind: "ready"; profile: ProfileAddress }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("profile");
        return (await response.json()) as ProfileAddress;
      })
      .then((profile) => setState({ kind: "ready", profile }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ kind: "error" });
      });
    return () => controller.abort();
  }, []);

  if (state.kind === "loading") {
    return (
      <p className="mt-6 text-sm text-[var(--v3-text-3)]" role="status" aria-live="polite">
        {t("common.loading")}
      </p>
    );
  }
  if (state.kind === "error") {
    return <SectionEmpty title={t("profile.addresses")} body={t("profile.loadFail")} />;
  }

  const p = state.profile;
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <AddressBlock
        titleKey="profile.billingAddress"
        editHref="/profile"
        editLabel={t("profile.business")}
        lines={[
          joinAddress([p.billingAddressLine1, p.billingAddressLine2]),
          joinAddress([p.billingCity, p.billingState, p.billingPincode]),
        ]}
      />
      <AddressBlock
        titleKey="profile.shippingAddress"
        editHref="/profile"
        editLabel={t("profile.business")}
        lines={[
          joinAddress([p.shippingAddressLine1, p.shippingAddressLine2]),
          joinAddress([p.shippingCity, p.shippingState, p.shippingPincode]),
          p.shippingPreference ? `${t("profile.addresses")}: ${p.shippingPreference}` : null,
        ]}
      />
    </div>
  );
}
