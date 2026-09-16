import { Suspense } from "react";
import OrderPaymentPage from "./payment-client";

export default function OrderPaymentRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-sm text-slate-500">
          Loading payment details...
        </div>
      }
    >
      <OrderPaymentPage />
    </Suspense>
  );
}
