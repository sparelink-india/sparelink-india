"use client";

/**
 * Dealer Quick Order.
 *
 * WHY THIS WAS REWRITTEN
 * The previous implementation searched with the public `/api/search/parts` and
 * then posted the basket to `/api/cart`. `/api/cart` is buyer-only: it gates on
 * `role === "buyer"`, so for an actual dealer every add returned 401 and the
 * panel could never complete an order. The feature was structurally broken.
 *
 * The fix is NOT to relax the buyer gate on `/api/cart` - that would let dealer
 * sessions create customer carts and is the wrong direction. Instead this panel
 * now uses the dealer-specific path that already exists and is already correct:
 *
 *   - `/api/dealer/dashboard`  (GET)  -> the dealer's OWN listings, so every
 *                                        line is resolved to a listing the
 *                                        dealer actually owns;
 *   - `/api/dealer/sales-orders` (POST) -> creates a DRAFT sales order.
 *
 * That endpoint already does the things a money-touching path must do:
 * `stripClientMoneyFields` on the body and on every line, an active-listing
 * existence check, an explicit `listing.dealerId !== profile.id` ownership
 * check, and `resolvePartyEffectivePrice` for authoritative dealer pricing with
 * `applyVerificationFallback: false`. GST and totals are computed server-side.
 *
 * This panel therefore only ever sends `dealerListingId` + `quantity`. It never
 * sends a price, a GST figure, a total or a firm, and it never trusts a price it
 * displays.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";

type DealerListing = {
  id: string;
  partName: string | null;
  partNumber: string | null;
  sku: string | null;
  pricePaise: number;
  status: string;
  stock: number | null;
};

type BasketLine = {
  dealerListingId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  stock: number | null;
  status: string;
};

function rupees(paise: number): string {
  return `â‚¹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function QuickOrderPanel() {
  const { t } = useI18n();

  const [listings, setListings] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [partyName, setPartyName] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/dealer/dashboard", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          listings?: DealerListing[];
          businessName?: string;
        };
        if (cancelled) return;
        setListings(Array.isArray(data.listings) ? data.listings : []);
        if (!partyName && data.businessName) setPartyName(data.businessName);
      } catch {
        if (!cancelled) setLoadError(t("common.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `partyName` is intentionally not a dependency: it is seeded once from the
    // dealer profile and is owned by the input from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const activeListings = useMemo(
    () => listings.filter((row) => row.status === "active"),
    [listings],
  );

  /** Match against the dealer's own listings only, by part number or name. */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 1) return activeListings.slice(0, 12);
    return activeListings
      .filter((row) => {
        const number = (row.partNumber ?? "").toLowerCase();
        const name = (row.partName ?? "").toLowerCase();
        const sku = (row.sku ?? "").toLowerCase();
        return (
          number.includes(needle) ||
          sku.includes(needle) ||
          name.includes(needle)
        );
      })
      .slice(0, 12);
  }, [activeListings, query]);

  const inBasket = useCallback(
    (dealerListingId: string) =>
      basket.find((line) => line.dealerListingId === dealerListingId),
    [basket],
  );

  /**
   * Add one unit, merging into an existing line for the same listing.
   * Quantity is capped by known stock so the panel cannot build a line the
   * server will certainly reject.
   */
  const addLine = useCallback((listing: DealerListing) => {
    setSuccess("");
    setSubmitError("");
    setBasket((current) => {
      const existing = current.find(
        (line) => line.dealerListingId === listing.id,
      );
      const cap =
        listing.stock === null ? Number.MAX_SAFE_INTEGER : Math.max(0, listing.stock);

      if (!existing) {
        if (cap < 1) return current;
        return [
          ...current,
          {
            dealerListingId: listing.id,
            partNumber: listing.partNumber ?? "",
            partName: listing.partName ?? "",
            quantity: 1,
            stock: listing.stock,
            status: listing.status,
          },
        ];
      }

      if (existing.quantity + 1 > cap) return current;
      return current.map((line) =>
        line.dealerListingId === listing.id
          ? { ...line, quantity: line.quantity + 1 }
          : line,
      );
    });
  }, []);

  const changeQuantity = useCallback(
    (dealerListingId: string, next: number) => {
      setBasket((current) =>
        current
          .map((line) =>
            line.dealerListingId === dealerListingId
              ? {
                  ...line,
                  quantity: Math.min(
                    line.stock === null
                      ? Math.max(1, next)
                      : Math.max(1, Math.min(line.stock, next)),
                    999,
                  ),
                }
              : line,
          )
          .filter((line) => line.quantity > 0),
      );
    },
    [],
  );

  const removeLine = useCallback((dealerListingId: string) => {
    setBasket((current) =>
      current.filter((line) => line.dealerListingId !== dealerListingId),
    );
  }, []);

  /**
   * Indicative total for the review table only.
   *
   * This is list price and is labelled as such. It is NOT the payable figure:
   * the authoritative net price, GST and total are all computed server-side by
   * `/api/dealer/sales-orders`, which strips every money field we send.
   */
  const indicativeListTotalPaise = useMemo(
    () =>
      basket.reduce((sum, line) => {
        const listing = listings.find(
          (row) => row.id === line.dealerListingId,
        );
        return sum + (listing ? listing.pricePaise * line.quantity : 0);
      }, 0),
    [basket, listings],
  );

  const blockedLines = basket.filter(
    (line) => line.stock !== null && line.stock < line.quantity,
  );

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    setSuccess("");

    try {
      const response = await fetch("/api/dealer/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName: partyName.trim() || undefined,
          notes: notes.trim() || undefined,
          // Money fields are intentionally absent. The server prices these.
          items: basket.map((line) => ({
            dealerListingId: line.dealerListingId,
            quantity: line.quantity,
          })),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; salesOrder?: { soNumber?: string } }
        | null;

      if (!response.ok) {
        setSubmitError(data?.error ?? `HTTP ${response.status}`);
        return;
      }

      setSuccess(
        data?.salesOrder?.soNumber
          ? `${t("dealer.quickOrderCreated")} ${data.salesOrder.soNumber}`
          : t("dealer.quickOrderCreated"),
      );
      setBasket([]);
      setNotes("");
    } catch {
      setSubmitError(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sl-panel p-4 sm:p-5">
      <label className="sl-label mb-1.5 block" htmlFor="dealer-quick-order-search">
        {t("dealer.quickOrderSearch")}
      </label>
      <input
        id="dealer-quick-order-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("dealer.quickOrderSearchPlaceholder")}
        className="sl-input"
        autoComplete="off"
      />

      {loading ? (
        <p className="sl-small mt-3">{t("common.loading")}</p>
      ) : loadError ? (
        <p className="sl-small mt-3 text-[var(--sl-bad)]">{loadError}</p>
      ) : matches.length === 0 ? (
        <p className="sl-small mt-3">
          {query.trim()
            ? t("dealer.quickOrderNoMatch")
            : t("dealer.quickOrderNoListings")}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
          {matches.map((listing) => {
            const already = inBasket(listing.id);
            const outOfStock = listing.stock !== null && listing.stock < 1;
            return (
              <li
                key={listing.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="sl-partno">{listing.partNumber ?? "-"}</p>
                  <p className="sl-small mt-0.5 line-clamp-1">
                    {listing.partName ?? ""}
                  </p>
                  <p className="sl-small mt-0.5">
                    {t("dealer.quickOrderListPrice")}{" "}
                    <InclusivePrice pricePaise={listing.pricePaise} />
                    {listing.stock === null ? null : (
                      <>
                        {" Â· "}
                        {t("dealer.stock")}: {listing.stock}
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addLine(listing)}
                  disabled={outOfStock || Boolean(already)}
                  className="sl-btn sl-btn-secondary sl-btn-sm shrink-0"
                >
                  {outOfStock ? t("product.outOfStock") : t("product.addToCart")}
                </button>
                {already ? (
                  <span className="sl-num shrink-0 text-[var(--sl-ink-3)]">
                    Ã—{already.quantity}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5">
        <h3 className="sl-h3">{t("dealer.quickOrderBasket")}</h3>

        {basket.length === 0 ? (
          <p className="sl-small mt-2">{t("dealer.quickOrderEmpty")}</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
              {basket.map((line) => (
                <li
                  key={line.dealerListingId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="sl-partno">{line.partNumber || "-"}</p>
                    <p className="sl-small mt-0.5 line-clamp-1">
                      {line.partName}
                    </p>
                    {line.stock !== null && line.stock < line.quantity ? (
                      <p className="sl-small mt-0.5 text-[var(--sl-bad)]">
                        {t("dealer.quickOrderStockShort")} ({line.stock})
                      </p>
                    ) : null}
                  </div>
                  <label className="flex shrink-0 items-center gap-2">
                    <span className="sr-only">
                      {t("dealer.quickOrderQuantityFor")} {line.partNumber}
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        changeQuantity(
                          line.dealerListingId,
                          Number(event.target.value) || 1,
                        )
                      }
                      className="sl-input h-10 w-20 text-center"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeLine(line.dealerListingId)}
                    className="sl-btn sl-btn-ghost sl-btn-sm shrink-0"
                  >
                    {t("cart.remove")}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="sl-small">
                {t("dealer.quickOrderIndicative")}{" "}
                <span className="sl-num font-bold">
                  {rupees(indicativeListTotalPaise)}
                </span>
              </p>
              <p className="sl-small">{t("dealer.quickOrderFinalNote")}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="sl-label mb-1.5 block">
                  {t("dealer.quickOrderParty")}
                </span>
                <input
                  value={partyName}
                  onChange={(event) => setPartyName(event.target.value)}
                  className="sl-input"
                  autoComplete="organization"
                />
              </label>
              <label className="block min-w-0">
                <span className="sl-label mb-1.5 block">
                  {t("dealer.quickOrderNotes")}
                </span>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="sl-input"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || blockedLines.length > 0}
              className="sl-btn sl-btn-primary mt-4 w-full sm:w-auto"
            >
              {submitting
                ? t("common.loading")
                : t("dealer.quickOrderSubmit")}
            </button>

            {blockedLines.length > 0 ? (
              <p
                className="sl-small mt-2 text-[var(--sl-bad)]"
                role="alert"
              >
                {t("dealer.quickOrderFixStock")}
              </p>
            ) : null}
          </>
        )}

        {submitError ? (
          <p className="sl-small mt-3 text-[var(--sl-bad)]" role="alert">
            {submitError}
          </p>
        ) : null}
        {success ? (
          <p
            className="sl-small mt-3 text-[var(--sl-ok)]"
            role="status"
            aria-live="polite"
          >
            {success}
          </p>
        ) : null}
      </div>
    </div>
  );
}

