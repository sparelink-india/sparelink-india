"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/preferences-provider";

/**
 * SHORTAGE REQUEST.
 *
 * The problem this exists to solve: a customer wants 50, we hold 10. If the only
 * thing the interface can express is "add to cart", then 40 of their request
 * evaporates — and 40 is exactly the number procurement needs in order to buy
 * anything. So the quantity is never clamped to stock. Asking for more than we
 * have is allowed, and the excess is recorded as a demand.
 *
 * What it deliberately does NOT do:
 *  - it does not promise a delivery date (no supplier ETA exists);
 *  - it does not fake a split order or pretend the shortfall is confirmed;
 *  - it does not show an internal demand id to the customer;
 *  - it does not create demand for an anonymous visitor, because anonymous rows
 *    cannot be attributed to anybody and the database refuses them anyway.
 *
 * It reports real figures throughout: the requested quantity, the quantity we
 * can actually supply, and the difference. All three come from the server.
 */

type Props = {
  /** The part being requested. Used for the server-side lookup. */
  partId: string;
  /** What the customer asked for in total. */
  requestedQty: number;
  /** What the database says we can supply right now. */
  availableQty: number;
  /** Fired after a successful capture, so the caller can refresh its own UI. */
  onCaptured?: () => void;
};

export function ShortageRequest({
  partId,
  requestedQty,
  availableQty,
  onCaptured,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const shortage = Math.max(0, requestedQty - availableQty);

  /*
   * The key is derived from what the customer asked for, so a double-click, a
   * retry, or a refresh collapses to ONE demand row server-side. It is scoped to
   * this part and this quantity rather than being random, which is what makes it
   * a replay guard instead of a fresh token every render.
   */
  const idempotencyKey = `modal:${partId}:${requestedQty}`;

  const submit = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId,
          requestedQty,
          source: availableQty > 0 ? "shortage_during_order" : "out_of_stock_request",
          idempotencyKey,
        }),
      });

      if (response.status === 401) {
        /* Guest browsing still works; only recording a request needs identity. */
        setNeedsSignIn(true);
        return;
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error || t("shortage.failed"));
        return;
      }

      setDone(true);
      onCaptured?.();
    } catch {
      setError(t("shortage.failed"));
    } finally {
      setBusy(false);
    }
  }, [partId, requestedQty, availableQty, idempotencyKey, onCaptured, t]);

  /* A request that fits within stock needs no demand row: the cart handles it. */
  if (shortage <= 0) return null;

  return (
    <div className="sl-shortage">
      <p className="sl-shortage__heading">{t("shortage.heading")}</p>

      {/* `role="status"` so a screen reader announces the outcome once, without
          the numbers having to be discovered by walking the list. */}
      <ul className="sl-shortage__lines" aria-live="polite">
        <li className="sl-shortage__line">
          <span className="sl-shortage__lineLabel">
            {t("shortage.availableNow", { count: String(availableQty) })}
          </span>
          <span className="sl-shortage__lineValue sl-shortage__lineValue--ok">
            {availableQty}
          </span>
        </li>
        <li className="sl-shortage__line">
          <span className="sl-shortage__lineLabel">
            {t("shortage.additionalRequired", { count: String(shortage) })}
          </span>
          <span className="sl-shortage__lineValue sl-shortage__lineValue--short">
            {shortage}
          </span>
        </li>
      </ul>

      {done ? (
        <>
          <p className="sl-shortage__done" role="status">
            {availableQty > 0
              ? t("shortage.recordedWithStock", {
                  requested: String(requestedQty),
                  available: String(availableQty),
                  shortage: String(shortage),
                })
              : t("shortage.recorded", { count: String(requestedQty) })}
          </p>
          <p className="sl-shortage__hint">{t("shortage.queuedHint")}</p>
        </>
      ) : (
        <>
          {needsSignIn ? (
            <p className="sl-shortage__error" role="alert">
              {t("shortage.loginRequired")}
            </p>
          ) : null}
          {error ? (
            <p className="sl-shortage__error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="sl-btn sl-btn-primary sl-shortage__cta"
            onClick={() => void submit()}
            disabled={busy}
          >
            {needsSignIn
              ? t("shortage.signInToRequest")
              : busy
                ? t("shortage.requesting")
                : t("shortage.requestCta", { count: String(shortage) })}
          </button>
          {needsSignIn ? (
            <button
              type="button"
              className="sl-btn sl-btn-outline sl-shortage__cta"
              onClick={() => router.push("/login")}
            >
              {t("shortage.signInToRequest")}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}