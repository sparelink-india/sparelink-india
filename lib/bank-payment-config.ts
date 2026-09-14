export type BankPaymentConfig = {
  isConfigured: boolean;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  qrImageUrl?: string;
  instructions: string;
};

export type FirmBankPaymentConfig = BankPaymentConfig & {
  firmId: string;
  firmName: string;
  allocationAmountPaise: number;
};

function getFirmBankConfig(
  prefix: string,
  firmId: string,
  firmName: string,
  allocationAmountPaise: number,
): FirmBankPaymentConfig {
  const accountName = process.env[`${prefix}_BANK_ACCOUNT_NAME`];
  const accountNumber = process.env[`${prefix}_BANK_ACCOUNT_NUMBER`];
  const ifscCode = process.env[`${prefix}_BANK_IFSC_CODE`];
  const bankName = process.env[`${prefix}_BANK_NAME`];
  const upiId = process.env[`${prefix}_BANK_UPI_ID`];
  const qrImageUrl = process.env[`${prefix}_BANK_QR_IMAGE_URL`];

  const isConfigured = Boolean((accountNumber && ifscCode) || upiId);

  return {
    firmId,
    firmName,
    allocationAmountPaise,
    isConfigured,
    accountName: accountName || undefined,
    accountNumber: accountNumber || undefined,
    ifscCode: ifscCode || undefined,
    bankName: bankName || undefined,
    upiId: upiId || undefined,
    qrImageUrl: qrImageUrl || undefined,
    instructions: isConfigured
      ? "Please transfer the exact allocated amount using the bank details or UPI ID above. After completing the payment, enter the UTR / Transaction Reference number and payment date for verification."
      : "Payment details for this firm are not configured yet. Please contact administration before making payment.",
  };
}

export function getFirmBankPaymentConfig(
  firmId: string,
  firmName: string,
  allocationAmountPaise: number,
): FirmBankPaymentConfig {
  const normalizedName = firmName.trim().toLowerCase();

  if (normalizedName === "ambaji traders") {
    return getFirmBankConfig(
      "AMBAJI_TRADERS",
      firmId,
      firmName,
      allocationAmountPaise,
    );
  }

  if (normalizedName === "india sales") {
    return getFirmBankConfig(
      "INDIA_SALES",
      firmId,
      firmName,
      allocationAmountPaise,
    );
  }

  if (normalizedName === "hind motors") {
    return getFirmBankConfig(
      "HIND_MOTORS",
      firmId,
      firmName,
      allocationAmountPaise,
    );
  }

  return {
    firmId,
    firmName,
    allocationAmountPaise,
    isConfigured: false,
    instructions:
      "Payment details for this firm are not configured yet. Please contact administration before making payment.",
  };
}

export function getBankPaymentConfig(): BankPaymentConfig {
  const accountName =
    process.env.BANK_ACCOUNT_NAME ||
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME;
  const accountNumber =
    process.env.BANK_ACCOUNT_NUMBER ||
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER;
  const ifscCode =
    process.env.BANK_IFSC_CODE || process.env.NEXT_PUBLIC_BANK_IFSC_CODE;
  const bankName =
    process.env.BANK_NAME || process.env.NEXT_PUBLIC_BANK_NAME;
  const upiId =
    process.env.BANK_UPI_ID || process.env.NEXT_PUBLIC_BANK_UPI_ID;
  const qrImageUrl =
    process.env.BANK_QR_IMAGE_URL ||
    process.env.NEXT_PUBLIC_BANK_QR_IMAGE_URL;

  const isConfigured = Boolean((accountNumber && ifscCode) || upiId);

  return {
    isConfigured,
    accountName: accountName || undefined,
    accountNumber: accountNumber || undefined,
    ifscCode: ifscCode || undefined,
    bankName: bankName || undefined,
    upiId: upiId || undefined,
    qrImageUrl: qrImageUrl || undefined,
    instructions: isConfigured
      ? "Please transfer the exact order amount using the bank details or UPI ID above. After completing the payment, enter your UTR / Transaction Reference number and payment date below to submit for verification."
      : "Bank transfer and UPI payment details are currently not configured in the environment. Please contact administration or choose another payment method.",
  };
}
