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
