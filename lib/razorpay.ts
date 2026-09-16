/**
 * Payment gateway stubs intentionally disabled.
 * SpareLink India uses firm-wise UPI / bank transfer / optional COD only.
 * Do not integrate Razorpay, Stripe, Cashfree, PayU, or other paid gateways.
 */

export function isRazorpayConfigured() {
  return false;
}

export async function createRazorpayOrder(
  _amountPaise: number,
  _receipt: string,
): Promise<never> {
  throw new Error(
    "Online card/UPI gateway payments are disabled. Use firm-wise bank transfer or COD.",
  );
}
