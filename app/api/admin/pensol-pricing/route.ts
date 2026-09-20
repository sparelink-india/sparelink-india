import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import {
  getCommonPensolConfig,
  setCommonPensolConfig,
} from "@/lib/pensol-discount";
import { normalizePensolConfig } from "@/lib/pensol-pricing";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return NextResponse.json({
    commonPensol: await getCommonPensolConfig(),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const commonPensol = await setCommonPensolConfig(
    normalizePensolConfig(body?.commonPensol ?? body),
  );
  return NextResponse.json({ commonPensol });
}
