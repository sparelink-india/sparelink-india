"use client";
import Link from "next/link";
import { useState } from "react";

type ImportResult = {
  success: boolean;
  message: string;
  recordsProcessed?: number;
  recordsWithErrors?: number;
  errors?: Array<{ row: number; error: string }>;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setResult(null);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const r = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Bulk Import</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bulk Import</h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>

        <div className="mt-8 rounded-lg border bg-white p-8">
          <h2 className="text-lg font-semibold">Import Products or Dealers</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Upload a CSV file to import products, dealers, or listings in bulk.
            Column format:
          </p>

          <div className="mt-4 rounded bg-zinc-100 p-4">
            <p className="text-xs text-zinc-700">
              <strong>Products:</strong> partNumber, name, description, brand,
              category, categoryId, sku, hsnCode, gstRate, sellingPrice, mrp,
              firm, dealer, vehicleIds
            </p>
            <p className="mt-2 text-xs text-zinc-700">
              <strong>Dealers:</strong> businessName, gstin, phone, email,
              address, city, state, pincode
            </p>
            <p className="mt-2 text-xs text-zinc-700">
              <strong>Listings:</strong> dealerId, partId, firmId, sku, price,
              mrp, stock
            </p>
          </div>

          {error && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center hover:border-zinc-400">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer text-sm text-blue-600 hover:underline"
              >
                {file ? file.name : "Click to select CSV/Excel file"}
              </label>
            </div>

            <button
              type="submit"
              disabled={!file || loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </form>

          {result && (
            <div className="mt-8 rounded-lg border p-6">
              <p
                className={`text-sm font-semibold ${
                  result.success ? "text-green-700" : "text-red-700"
                }`}
              >
                {result.message}
              </p>

              {result.recordsProcessed !== undefined && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-zinc-600">
                    Records processed: {result.recordsProcessed}
                  </p>
                  {result.recordsWithErrors !== undefined && (
                    <p className="text-xs text-red-600">
                      Records with errors: {result.recordsWithErrors}
                    </p>
                  )}
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4 max-h-40 overflow-auto">
                  <p className="text-xs font-semibold text-zinc-700">
                    Errors:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-red-700">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>
                        +{result.errors.length - 10} more errors...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 space-y-4 rounded-lg border bg-white p-6">
          <h3 className="font-semibold">Import Features</h3>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li>✓ Validation of all fields</li>
            <li>✓ Duplicate detection</li>
            <li>✓ Preview before import</li>
            <li>✓ Row-level error reporting</li>
            <li>✓ Safe import with transaction support</li>
            <li>✓ Typesense re-indexing</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
