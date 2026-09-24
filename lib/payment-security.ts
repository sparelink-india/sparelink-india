export function isCashfreePaymentMethod(value: string | null | undefined) {
  return value === "online_payment";
}

export function isBankTransferPaymentMethod(value: string | null | undefined) {
  return value === "bank_transfer";
}

export function canAcceptPaymentForOrderStatus(status: string | null | undefined) {
  return status !== "cancelled" && status !== "returned";
}

export function canAcceptPaymentForAllocationStatus(
  status: string | null | undefined,
) {
  return status !== "cancelled" && status !== "returned";
}

export function canTransitionOrderStatus(
  current: string | null | undefined,
  next: string | null | undefined,
) {
  if (current === next) return true;
  if (current === "cancelled" || current === "completed" || current === "returned") {
    return false;
  }
  return Boolean(next);
}

export function canMarkPaymentPaid(
  orderStatus: string | null | undefined,
  allocationFulfillmentStatus: string | null | undefined,
) {
  return (
    canAcceptPaymentForOrderStatus(orderStatus) &&
    canAcceptPaymentForAllocationStatus(allocationFulfillmentStatus)
  );
}
