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
  isAuthenticated = true,
}: {
  /**
   * Optional cap on the saved-vehicle chips rendered. Omitted (the default)
   * means "show every saved vehicle", which is what the full /vehicle-fitment
   * experience uses. The homepage passes a small limit so its section stays a
   * compact discovery affordance rather than a long strip.
   */
  limit?: number;
  browseAllHref?: string;
  /**
   * Whether a session exists. The saved-vehicle list is per-account and answers
   * 401 to an anonymous caller, so when this is false the garage calls are
   * skipped rather than made and rejected. Defaults to true so every existing
   * call site keeps its current behaviour unless it opts in.
   */
  isAuthenticated?: boolean;
} = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [garage, setGarage] = useState<GarageVehicle[]>([]);
  const [garageState, setGarageState] = useState<"loading" | "ready" | "guest" | "error">(
    /* Seeded from the prop rather than corrected inside an effect: a signed-out
       visitor is already in the "guest" state on the very first render, so there
       is no state to synchronise and no extra render. */
    isAuthenticated ? "loading" : "guest",
  );
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [garageMessage, setGarageMessage] = useState("");
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);

  const loadGarage = useCallback(async () => {
    /* No session means no saved vehicles, and /api/garage would answer 401, so
       there is nothing to fetch. */
    if (!isAuthenticated) {
      return;
    }
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
  }, [isAuthenticated]);

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

    /* Signed out: the saved-vehicle list cannot exist, and garageState was already
       seeded to "guest", so there is simply nothing to ask for and nothing to
       set. This is the same outcome the 401 branch below produced, minus the
       guaranteed-failed request and its console error. */
    if (!isAuthenticated) {
      return;
    }

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
  }, [isAuthenticated]);

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
      className="sl-panel p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-2.5">
        <div className="min-w-0">
          <p className="sl-eyebrow sl-eyebrow-plain flex items-center gap-2">
            <span
              className="inline-block h-[3px] w-5 bg-[var(--sl-brand)]"
              aria-hidden
            />
            {t("vehicleSelect.kicker")}
          </p>
          <h2 id="vehicle-selector-heading" className="sl-h3 mt-1.5">
            {t("vehicleSelect.title")}
          </h2>
        </div>
        <Link href={browseAllHref} className="sl-btn sl-btn-ghost sl-btn-sm shrink-0">
          {t("vehicleSelect.browseAll")}
        </Link>
      </div>

      {garageState === "loading" ? (
        <div className="sl-skel mt-3 h-11 w-full" aria-hidden />
      ) : garageState === "guest" ? (
        <p className="sl-small mt-3">
          <Link href="/login" className="sl-focus font-semibold text-[var(--sl-brand-ink)] underline-offset-2 hover:underline">
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
          <p className="sl-label mb-1.5">{t("garage.savedVehicles")}</p>
          {/* Ruled rows rather than a pill strip: a saved vehicle is a record,
              not a tag. The selected one is marked with the burgundy left rule
              used by the filter rail and the category menu. */}
          <ul className="divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
            {visibleGarage.map((vehicle) => {
              const active = selectedGarageId === vehicle.id;
              return (
                <li key={vehicle.id}>
                  <button
                    type="button"
                    onClick={() => applyGarageVehicle(vehicle)}
                    onDoubleClick={() =>
                      router.push(garageFitmentHref(vehicle.make, vehicle.model))
                    }
                    aria-pressed={active}
                    className={`sl-focus flex min-h-11 w-full items-center justify-between gap-3 border-l-2 px-2.5 py-1.5 text-left transition-colors ${
                      active
                        ? "border-[var(--sl-brand)] bg-[var(--sl-brand-soft)]"
                        : "border-transparent hover:bg-[var(--sl-sunken)]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="sl-clamp-1 block text-[0.8125rem] font-semibold text-[var(--sl-ink)]">
                        {vehicle.make}
                      </span>
                      <span className="sl-clamp-1 block text-[0.75rem] text-[var(--sl-ink-3)]">
                        {vehicle.model}
                      </span>
                    </span>
                    <span
                      className={`sl-num shrink-0 text-[0.6875rem] font-bold ${
                        active
                          ? "text-[var(--sl-brand-ink)]"
                          : "text-[var(--sl-ink-3)]"
                      }`}
                    >
                      {garageVehicleLabel(vehicle)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hiddenGarageCount > 0 || selectedGarageId ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              {hiddenGarageCount > 0 ? (
                <Link
                  href={browseAllHref}
                  className="sl-focus text-[0.75rem] font-semibold text-[var(--sl-brand-ink)]"
                >
                  {t("vehicleSelect.moreCount", { count: String(hiddenGarageCount) })} · {t("vehicleSelect.browseAll")}
                </Link>
              ) : null}
              {selectedGarageId ? (
                <button
                  type="button"
                  onClick={() => {
                    const selected = garage.find((row) => row.id === selectedGarageId);
                    if (selected) {
                      router.push(garageFitmentHref(selected.make, selected.model));
                    }
                  }}
                  className="sl-focus text-[0.75rem] font-semibold text-[var(--sl-brand-ink)]"
                >
                  {t("garage.viewParts")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="sl-small mt-3">{t("garage.emptyShort")}</p>
      )}

      {/* The gutter number states the order, so "make, then model" is part
          of the layout rather than something the field sequence implies. */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div>
          <label htmlFor="vq-make" className="sl-label mb-1 flex items-center gap-2 !text-[0.625rem]">
            <span className="sl-part !text-[var(--sl-brand-ink)]">01</span>
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
            className="sl-select !h-11 !w-full !max-w-none !text-[0.875rem]"
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
          <label htmlFor="vq-model" className="sl-label mb-1 flex items-center gap-2 !text-[0.625rem]">
            <span className="sl-part !text-[var(--sl-brand-ink)]">02</span>
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
            className="sl-select !h-11 !w-full !max-w-none !text-[0.875rem] disabled:opacity-50"
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
        <p className="sl-small mt-2 !text-[var(--sl-ok)]" role="status">
          {garageMessage}
        </p>
      ) : null}

      {/* One primary action. Save is secondary beside it rather than a second
          primary, so the eye lands on "show parts" first. The previous primary
          was bg-slate-950, which is not a brand or state colour. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={!make}
          onClick={showParts}
          className="sl-btn sl-btn-primary !min-h-12 disabled:!border-[var(--sl-rule)] disabled:!bg-[var(--sl-sunken)] disabled:!text-[var(--sl-ink-3)]"
        >
          {t("vehicleSelect.showParts")}
        </button>
        {garageState === "ready" && make && model && !alreadySaved ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCurrentToGarage()}
            className="sl-btn sl-btn-secondary !min-h-12 disabled:opacity-50"
          >
            {saving ? t("garage.saving") : t("garage.saveVehicle")}
          </button>
        ) : garageState === "guest" && make && model ? (
          <Link href="/login" className="sl-btn sl-btn-secondary !min-h-12">
            {t("garage.loginToSave")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
