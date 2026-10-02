"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
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
      className={`rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)]  ${compact ? "p-3" : "p-5"} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--v3-ok)]">
            {t("garage.kicker")}
          </p>
          <h2 id="garage-heading" className="text-base font-bold text-[var(--v3-text)] sm:text-lg">
            {t("garage.title")}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--v3-text-3)]">{t("garage.hint")}</p>
        </div>
        {!needsLogin ? (
          <button
            type="button"
            onClick={() => {
              setShowAdd((open) => !open);
              setError("");
              setMessage("");
            }}
            className="min-h-10 shrink-0 rounded-[var(--v3-r)] border border-[var(--v3-rule)] px-3 text-xs font-semibold text-[var(--v3-text)]"
          >
            {showAdd ? t("common.cancel") : t("garage.add")}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-[var(--v3-r)] border border-[var(--v3-bad-line)] bg-[var(--v3-bad-soft)] px-3 py-2 text-xs font-medium text-[var(--v3-bad)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 rounded-[var(--v3-r)] border border-[var(--v3-ok-line)] bg-[var(--v3-ok-soft)] px-3 py-2 text-xs font-medium text-[var(--v3-ok)]">
          {message}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          {[1, 2].map((n) => (
            <div key={n} className="h-14 animate-pulse rounded-[var(--v3-r)] bg-[var(--v3-sunk)]" />
          ))}
          <p className="sr-only">{t("garage.loading")}</p>
        </div>
      ) : needsLogin ? (
        <div className="mt-3 rounded-[var(--v3-r)] border border-dashed border-[var(--v3-rule-strong)] bg-[var(--v3-sunk)] p-4 text-center">
          <p className="text-sm text-[var(--v3-text-2)]">{t("garage.login")}</p>
          <Link
            href="/login"
            className="mt-3 inline-flex min-h-11 items-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-5 text-xs font-bold text-white"
          >
            {t("nav.login")}
          </Link>
        </div>
      ) : (
        <>
          {showAdd ? (
            <div className="mt-3 space-y-2 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="garage-make" className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
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
                    className="min-h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-sm outline-none focus:border-[var(--v3-brand)] focus:ring-[var(--v3-brand)]/20"
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
                  <label htmlFor="garage-model" className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
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
                    className="min-h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-sm outline-none focus:border-[var(--v3-brand)] focus:ring-[var(--v3-brand)]/20 disabled:opacity-50"
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
                  <label htmlFor="garage-variant" className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("garage.variant")}
                  </label>
                  <select
                    id="garage-variant"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="min-h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-sm outline-none focus:border-[var(--v3-brand)] focus:ring-[var(--v3-brand)]/20"
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
                <label htmlFor="garage-year" className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                  {t("garage.yearOptional")}
                </label>
                <input
                  id="garage-year"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                  placeholder="2019"
                  className="min-h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-sm outline-none focus:border-[var(--v3-brand)] focus:ring-[var(--v3-brand)]/20"
                />
              </div>
              <button
                type="button"
                disabled={saving || !make || !model}
                onClick={() => void addVehicle()}
                className="btn-press flex min-h-12 w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? t("garage.saving") : t("garage.saveVehicle")}
              </button>
            </div>
          ) : null}

          {vehicles.length === 0 ? (
            <div className="mt-3 rounded-[var(--v3-r)] border border-dashed border-[var(--v3-rule-strong)] bg-[var(--v3-sunk)] p-4 text-center">
              <p className="text-sm text-[var(--v3-text-2)]">{t("garage.empty")}</p>
              {!showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="mt-3 inline-flex min-h-11 items-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-5 text-xs font-bold text-white"
                >
                  {t("garage.add")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex items-center gap-2 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] p-2.5"
                >
                  <Link
                    href={garageFitmentHref(vehicle.make, vehicle.model)}
                    className="min-w-0 flex-1 rounded-[var(--v3-r)] px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v3-brand)]"
                  >
                    <p className="truncate text-sm font-semibold text-[var(--v3-text)]">
                      {garageVehicleLabel(vehicle)}
                    </p>
                    {vehicle.registrationNumber ? (
                      <p className="truncate font-mono text-[11px] text-[var(--v3-text-3)]">
                        {vehicle.registrationNumber}
                      </p>
                    ) : (
                      <p className="text-[11px] font-semibold text-[var(--v3-brand-ink)]">
                        {t("garage.viewParts")} →
                      </p>
                    )}
                  </Link>
                  {vehicle.isPrimary ? (
                    <span className="shrink-0 rounded-full bg-[var(--v3-ok-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--v3-ok)]">
                      {t("garage.primary")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === vehicle.id}
                    onClick={() => void removeVehicle(vehicle.id)}
                    className="min-h-10 shrink-0 rounded-[var(--v3-r)] border border-[var(--v3-bad-line)] px-2.5 text-xs font-semibold text-[var(--v3-bad)] disabled:opacity-50"
                    aria-label={t("garage.removeAria", { name: garageVehicleLabel(vehicle) })}
                  >
                    {busyId === vehicle.id ? "…" : t("cart.remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
