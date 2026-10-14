"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import { Notice } from "@/components/page-states";
import {
  garageFitmentHref,
  garageVehicleLabel,
  type GarageVehicle,
} from "@/lib/garage";

type CatalogVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
};

type GarageVehiclesPanelProps = {
  /** Compact mobile-first panel (default). */
  compact?: boolean;
  className?: string;
};

export function GarageVehiclesPanel({
  compact = true,
  className = "",
}: GarageVehiclesPanelProps) {
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [catalog, setCatalog] = useState<CatalogVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [year, setYear] = useState("");

  const loadGarage = useCallback(async () => {
    setError("");
    const response = await fetch("/api/garage", { cache: "no-store" });
    if (response.status === 401) {
      setNeedsLogin(true);
      setVehicles([]);
      setLoading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : t("garage.loadFail"));
      setLoading(false);
      return;
    }
    setNeedsLogin(false);
    setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    let active = true;
    async function initGarage() {
      const response = await fetch("/api/garage", { cache: "no-store" });
      if (!active) return;
      if (response.status === 401) {
        setNeedsLogin(true);
        setVehicles([]);
        setLoading(false);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : t("garage.loadFail"));
        setLoading(false);
        return;
      }
      setNeedsLogin(false);
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
      setLoading(false);
    }
    void initGarage();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!showAdd) return;
    void fetch("/api/vehicles", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setCatalog(Array.isArray(data?.vehicles) ? data.vehicles : []);
      })
      .catch(() => setCatalog([]));
  }, [showAdd]);

  const makes = useMemo(() => {
    const set = new Set<string>();
    for (const row of catalog) {
      if (row.make) set.add(row.make);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const models = useMemo(() => {
    if (!make) return [];
    const set = new Set<string>();
    for (const row of catalog) {
      if (row.make === make && row.model) set.add(row.model);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalog, make]);

  const variants = useMemo(() => {
    if (!make || !model) return [];
    const set = new Set<string>();
    for (const row of catalog) {
      if (row.make === make && row.model === model && row.variant) set.add(row.variant);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalog, make, model]);

  async function removeVehicle(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/garage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : t("garage.removeFail"));
        return;
      }
      setVehicles((prev) => prev.filter((row) => row.id !== id));
      setMessage(t("garage.removed"));
    } catch {
      setError(t("garage.removeFail"));
    } finally {
      setBusyId("");
    }
  }

  async function addVehicle() {
    if (!make.trim() || !model.trim()) {
      setError(t("garage.makeModelRequired"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const yearNum = year.trim() ? Number(year) : null;
      const response = await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          make: make.trim(),
          model: model.trim(),
          variant: variant.trim() || null,
          year: yearNum,
          isPrimary: vehicles.length === 0,
        }),
      });
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : t("garage.saveFail"));
        return;
      }
      setMessage(t("garage.saved"));
      setShowAdd(false);
      setMake("");
      setModel("");
      setVariant("");
      setYear("");
      await loadGarage();
    } catch {
      setError(t("garage.saveFail"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="garage"
      aria-labelledby="garage-heading"
      className={`sl-panel ${compact ? "p-3" : "p-4 sm:p-5"} ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--sl-rule)] pb-3">
        <div className="min-w-0">
          <p className="sl-eyebrow">{t("garage.kicker")}</p>
          <h2 id="garage-heading" className="sl-h3 mt-1.5">
            {t("garage.title")}
          </h2>
          <p className="sl-hint">{t("garage.hint")}</p>
        </div>
        {!needsLogin ? (
          <button
            type="button"
            onClick={() => {
              setShowAdd((open) => !open);
              setError("");
              setMessage("");
            }}
            aria-expanded={showAdd}
            className="sl-btn sl-btn-secondary sl-btn-sm sl-focus shrink-0"
          >
            {showAdd ? t("common.cancel") : t("garage.add")}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {message ? (
        <div className="mt-3">
          <Notice tone="success">{message}</Notice>
        </div>
      ) : null}

      {/* Loading is shaped like the real rows — a divided list of two — so the
          panel does not change height when the vehicles arrive. */}
      {loading ? (
        <div className="mt-3 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]" aria-busy="true">
          {[1, 2].map((n) => (
            <div key={n} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="sl-skel h-3.5 w-32" />
                <div className="sl-skel mt-1.5 h-3 w-24" />
              </div>
              <div className="sl-skel h-10 w-20" />
            </div>
          ))}
          <p className="sr-only">{t("garage.loading")}</p>
        </div>
      ) : needsLogin ? (
        <div className="mt-4 rounded-[var(--sl-r)] border border-dashed border-[var(--sl-rule-strong)] bg-[var(--sl-sunken)] p-5">
          <p className="sl-body">{t("garage.login")}</p>
          <Link href="/login" className="sl-btn sl-btn-primary mt-3">
            {t("nav.login")}
          </Link>
        </div>
      ) : (
        <>
          {showAdd ? (
            <div className="mt-3 rounded-[var(--sl-r)] border border-[var(--sl-rule-strong)] bg-[var(--sl-sunken)] p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="garage-make" className="sl-label">
                    {t("vehicleSelect.make")}
                  </label>
                  <select
                    id="garage-make"
                    value={make}
                    onChange={(e) => {
                      setMake(e.target.value);
                      setModel("");
                      setVariant("");
                    }}
                    className="sl-select"
                  >
                    <option value="">{t("vehicleSelect.chooseMake")}</option>
                    {makes.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="garage-model" className="sl-label">
                    {t("vehicleSelect.model")}
                  </label>
                  <select
                    id="garage-model"
                    disabled={!make}
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setVariant("");
                    }}
                    className="sl-select"
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
              {variants.length > 0 ? (
                <div>
                  <label htmlFor="garage-variant" className="sl-label">
                    {t("garage.variant")}
                  </label>
                  <select
                    id="garage-variant"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="sl-select"
                  >
                    <option value="">{t("garage.anyVariant")}</option>
                    {variants.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label htmlFor="garage-year" className="sl-label">
                  {t("garage.yearOptional")}
                </label>
                <input
                  id="garage-year"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  placeholder="2019"
                  className="sl-input"
                />
              </div>
              <button
                type="button"
                disabled={saving || !make || !model}
                onClick={() => void addVehicle()}
                className="sl-btn sl-btn-primary sl-btn-block mt-3"
              >
                {saving ? t("garage.saving") : t("garage.saveVehicle")}
              </button>
            </div>
          ) : null}

          {vehicles.length === 0 ? (
            <div className="mt-4 rounded-[var(--sl-r)] border border-dashed border-[var(--sl-rule-strong)] bg-[var(--sl-sunken)] p-5">
              <p className="sl-eyebrow">
                {t("garage.title")}
              </p>
              <p className="sl-body mt-1.5">{t("garage.empty")}</p>
              {!showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="sl-btn sl-btn-primary mt-3"
                >
                  {t("garage.add")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul
              className="mt-3 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]"
            >
              {/* ---- RULED VEHICLE RECORDS ----
                  One row per saved vehicle, divided by a hairline. On mobile
                  the row wraps so the identity keeps its width and the actions
                  drop beneath it, rather than the name being truncated to two
                  words to make room for them. */}
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
                >
                  <Link
                    href={garageFitmentHref(vehicle.make, vehicle.model)}
                    className="sl-focus min-w-0 flex-1 border-l-2 border-transparent py-0.5 pl-2 transition-colors hover:border-[var(--sl-brand)] hover:bg-[var(--sl-sunken)]"
                  >
                    {/* Identity as a two-line specification, the way a parts
                        catalogue writes a vehicle: make, then model. */}
                    <span className="block truncate text-[0.875rem] font-bold text-[var(--sl-ink)]">
                      {vehicle.make}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--sl-ink-2)]">
                      {vehicle.model}
                      {vehicle.variant ? (
                        <span className="text-[var(--sl-ink-3)]">
                          {" · "}
                          {vehicle.variant}
                        </span>
                      ) : null}
                    </span>
                    {vehicle.registrationNumber ? (
                      <span className="sl-part mt-1 block truncate text-[0.6875rem]">
                        {vehicle.registrationNumber}
                      </span>
                    ) : null}
                    {/* The full label is still exposed to assistive tech, so
                        make + model + variant announce as one vehicle name. */}
                    <span className="sr-only">{garageVehicleLabel(vehicle)}</span>
                  </Link>

                  {vehicle.isPrimary ? (
                    <span className="sl-badge sl-badge-ok shrink-0">
                      {t("garage.primary")}
                    </span>
                  ) : null}

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={garageFitmentHref(vehicle.make, vehicle.model)}
                      className="sl-btn sl-btn-secondary sl-btn-sm sl-focus"
                    >
                      {t("garage.viewParts")}
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === vehicle.id}
                      onClick={() => void removeVehicle(vehicle.id)}
                      className="sl-btn sl-btn-secondary sl-btn-sm sl-focus hover:border-[var(--sl-bad-line)] hover:bg-[var(--sl-bad-soft)] hover:text-[var(--sl-bad)]"
                      aria-label={t("garage.removeAria", {
                        name: garageVehicleLabel(vehicle),
                      })}
                    >
                      {busyId === vehicle.id ? (
                        <span
                          className="sl-skel inline-block h-3 w-10"
                          aria-hidden
                        />
                      ) : (
                        t("cart.remove")
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
