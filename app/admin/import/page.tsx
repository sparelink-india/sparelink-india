"use client";
import Link from "next/link";
import { useState } from "react";

type PreviewData = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  columnHeaders: string[];
  sampleRows: Array<{
    rowNumber: number;
    isValid: boolean;
    errors: string[];
  }>;
};

type ImportState = "idle" | "uploading" | "preview" | "confirming" | "complete" | "error";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewId, setPreviewId] = useState("");
  const [importType, setImportType] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    importedCount: number;
    indexedCount: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setPreview(null);
      setError("");
      setMessage("");
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setError("");
    setMessage("");
    setState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "preview");

      const r = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const d = await r.json();

      if (!r.ok) {
        setError(d.error || "Preview failed");
        setState("error");
        return;
      }

      setPreviewId(d.previewId);
      setImportType(d.importType);
      setPreview(d.preview);
      setState("preview");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setState("error");
    }
  };

  const handleConfirm = async () => {
    if (!previewId) {
      setError("Preview ID missing");
      return;
    }

    setError("");
    setMessage("Importing...");
    setState("confirming");

    try {
      const formData = new FormData();
      formData.append("action", "confirm");
      formData.append("previewId", previewId);

      const r = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const d = await r.json();

      if (!r.ok) {
        setError(d.error || d.details || "Import failed");
        setMessage("");
        setState("error");
        return;
      }

      setResult({
        importedCount: d.importedCount,
        indexedCount: d.indexedCount,
      });
      setMessage(d.message);
      setState("complete");
      setFile(null);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setMessage("");
      setState("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setPreviewId("");
    setImportType("");
    setMessage("");
    setError("");
    setResult(null);
    setState("idle");
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

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bulk Import</h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            {message}
          </p>
        )}

        {/* IDLE STATE - FILE UPLOAD */}
        {state === "idle" && (
          <div className="mt-8 rounded-lg border bg-white p-8">
            <h2 className="text-lg font-semibold">Import Data</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Upload a CSV or Excel file to bulk import products or listings.
            </p>

            <div className="mt-6 rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center hover:border-zinc-400">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={state !== "idle"}
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

            {file && (
              <div className="mt-6 space-y-4">
                <button
                  onClick={handleUpload}
                  disabled={!file || state !== "idle"}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
                >
                  {state !== "idle" ? "Processing..." : "Generate Preview"}
                </button>
              </div>
            )}

            <div className="mt-8 rounded-lg border bg-gray-50 p-6">
              <h3 className="font-semibold">Supported Formats</h3>
              <div className="mt-4 space-y-4 text-sm text-zinc-700">
                <div>
                  <p className="font-medium">Product Import</p>
                  <p className="mt-1 text-xs">
                    Required: Part Number, Part Name, Selling Price | Optional:
                    Description, Brand, Category, SKU, HSN, GST, MRP
                  </p>
                </div>
                <div>
                  <p className="font-medium">Listing Import</p>
                  <p className="mt-1 text-xs">
                    Required: Dealer, Firm, Part Number, Stock, Selling Price |
                    Optional: SKU, MRP, Status
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW STATE */}
        {state === "preview" && preview && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border bg-white p-6">
              <h2 className="text-lg font-semibold">Import Preview</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Type: <span className="font-mono font-semibold">{importType}</span>
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div className="rounded border bg-gray-50 p-4">
                  <p className="text-xs text-gray-600">Total Rows</p>
                  <p className="mt-2 text-2xl font-bold">{preview.totalRows}</p>
                </div>
                <div className="rounded border bg-green-50 p-4">
                  <p className="text-xs text-green-600">Valid Rows</p>
                  <p className="mt-2 text-2xl font-bold">{preview.validRows}</p>
                </div>
                <div className="rounded border bg-red-50 p-4">
                  <p className="text-xs text-red-600">Invalid Rows</p>
                  <p className="mt-2 text-2xl font-bold">
                    {preview.invalidRows}
                  </p>
                </div>
                <div className="rounded border bg-blue-50 p-4">
                  <p className="text-xs text-blue-600">Success Rate</p>
                  <p className="mt-2 text-2xl font-bold">
                    {preview.totalRows > 0
                      ? Math.round(
                        (preview.validRows / preview.totalRows) * 100,
                      )
                      : 0}
                    %
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="font-medium">Detected Columns</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preview.columnHeaders.map((col) => (
                    <span
                      key={col}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {preview.sampleRows.length > 0 && (
              <div className="rounded-lg border bg-white p-6">
                <h3 className="font-semibold">Sample Rows</h3>
                <div className="mt-4 space-y-3">
                  {preview.sampleRows.map((row) => (
                    <div
                      key={row.rowNumber}
                      className={`rounded-lg border p-3 ${
                        row.isValid
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <p className="text-sm font-mono font-semibold">
                        Row {row.rowNumber}:{" "}
                        <span
                          className={
                            row.isValid
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {row.isValid ? "✓ Valid" : "✗ Invalid"}
                        </span>
                      </p>
                      {row.errors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-red-700">
                          {row.errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {preview.validRows > 0 ? (
                <>
                  <button
                    onClick={handleConfirm}
                    disabled={state !== "preview"}
                    className="w-full rounded-lg bg-green-600 px-4 py-3 text-white disabled:bg-gray-300"
                  >
                    {state !== "preview" ? "Importing..." : "Confirm Import"}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={state !== "preview"}
                    className="w-full rounded-lg bg-gray-200 px-4 py-3 text-gray-800 disabled:bg-gray-300"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleReset}
                  className="w-full rounded-lg bg-gray-200 px-4 py-3 text-gray-800"
                >
                  Back to Upload
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPLETE STATE */}
        {state === "complete" && result && (
          <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <p className="text-2xl font-bold text-green-700">✓ Import Complete</p>
            <p className="mt-2 text-sm text-green-600">{message}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded border bg-white p-4">
                <p className="text-xs text-gray-600">Records Imported</p>
                <p className="mt-2 text-2xl font-bold">
                  {result.importedCount}
                </p>
              </div>
              <div className="rounded border bg-white p-4">
                <p className="text-xs text-gray-600">Indexed</p>
                <p className="mt-2 text-2xl font-bold">{result.indexedCount}</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="mt-6 rounded-lg bg-green-600 px-6 py-2 text-white"
            >
              Import Another File
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {state === "error" && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-2xl font-bold text-red-700">✗ Error</p>
            <p className="mt-2 text-sm text-red-600">{error}</p>

            <button
              onClick={handleReset}
              className="mt-6 rounded-lg bg-red-600 px-6 py-2 text-white"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
