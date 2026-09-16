/**
 * Server-side buyer OTP delivery.
 * Never log the OTP or phone+code together. Never send OTP to the browser.
 * Production requires OTP_DELIVERY_WEBHOOK_URL on the host (SMS/WhatsApp gateway).
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function deliverBuyerOtp(input: {
  phoneNumber: string;
  code: string;
}): Promise<void> {
  const webhookUrl = readOptional("OTP_DELIVERY_WEBHOOK_URL");
  const webhookToken = readOptional("OTP_DELIVERY_WEBHOOK_TOKEN");

  if (webhookUrl) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (webhookToken) {
      headers.Authorization = `Bearer ${webhookToken}`;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phoneNumber: input.phoneNumber,
        code: input.code,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("OTP delivery webhook failed", {
        httpStatus: response.status,
      });
      throw new Error("Unable to send OTP. Please try again.");
    }

    return;
  }

  if (isProductionRuntime()) {
    console.error("OTP delivery is not configured for production");
    throw new Error("Unable to send OTP. Please try again.");
  }

  console.log(`OTP for ${input.phoneNumber}: ${input.code}`);
}
