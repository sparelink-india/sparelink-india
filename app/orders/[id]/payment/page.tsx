import { Suspense } from "react";
import OrderPaymentPage from "./payment-client";

export default function OrderPaymentRoute() {
  return (
    <Suspense
      fallback={
        <div className="sl-page min-h-screen px-4 py-16 text-center text-sm text-ink-500">
          Loading payment details...
        </div>
      }
    >
      <OrderPaymentPage />
    </Suspense>
  );
}
