import { loadFitmentCatalog } from "@/lib/load-fitment";

export async function GET() {
  const payload = await loadFitmentCatalog();
  return Response.json(payload);
}

export const dynamic = "force-dynamic";
