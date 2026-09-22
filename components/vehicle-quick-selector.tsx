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

export function VehicleQuickSelector() {
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
      if (response.status === 401) {
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
      setGarageState("error");
    }
  }, []);

  useEffect(() => {
    void fetch("/api/vehicles", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : []);
      })
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false));
    void loadGarage();
  }, [loadGarage]);

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

  return (
    <section
      aria-labelledby="vehicle-selector-heading"
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
            {t("vehicleSelect.kicker")}
          </p>
          <h2 id="vehicle-selector-heading" className="text-base font-bold text-slate-950">
            {t("vehicleSelect.title")}
          </h2>
        </div>
        <Link
          href="/vehicle-fitment"
          className="text-xs font-semibold text-[#7a1233] underline-offset-2 hover:underline"
        >
          {t("vehicleSelect.browseAll")}
        </Link>
      </div>

      {garageState === "loading" ? (
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : garageState === "guest" ? (
        <p className="mt-3 text-xs text-slate-500">
          <Link href="/login" className="font-semibold text-[#7a1233] underline-offset-2 hover:underline">
            {t("nav.login")}
          </Link>{" "}
          {t("garage.loginHint")}
        </p>
      ) : garageState === "error" ? (
        <p className="mt-3 text-xs text-rose-700" role="alert">
          {t("garage.loadFail")}
        </p>
      ) : garage.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {t("garage.savedVehicles")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {garage.map((vehicle) => {
              const active = selectedGarageId === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => applyGarageVehicle(vehicle)}
                  onDoubleClick={() => router.push(garageFitmentHref(vehicle.make, vehicle.model))}
                  className={`min-h-11 shrink-0 rounded-full border px-3 text-left text-xs font-semibold ${
                    active
                      ? "border-[#7a1233] bg-[#7a1233] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800"
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
          {selectedGarageId ? (
            <button
              type="button"
              onClick={() => {
                const selected = garage.find((row) => row.id === selectedGarageId);
                if (selected) router.push(garageFitmentHref(selected.make, selected.model));
              }}
              className="mt-2 text-xs font-semibold text-[#7a1233]"
            >
              {t("garage.viewParts")} →
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{t("garage.emptyShort")}</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="vq-make" className="mb-1 block text-xs font-semibold text-slate-600">
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
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#7a1233] focus:bg-white focus:ring-2 focus:ring-[#7a1233]/20"
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
          <label htmlFor="vq-model" className="mb-1 block text-xs font-semibold text-slate-600">
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
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#7a1233] focus:bg-white focus:ring-2 focus:ring-[#7a1233]/20 disabled:opacity-50"
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
          className="btn-press flex min-h-12 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {t("vehicleSelect.showParts")}
        </button>
        {garageState === "ready" && make && model && !alreadySaved ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCurrentToGarage()}
            className="btn-press flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900 disabled:opacity-50"
          >
            {saving ? t("garage.saving") : t("garage.saveVehicle")}
          </button>
        ) : garageState === "guest" && make && model ? (
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
          >
            {t("garage.loginToSave")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
