"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type CatalogueItem = {
  key: string;
  sku: string | null;
  name: string | null;
  brand: string | null;
  categoryName: string | null;
  compatibility: string;
  oeCode: string | null;
  hsn: string | null;
  gst: number | null;
  moq: number | null;
  uom: string | null;
  sourcePrice: number | null;
  sourceUrl: string | null;
  rateDisplay: string;
  validationStatus: string;
  reviewReasons: string[];
  missingFields: string[];
  issues: string[];
  firmAssignment: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  importStatus: string;
  importEligible: boolean;
  imageStatus: string | null;
  localImagePath: string | null;
  hasImage: boolean;
};

type CatalogueResponse = {
  counts?: Record<string, number>;
  overlay?: {
    assigned: number;
    priced: number;
    importEligible: number;
    imageReview: number;
    unassigned: number;
    byFirm: Record<string, number>;
  };
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalPages: number;
  categories: string[];
  items: CatalogueItem[];
  error?: string;
};

type PreviewResult = {
  totalSelected: number;
  validForImport: number;
  missingFirm: number;
  missingPrice: number;
  missingMrp?: number;
  missingSellingPrice?: number;
  imageReview: number;
  sourceReview: number;
  identityOrCategory: number;
  files?: { ready: string; review: string; validation: string };
  error?: string;
};

const FIRMS = ["Ambaji Traders", "Hind Motors", "India Sales"] as const;

function badgeClass(issue: string) {
  if (issue === "READY" || issue === "import-ready") return "bg-emerald-50 text-emerald-800";
  if (issue === "NOT IMPORTED") return "bg-zinc-100 text-zinc-700";
  return "bg-amber-50 text-amber-900";
}

