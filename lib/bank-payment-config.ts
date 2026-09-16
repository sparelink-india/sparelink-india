export type BankPaymentConfig = {
  isConfigured: boolean;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  branch?: string;
  upiId?: string;
  qrImageUrl?: string;
  instructions: string;
  codEnabled: boolean;
};

export type FirmBankPaymentConfig = BankPaymentConfig & {
  firmId: string;
  firmName: string;
  firmCode?: string;
  allocationAmountPaise: number;
};

type FirmEnvPrefix =
  | "AMBAJI_TRADERS"
  | "HIND_MOTORS"
  | "INDIA_SALES"
  | string;

function resolveFirmPrefix(firmName: string, firmCode?: string): FirmEnvPrefix | null {
  const normalizedName = firmName.trim().toLowerCase();
  const normalizedCode = firmCode?.trim().toUpperCase();

  if (normalizedName === "ambaji traders" || normalizedCode === "AMB") {
    return "AMBAJI_TRADERS";
  }
  if (normalizedName === "hind motors" || normalizedCode === "HIN") {
    return "HIND_MOTORS";
  }
  if (normalizedName === "india sales" || normalizedCode === "IND") {
    return "INDIA_SALES";
  }
  return null;
}

function getFirmBankConfig(
  prefix: FirmEnvPrefix,
  firmId: string,
  firmName: string,
  allocationAmountPaise: number,
  firmCode?: string,
): FirmBankPaymentConfig {
  const accountName = process.env[`${prefix}_BANK_ACCOUNT_NAME`];
  const accountNumber = process.env[`${prefix}_BANK_ACCOUNT_NUMBER`];
  const ifscCode = process.env[`${prefix}_BANK_IFSC_CODE`];
  const bankName = process.env[`${prefix}_BANK_NAME`];
  const branch = process.env[`${prefix}_BANK_BRANCH`];
  const upiId = process.env[`${prefix}_BANK_UPI_ID`];
  const qrImageUrl = process.env[`${prefix}_BANK_QR_IMAGE_URL`];
  const customInstructions = process.env[`${prefix}_BANK_PAYMENT_INSTRUCTIONS`];
  const codEnabled =
    (process.env[`${prefix}_COD_ENABLED`] ?? "true").toLowerCase() !== "false";

  const isConfigured = Boolean((accountNumber && ifscCode) || upiId);

  return {
    firmId,
    firmName,
    firmCode,
    allocationAmountPaise,
    isConfigured,
    accountName: accountName || undefined,
    accountNumber: accountNumber || undefined,
    ifscCode: ifscCode || undefined,
    bankName: bankName || undefined,
    branch: branch || undefined,
    upiId: upiId || undefined,
    qrImageUrl: qrImageUrl || undefined,
    codEnabled,
    instructions: isConfigured
      ? customInstructions ||
        `Pay exactly ₹${(allocationAmountPaise / 100).toLocaleString("en-IN")} to ${firmName} only using the UPI ID or bank details below. Do not use another firm's account. After payment, submit the UTR for this firm.`
      : `Payment details for ${firmName} are not configured yet. Please contact SpareLink support before paying.`,
  };
}

/**
 * Returns ONLY the payment details for the given firm.
 * Never mixes Ambaji Traders / Hind Motors / India Sales details.
 */
export function getFirmBankPaymentConfig(
  firmId: string,
  firmName: string,
  allocationAmountPaise: number,
  firmCode?: string,
): FirmBankPaymentConfig {
  const prefix = resolveFirmPrefix(firmName, firmCode);

  if (prefix) {
    return getFirmBankConfig(
      prefix,
      firmId,
      firmName,
      allocationAmountPaise,
      firmCode,
    );
  }

  return {
    firmId,
    firmName,
    firmCode,
    allocationAmountPaise,
    isConfigured: false,
    codEnabled: true,
    instructions: `Payment details for ${firmName} are not configured yet. Please contact administration before making payment.`,
  };
}

/**
 * @deprecated Shared/legacy bank config. Prefer firm-wise configs.
 * Kept only for backwards-compatible admin diagnostics — never show on
 * customer payment pages as the primary payment destination.
 */
export function getBankPaymentConfig(): BankPaymentConfig {
  return {
    isConfigured: false,
    codEnabled: true,
    instructions:
      "Use the firm-wise bank / UPI details shown for your order allocation. Shared company bank details are not used.",
  };
}
