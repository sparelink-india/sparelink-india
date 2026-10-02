import { Suspense } from "react";
import OrderPaymentPage from "./payment-client";

export default function OrderPaymentRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--v3-sunk)] px-4 py-16 text-center text-sm text-[var(--v3-text-3)]">
          Loading payment details...
        </div>
      }
    >
      <OrderPaymentPage />
    </Suspense>
  );
}
