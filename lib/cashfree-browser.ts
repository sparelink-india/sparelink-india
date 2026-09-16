/**
 * Browser-only Cashfree Checkout helpers. Do not put merchant secrets here.
 * paymentSessionId and environment must come from SpareLink's server.
 */

const CASHFREE_JS_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

type CashfreeCheckoutOptions = {
  paymentSessionId: string;
  redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
};

type CashfreeInstance = {
  checkout: (options: CashfreeCheckoutOptions) => Promise<unknown>;
};

type CashfreeFactory = (options: { mode: "sandbox" | "production" }) => CashfreeInstance;

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

let loadingPromise: Promise<CashfreeFactory> | null = null;

export function cashfreeModeFromServer(
  value: unknown,
): "sandbox" | "production" {
  return value === "production" ? "production" : "sandbox";
}

export function loadCashfreeJs(): Promise<CashfreeFactory> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree checkout is only available in the browser."));
  }

  if (window.Cashfree) {
    return Promise.resolve(window.Cashfree);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CASHFREE_JS_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Cashfree) resolve(window.Cashfree);
        else reject(new Error("Cashfree checkout could not be loaded."));
      });
      existing.addEventListener("error", () => {
        loadingPromise = null;
        reject(new Error("Cashfree checkout could not be loaded."));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = CASHFREE_JS_URL;
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        loadingPromise = null;
        reject(new Error("Cashfree checkout could not be loaded."));
      }
    };
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Cashfree checkout could not be loaded. Please try again."));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export async function openCashfreeCheckout(input: {
  paymentSessionId: string;
  cashfreeEnvironment: unknown;
}): Promise<void> {
  if (!input.paymentSessionId) {
    throw new Error("Online payment session is missing. Please try again.");
  }

  const Cashfree = await loadCashfreeJs();
  const cashfree = Cashfree({
    mode: cashfreeModeFromServer(input.cashfreeEnvironment),
  });

  await cashfree.checkout({
    paymentSessionId: input.paymentSessionId,
    redirectTarget: "_self",
  });
}