export default function SourceCatalogueReviewPage() {
  const [data, setData] = useState<CatalogueResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("READY");
  const [image, setImage] = useState("all");
  const [category, setCategory] = useState("");
  const [firm, setFirm] = useState("all");
  const [issue, setIssue] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [assignFirm, setAssignFirm] = useState<(typeof FIRMS)[number] | "CLEAR">("Ambaji Traders");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [updateMrp, setUpdateMrp] = useState(true);
  const [updateSellingPrice, setUpdateSellingPrice] = useState(true);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const selectedKeys = useMemo(
    () => Object.keys(selected).filter((key) => selected[key]),
    [selected],
  );
  const selectedCount = selectedKeys.length;

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "50",
      status,
      image,
      firm,
      issue,
    });
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    return params.toString();
  }, [page, status, image, query, category, firm, issue]);

  async function loadPage() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/source-catalogue?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as CatalogueResponse;
      if (!response.ok) {
        setError(payload.error || "Unable to load source catalogue.");
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError("Unable to load source catalogue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/source-catalogue?${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as CatalogueResponse;
        if (!response.ok) {
          setError(payload.error || "Unable to load source catalogue.");
          setData(null);
          return;
        }
        setData(payload);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load source catalogue.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryString]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
  }

  function toggleKey(key: string) {
    if (!key) return;
    setSelected((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectPage() {
    if (!data) return;
    setSelected((current) => {
      const next = { ...current };
      for (const item of data.items) {
        if (item.key) next[item.key] = true;
      }
      return next;
    });
  }

  async function selectFiltered() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/source-catalogue?${queryString}&keysOnly=1`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { keys?: string[]; totalFiltered?: number; error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to load filtered keys.");
        return;
      }
      const count = payload.keys?.length || 0;
      if (
        !window.confirm(
          `Select all ${count} filtered records, including products not shown on this page? Hidden/unfiltered records will not be included.`,
        )
      ) {
        return;
      }
      const next: Record<string, boolean> = {};
      for (const key of payload.keys || []) next[key] = true;
      setSelected(next);
      setMessage(`Selected ${count} filtered records.`);
    } finally {
      setBusy(false);
    }
  }

  async function postJson(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    return { response, payload };
  }

  async function assignSelected() {
    if (selectedCount === 0) return;
    const label = assignFirm === "CLEAR" ? "Clear Assignment" : assignFirm;
    if (!window.confirm(`You are assigning ${selectedCount} products to ${label}.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    const { response, payload } = await postJson("/api/admin/source-catalogue/assign", {
      keys: selectedKeys,
      firm: assignFirm === "CLEAR" ? null : assignFirm,
      confirm: true,
    });
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Firm assignment failed.");
      return;
    }
    setMessage(payload.message || "Firm assignment updated.");
    await loadPage();
  }

  async function priceSelected() {
    if (selectedCount === 0) return;
    if (!window.confirm(`Apply SpareLink prices to ${selectedCount} selected products? Source price will not be copied.`)) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { response, payload } = await postJson("/api/admin/source-catalogue/pricing", {
      keys: selectedKeys,
      mrp: updateMrp ? mrp : undefined,
      sellingPrice: updateSellingPrice ? sellingPrice : undefined,
      updateMrp,
      updateSellingPrice,
      confirm: true,
      confirmOverwrite,
    });
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Price update failed.");
      return;
    }
    setMessage(payload.message || "Prices updated.");
    await loadPage();
  }

  async function runPreview() {
    if (selectedCount === 0) return;
    setBusy(true);
    setError("");
    const { response, payload } = await postJson("/api/admin/source-catalogue/preview", {
      scope: "selected",
      keys: selectedKeys,
    });
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Preview failed.");
      return;
    }
    setPreview(payload as PreviewResult);
    setShowPreview(true);
  }

  async function exportFiles() {
    if (selectedCount === 0) return;
    if (
      !window.confirm(
        "Export CSV files only. This will NOT import products, write to the database, or reindex Typesense. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    const { response, payload } = await postJson("/api/admin/source-catalogue/export", {
      scope: "selected",
      keys: selectedKeys,
      confirm: true,
      confirmNoImport: true,
    });
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Export failed.");
      return;
    }
    setPreview(payload as PreviewResult);
    setShowPreview(true);
    setMessage("Export written under data/source-catalogue/. Original extraction files were not overwritten. No database write.");
  }

  const pageKeys = data?.items.map((item) => item.key).filter(Boolean) ?? [];
  const pageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected[key]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm font-semibold text-[#7a1233] hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Source catalogue review</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Admin-only review. READY and REVIEW are shown separately. Firm, MRP, and selling price stay
          blank until an admin assigns them. Source price is reference-only and is never copied.
          Product import is disabled. REVIEW records cannot enter import-ready files.
        </p>

        {data?.counts ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["READY", data.counts.READY],
              ["REVIEW", data.counts.REVIEW],
              ["DUPLICATE", data.counts.DUPLICATE],
              ["CONFLICT", data.counts.CONFLICT],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
                <p className="mt-1 text-2xl font-extrabold">{value ?? 0}</p>
              </div>
            ))}
          </div>
        ) : null}

        {data?.overlay ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-xl border bg-white p-4">Assigned firms: {data.overlay.assigned}</div>
            <div className="rounded-xl border bg-white p-4">Priced: {data.overlay.priced}</div>
            <div className="rounded-xl border bg-white p-4">Import-eligible: {data.overlay.importEligible}</div>
            <div className="rounded-xl border bg-white p-4">Image review: {data.overlay.imageReview}</div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>
            <strong>Pre-flight only.</strong> Source Rate is prepared into selling price where the source value is
            explicit and greater than 0. MRP stays blank unless the source supplies MRP. READY rows are assigned
            to Ambaji Traders. 213 blank-price READY rows and 189 REVIEW rows stay out of any import set.
          </p>
          <p className="mt-1">
            <strong>Import:</strong> DISABLED / NOT IMPORTED · Database writes: none · Typesense reindex: none
          </p>
        </div>

        <form onSubmit={handleSearch} className="sticky top-0 z-20 mt-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, SKU, brand, vehicle..."
            className="h-11 rounded-lg border px-3 text-sm lg:col-span-2"
          />
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-lg border px-3 text-sm">
            <option value="ALL">All source statuses</option>
            <option value="READY">READY</option>
            <option value="REVIEW">REVIEW</option>
            <option value="DUPLICATE">DUPLICATE</option>
            <option value="CONFLICT">CONFLICT</option>
          </select>
          <select value={image} onChange={(event) => { setImage(event.target.value); setPage(1); }} className="h-11 rounded-lg border px-3 text-sm">
            <option value="all">All images</option>
            <option value="has">Has image</option>
            <option value="missing">IMAGE REVIEW</option>
          </select>
          <select value={firm} onChange={(event) => { setFirm(event.target.value); setPage(1); }} className="h-11 rounded-lg border px-3 text-sm">
            <option value="all">All firms</option>
            <option value="unassigned">Unassigned</option>
            {FIRMS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select value={issue} onChange={(event) => { setIssue(event.target.value); setPage(1); }} className="h-11 rounded-lg border px-3 text-sm">
            <option value="ALL">All issues</option>
            <option value="FIRM">FIRM ASSIGNMENT REQUIRED</option>
            <option value="MRP">MRP REQUIRED</option>
            <option value="SELLING">SELLING PRICE REQUIRED</option>
            <option value="IMAGE">IMAGE REVIEW</option>
            <option value="IMPORT_READY">Import-eligible</option>
          </select>
          <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-11 rounded-lg border px-3 text-sm lg:col-span-2">
            <option value="">All categories</option>
            {(data?.categories ?? []).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-lg bg-[#7a1233] text-sm font-bold text-white lg:col-span-4">
            Apply filters
          </button>
        </form>

        <div className="sticky top-[7.5rem] z-20 mt-3 rounded-xl border bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">Selected: {selectedCount}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectPage} className="h-9 rounded border px-3 font-semibold">Select page</button>
              <button type="button" disabled={busy} onClick={() => void selectFiltered()} className="h-9 rounded border px-3 font-semibold">Select filtered results</button>
              <button type="button" onClick={() => setSelected({})} className="h-9 rounded border px-3 font-semibold">Deselect all</button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Assign firm</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={assignFirm} onChange={(event) => setAssignFirm(event.target.value as typeof assignFirm)} className="h-10 rounded border px-2">
                  {FIRMS.map((name) => <option key={name} value={name}>{name}</option>)}
                  <option value="CLEAR">Clear Assignment</option>
                </select>
                <button type="button" disabled={busy || selectedCount === 0} onClick={() => void assignSelected()} className="h-10 rounded bg-[#7a1233] px-3 font-bold text-white disabled:opacity-40">
                  Assign Firm
                </button>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">SpareLink prices</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={updateMrp} onChange={(event) => setUpdateMrp(event.target.checked)} />
                  MRP
                </label>
                <input value={mrp} onChange={(event) => setMrp(event.target.value)} placeholder="MRP" className="h-10 rounded border px-2" />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={updateSellingPrice} onChange={(event) => setUpdateSellingPrice(event.target.checked)} />
                  Selling Price
                </label>
                <input value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} placeholder="Selling Price" className="h-10 rounded border px-2" />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={confirmOverwrite} onChange={(event) => setConfirmOverwrite(event.target.checked)} />
                Confirm overwrite of existing SpareLink prices
              </label>
              <button type="button" disabled={busy || selectedCount === 0} onClick={() => void priceSelected()} className="mt-2 h-10 rounded border px-3 font-bold disabled:opacity-40">
                Apply prices
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy || selectedCount === 0} onClick={() => void runPreview()} className="h-10 rounded border px-3 font-semibold disabled:opacity-40">
              Import preview
            </button>
            <button type="button" disabled={busy || selectedCount === 0} onClick={() => void exportFiles()} className="h-10 rounded bg-zinc-900 px-3 font-semibold text-white disabled:opacity-40">
              Export file only
            </button>
            <button type="button" disabled className="h-10 rounded border px-3 font-semibold text-zinc-400" title="Product import is disabled">
              Import to database (disabled)
            </button>
          </div>
        </div>

        {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}
        {loading ? <p className="mt-6 text-sm text-zinc-500">Loading catalogue page...</p> : null}

        {showPreview && preview ? (
          <div className="mt-4 rounded-xl border bg-white p-4">
            <h2 className="text-lg font-bold">FILE EXPORT PREVIEW — IMPORT DISABLED</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Total selected: {preview.totalSelected}</li>
              <li>Would be valid for a future import: {preview.validForImport}</li>
              <li>FIRM ASSIGNMENT REQUIRED: {preview.missingFirm}</li>
              <li>MRP REQUIRED: {preview.missingMrp ?? "—"}</li>
              <li>SELLING PRICE REQUIRED: {preview.missingSellingPrice ?? "—"}</li>
              <li>Image review: {preview.imageReview}</li>
              <li>Source REVIEW (excluded from import-ready): {preview.sourceReview}</li>
            </ul>
            {preview.files ? (
              <p className="mt-2 text-xs text-zinc-600">
                Wrote {preview.files.ready}, {preview.files.review}, {preview.files.validation}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setShowPreview(false)} className="h-10 rounded border px-4 font-semibold">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void exportFiles()} className="h-10 rounded bg-[#7a1233] px-4 font-bold text-white">
                Export Import File
              </button>
            </div>
          </div>
        ) : null}

        {data ? (
          <>
            <p className="mt-4 text-sm text-zinc-600">
              Showing {data.items.length} of {data.totalFiltered} filtered records (page {data.page} of {data.totalPages}).
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={pageSelected}
                        onChange={() => (pageSelected ? setSelected((current) => {
                          const next = { ...current };
                          for (const key of pageKeys) delete next[key];
                          return next;
                        }) : selectPage())}
                        aria-label="Select current page"
                      />
                    </th>
                    <th className="px-3 py-3">Image</th>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Part details</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Business fields</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No records match these filters.</td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.key} className="border-t align-top">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[item.key])}
                            onChange={() => toggleKey(item.key)}
                            aria-label={`Select ${item.sku || item.name || "product"}`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {item.hasImage && item.sku ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/admin/source-catalogue/image?sku=${encodeURIComponent(item.sku)}`}
                              alt=""
                              className="h-16 w-16 rounded border object-contain"
                            />
                          ) : (
                            <span className="text-xs text-zinc-400">IMAGE REVIEW</span>
                          )}
                          <p className="mt-1 max-w-[9rem] truncate text-[10px] text-zinc-400" title={item.localImagePath || ""}>
                            {item.localImagePath || "no local file"}
                          </p>
                          <p className="text-[10px] text-zinc-500">{item.imageStatus || "unknown"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold">{item.name || "—"}</p>
                          <p className="text-xs text-zinc-500">{item.brand || "Brand not provided"}</p>
                          <p className="mt-1 text-[11px] text-zinc-400">{item.compatibility || "—"}</p>
                          <p className="text-[11px] text-zinc-400">{item.sourceUrl}</p>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          <div>Part No: {item.sku || ""}</div>
                          <div>Product Name: {item.name || ""}</div>
                          <div>MOQ: {item.moq ?? ""}</div>
                          <div>OE Number: {item.oeCode || ""}</div>
                          <div>HSN: {item.hsn || ""}</div>
                          <div>Rate: {item.rateDisplay || ""}</div>
                        </td>
                        <td className="px-3 py-3">{item.categoryName || "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.issues.map((label) => (
                              <span key={label} className={`rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass(label)}`}>
                                {label}
                              </span>
                            ))}
                          </div>
                          {item.importEligible ? (
                            <p className="mt-1 text-[11px] font-semibold text-emerald-700">Passes current import checks</p>
                          ) : null}
                          {item.reviewReasons.length > 0 ? (
                            <p className="mt-1 text-[11px] text-zinc-500">{item.reviewReasons.join(", ")}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <div>Firm: {item.firmAssignment || "FIRM ASSIGNMENT REQUIRED"}</div>
                          <div>MRP: {item.mrp ?? "MRP REQUIRED"}</div>
                          <div>Selling price: {item.sellingPrice ?? "SELLING PRICE REQUIRED"}</div>
                          <div>Source rate: {item.sourcePrice ?? ""}</div>
                          <div>Unit: {item.uom || ""}</div>
                          <div>GST (source): {item.gst ?? "—"}</div>
                          <div>Import: {item.importStatus}</div>
                          {item.missingFields.length > 0 ? (
                            <div className="mt-1 text-amber-800">Missing: {item.missingFields.join(", ")}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-10 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">
                Previous
              </button>
              <span className="text-sm text-zinc-600">Page {data.page} / {data.totalPages}</span>
              <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">
                Next
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
