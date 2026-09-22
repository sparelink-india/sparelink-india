import { Suspense } from "react";

import { HomePageContent } from "./home-client";

export const dynamic = "force-dynamic";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialQuery = firstParam(params.q);
  const parsedPage = Number(firstParam(params.page) || "1");
  const initialPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HomePageContent initialQuery={initialQuery} initialPage={initialPage} />
    </Suspense>
  );
}
