"use client";

import { useI18n } from "@/components/preferences-provider";

/**
 * V2 order status timeline.
 *
 * IMPORTANT — these stages are NOT invented. They are exactly the order
 * statuses the application writes and reads:
 *   placed -> confirmed -> processing -> packed -> shipped -> delivered
 * with `cancelled` as a terminal branch. Verified against
 * `lib/order-cancel-restock.ts`, `lib/admin-orders-dashboard.ts` and
 * `drizzle/schema.ts`.
 *
 * There is no carrier integration in this project, so no tracking number,
 * courier name or scan history is shown — only what the order record actually
 * contains. A stage the order has not reached yet renders as "pending", and
 * nothing claims a shipment is in transit unless `status` says so.
 */

const STAGES = [
  { key: "placed", labelKey: "track.stagePlaced" },
  { key: "confirmed", labelKey: "track.stageConfirmed" },
  { key: "processing", labelKey: "track.stageProcessing" },
  { key: "packed", labelKey: "track.stagePacked" },
  { key: "shipped", labelKey: "track.stageShipped" },
  { key: "delivered", labelKey: "track.stageDelivered" },
] as const;

const norm = (value: string) => value.trim().toLowerCase();

export function OrderStatusTimeline({
  status,
  paymentStatus,
  className = "",
}: {
  status: string;
  paymentStatus?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const current = norm(status);
  const isCancelled = current === "cancelled";
  const isDelivered = current === "delivered";

  /* An unrecognised status must not silently render as "step 1 of 6". If the
     value is outside the known set, we say so instead of guessing. */
  const known = isCancelled || STAGES.some((stage) => stage.key === current);
  const reachedIndex = known
    ? STAGES.findIndex((stage) => stage.key === current)
    : -1;

  if (!known) {
    return (
      <div
        className={`rounded-[var(--sl-radius-sm)] border border-[var(--sl-border-strong)] bg-[var(--sl-surface-sunk)] px-4 py-3 ${className}`}
      >
        <p className="sl-small">
          {t("track.statusUnknown", { status: status || t("track.statusNone") })}
        </p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div
        role="status"
        className={`rounded-[var(--sl-radius)] border border-[#f0c8c5] bg-[var(--sl-danger-soft)] px-4 py-3.5 ${className}`}
      >
        <p className="sl-h3 !text-[var(--sl-danger)]">{t("track.stageCancelled")}</p>
        <p className="sl-small mt-1">{t("track.cancelledBody")}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ol className="space-y-0" aria-label={t("track.progressLabel")}>
        {STAGES.map((stage, index) => {
          const done = reachedIndex > index;
          const currentStep = reachedIndex === index;
          const isLast = index === STAGES.length - 1;

          return (
            <li key={stage.key} className="flex gap-3.5">
              {/* Rail: the connector is drawn for every step except the last,
                  so the line stops at the end of the flow. */}
              <div className="flex flex-col items-center">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-[var(--sl-primary)] bg-[var(--sl-primary)] text-white"
                      : currentStep
                        ? "border-[var(--sl-primary)] bg-white text-[var(--sl-primary)]"
                        : "border-[var(--sl-border-strong)] bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  {done ? (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  ) : currentStep ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--sl-primary)]" />
                  ) : null}
                </span>
                {!isLast ? (
                  <span
                    className={`w-0.5 flex-1 ${
                      done ? "bg-[var(--sl-primary)]" : "bg-[var(--sl-border)]"
                    }`}
                    style={{ minHeight: "1.5rem" }}
                    aria-hidden
                  />
                ) : null}
              </div>

              <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`text-sm ${
                    currentStep
                      ? "font-bold text-[var(--sl-text)]"
                      : done
                        ? "font-semibold text-[var(--sl-text-soft)]"
                        : "text-[var(--sl-muted)]"
                  }`}
                >
                  {t(stage.labelKey)}
                </p>
                <p className="sl-small mt-0.5">
                  {done || currentStep
                    ? isDelivered && currentStep
                      ? t("track.stageDeliveredBody")
                      : currentStep
                        ? t("track.stageCurrent")
                        : t("track.stageDone")
                    : t("track.stagePending")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {paymentStatus ? (
        <p className="sl-small mt-4 border-t border-[var(--sl-border)] pt-3.5">
          {t("track.paymentLabel")}{" "}
          <span className="sl-v2-badge sl-v2-badge-brand ml-1">
            {paymentStatus}
          </span>
        </p>
      ) : null}
    </div>
  );
}
