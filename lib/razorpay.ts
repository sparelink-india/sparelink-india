import { env } from "@/lib/env";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
};

export function isRazorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string,
): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new Error("Online payments are not configured yet.");
  }

  const credentials = Buffer.from(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Razorpay order creation failed", response.status);
    throw new Error("Unable to start the online payment. Please try again.");
  }

  return response.json() as Promise<RazorpayOrder>;
}
