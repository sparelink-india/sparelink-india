import { NextResponse } from "next/server";

import { applyInclusiveDiscount, parseDiscountPercentInput } from "@/lib/party-pricing";
import {
  getCommonCustomerDiscountPercent,
  setCommonCustomerDiscountPercent,
} from "@/lib/customer-discount";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const commonCustomerDiscountPercent = await getCommonCustomerDiscountPercent();
  const preview = applyInclusiveDiscount(10000, commonCustomerDiscountPercent);

  return NextResponse.json({
    commonCustomerDiscountPercent,
    previewListPaise: 10000,
    previewNetInclusivePaise: preview.netInclusivePaise,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = parseDiscountPercentInput(body?.commonCustomerDiscountPercent);
  if (parsed === undefined || parsed === null) {
    return NextResponse.json(
      { error: "commonCustomerDiscountPercent must be an integer from 0 to 100." },
      { status: 400 },
    );
  }

  const commonCustomerDiscountPercent = await setCommonCustomerDiscountPercent(parsed);
  const preview = applyInclusiveDiscount(10000, commonCustomerDiscountPercent);
  return NextResponse.json({
    commonCustomerDiscountPercent,
    previewListPaise: 10000,
    previewNetInclusivePaise: preview.netInclusivePaise,
  });
}
