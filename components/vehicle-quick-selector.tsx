"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import {
  garageFitmentHref,
  garageVehicleLabel,
  type GarageVehicle,
} from "@/lib/garage";
import { slugifyFitment } from "@/lib/vehicle-fitment";

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
};

/**
 * A saved-vehicles response that means "this visitor has no customer garage"
 * rather than "the request failed".
 *
 * /api/garage returns:
 *   401 - no session at all
 *   403 - a session that is not a customer account (e.g. a dealer browsing
 *         the public storefront)
 *
 * Both are ordinary states for a public visitor with nothing saved, and both
 * were previously funnelled into the error branch, which rendered a red
 * "Unable to load saved vehicles." on the public homepage. A genuine failure
 * (5xx, or the request not completing) is the only thing that should look like
 * an error now.
 */
function isNoGarageResponse(response: Response) {
  return response.status === 401 || response.status === 403;
}

export function VehicleQuickSelector({
  limit,
  browseAllHref = "/vehicle-fitment",
}: {
  /**
   * Optional cap on the saved-vehicle chips rendered. Omitted (the default)
   * means "show every saved vehicle", which is what the full /vehicle-fitment
   * experience uses. The homepage passes a small limit so its section stays a
   * compact discovery affordance rather than a long strip.
   */
  limit?: number;
  browseAllHref?: string;
} = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [garage, setGarage] = useState<GarageVehicle[]>([]);
  const [garageState, setGarageState] = useState<"loading" | "ready" | "guest" | "error">(
    "loading",
  );
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [garageMessage, setGarageMessage] = useState("");
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);

  const loadGarage = useCallback(async () => {
    try {
      const response = await fetch("/api/garage", { cache: "no-store" });
      if (isNoGarageResponse(response)) {
        setGarage([]);
        setGarageState("guest");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGarage([]);
        setGarageState("error");
        return;
      }
      setGarage(Array.isArray(data.vehicles) ? data.vehicles : []);
      setGarageState("ready");
    } catch {
      setGarage([]);
      setGarageState("guest");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/vehicles", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : []);
      })
      .catch(() => {
        if (active) setVehicles([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void fetch("/api/garage", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        /* 401 = not signed in. 403 = signed in, but not a customer account
           (a dealer browsing the public site, for example). Neither means the
           saved-vehicles request FAILED \u2014 both mean "you have no garage here",
           so neither may surface a red error to the visitor. */
        if (isNoGarageResponse(response)) {
          setGarage([]);
          setGarageState("guest");
          return;
        }
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setGarage([]);
          setGarageState("error");
          return;
        }
        setGarage(Array.isArray(data.vehicles) ? data.vehicles : []);
        setGarageState("ready");
      })
      .catch(() => {
        if (active) {
          setGarage([]);
          setGarageState("guest");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const makes = useMemo(() => {
    const set = new Set<string>();
    for (const row of vehicles) {
      if (row.make) set.add(row.make);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [vehicles]);

  const models = useMemo(() => {
    if (!make) return [];
    const set = new Set<string>();
    for (const row of vehicles) {
      if (row.make === make && row.model) set.add(row.model);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [vehicles, make]);

  function applyGarageVehicle(vehicle: GarageVehicle) {
    setSelectedGarageId(vehicle.id);
    setMake(vehicle.make);
    setModel(vehicle.model);
    setGarageMessage("");
  }

  function showParts() {
    if (!make) return;
    const href = model
      ? garageFitmentHref(make, model)
      : `/vehicle-fitment/${encodeURIComponent(slugifyFitment(make))}`;
    router.push(href);
  }

  async function saveCurrentToGarage() {
    if (!make.trim() || !model.trim()) return;
    setSaving(true);
    setGarageMessage("");
    try {
      const response = await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: make.trim(),
          model: model.trim(),
          isPrimary: garage.length === 0,
        }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGarageMessage(
          typeof data.error === "string" ? data.error : t("garage.saveFail"),
        );
        return;
      }
      setGarageMessage(t("garage.saved"));
      await loadGarage();
    } catch {
      setGarageMessage(t("garage.saveFail"));
    } finally {
      setSaving(false);
    }
  }

  const alreadySaved = garage.some(
    (row) =>
      row.make.toLowerCase() === make.trim().toLowerCase() &&
      row.model.toLowerCase() === model.trim().toLowerCase(),
  );

  // A `limit` caps the saved-vehicle chips. Omitted = show every saved vehicle.
  const visibleGarage =
    typeof limit === "number" && limit >= 0 ? garage.slice(0, limit) : garage;
  const hiddenGarageCount = garage.length - visibleGarage.length;

  return (
    <section
      aria-labelledby="vehicle-selector-heading"
      className="sl-v2-card p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--sl-primary)]">
            {t("vehicleSelect.kicker")}
          </p>
          <h2 id="vehicle-selector-heading" className="sl-h3 text-base">
            {t("vehicleSelect.title")}
          </h2>
        </div>
        <Link
          href={browseAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sl-primary)] underline-offset-2 transition-colors duration-200 hover:text-[var(--sl-primary)] hover:underline"
        >
          {t("vehicleSelect.browseAll")}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      {garageState === "loading" ? (
        <div className="sl-skeleton mt-3 h-10 w-full rounded-[var(--sl-radius)]" aria-hidden />
      ) : garageState === "guest" ? (
        <p className="mt-3 text-xs text-[var(--sl-muted)]">
          <Link href="/login" className="font-semibold text-[var(--sl-primary)] underline-offset-2 hover:underline">
            {t("nav.login")}
          </Link>{" "}
          {t("garage.loginHint")}
        </p>
      ) : garageState === "error" ? (
        /* Only reachable now on a genuine 5xx / failed request. Softened from a
           red alert to a muted note so a transient failure does not read as a
           broken website, while still telling the user something happened. */
        <p className="sl-small mt-3" role="status">
          {t("garage.loadFailSoft")}
        </p>
      ) : garage.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--sl-muted)]">
            {t("garage.savedVehicles")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleGarage.map((vehicle) => {
              const active = selectedGarageId === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => applyGarageVehicle(vehicle)}
                  onDoubleClick={() => router.push(garageFitmentHref(vehicle.make, vehicle.model))}
                  className={`min-h-11 shrink-0 rounded-full border px-3 text-left text-xs font-semibold ${
                    active
                      ? "border-brand-700 bg-[var(--sl-primary)] text-white"
                      : "border-[var(--sl-border-strong)] bg-white text-[var(--sl-text-soft)] transition-colors duration-200 hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)]"
                  }`}
                  aria-pressed={active}
                >
                  <span className="block max-w-[10.5rem] truncate">
                    {garageVehicleLabel(vehicle)}
                  </span>
                </button>
              );
            })}
          </div>
          {hiddenGarageCount > 0 ? (
            <Link
              href={browseAllHref}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--sl-primary)] transition-colors duration-200 hover:text-[var(--sl-primary)]"
            >
              {hiddenGarageCount} more · {t("vehicleSelect.browseAll")}
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          ) : null}
          {selectedGarageId ? (
            <button
              type="button"
              onClick={() => {
                const selected = garage.find((row) => row.id === selectedGarageId);
                if (selected) router.push(garageFitmentHref(selected.make, selected.model));
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sl-primary)] transition-colors duration-200 hover:text-[var(--sl-primary)]"
            >
              {t("garage.viewParts")}
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--sl-muted)]">{t("garage.emptyShort")}</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="vq-make" className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
            {t("vehicleSelect.make")}
          </label>
          <select
            id="vq-make"
            disabled={loading}
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
              setSelectedGarageId(null);
            }}
            className="min-h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)] px-3 text-sm outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-[var(--sl-primary)]/20"
          >
            <option value="">{loading ? t("vehicleSelect.loading") : t("vehicleSelect.chooseMake")}</option>
            {makes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vq-model" className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
            {t("vehicleSelect.model")}
          </label>
          <select
            id="vq-model"
            disabled={!make}
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setSelectedGarageId(null);
            }}
            className="min-h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)] px-3 text-sm outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-[var(--sl-primary)]/20 disabled:opacity-50"
          >
            <option value="">{t("vehicleSelect.chooseModel")}</option>
            {models.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {garageMessage ? (
        <p className="mt-2 text-xs font-medium text-emerald-700" role="status">
          {garageMessage}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!make}
          onClick={showParts}
          className="btn-press flex min-h-12 items-center justify-center rounded-[var(--sl-radius)] bg-slate-950 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {t("vehicleSelect.showParts")}
        </button>
        {garageState === "ready" && make && model && !alreadySaved ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCurrentToGarage()}
            className="btn-press sl-v2-btn sl-v2-btn-primary min-h-12 disabled:opacity-50"
          >
            {saving ? t("garage.saving") : t("garage.saveVehicle")}
          </button>
        ) : garageState === "guest" && make && model ? (
          <Link
            href="/login"
            className="sl-v2-btn sl-v2-btn-secondary min-h-12"
          >
            {t("garage.loginToSave")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
