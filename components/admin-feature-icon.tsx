"use client";

import { createElement } from "react";
import {
  IconBoxes,
  IconBusiness,
  IconCart,
  IconChart,
  IconCommand,
  IconDatabase,
  IconDealership,
  IconInvoice,
  IconList,
  IconPackage,
  IconPriceTag,
  IconQuote,
  IconRupee,
  IconShield,
  IconSliders,
  IconStack,
  IconStock,
  IconSupplier,
  IconSync,
  IconTransfer,
  IconTruck,
  IconUpload,
  IconUsers,
  IconWarehouse,
} from "@/components/admin-icons";

/**
 * Canonical feature -> icon mapping.
 *
 * Held in one place so the sidebar, the features hub and any future admin
 * surface cannot drift apart. Every admin function has its own glyph; icons
 * are never reused across meanings and no emoji are used.
 */

export type AdminIconComponent = (p: {
  className?: string;
  style?: React.CSSProperties;
}) => React.ReactElement;

const FEATURE_ICONS: Record<string, AdminIconComponent> = {
  // Core operations
  orders: IconPackage,
  inventory: IconStock,
  catalogue: IconBoxes,
  customers: IconUsers,
  // Finance
  payments: IconRupee,
  reports: IconChart,
  "pricing-rules": IconPriceTag,
  // Business
  dealers: IconDealership,
  firms: IconBusiness,
  suppliers: IconSupplier,
  "sales-orders": IconInvoice,
  quotations: IconQuote,
  // Logistics
  allocations: IconTransfer,
  warehouses: IconWarehouse,
  "purchase-orders": IconCart,
  "goods-receipts": IconTruck,
  // Catalogue
  listings: IconList,
  import: IconUpload,
  "source-catalogue": IconDatabase,
  "ci-sync": IconSync,
  // Service
  warranty: IconShield,
  // Tools
  "stock-adjustments": IconSliders,
  "bulk-orders": IconStack,
};

export function featureIcon(id: string): AdminIconComponent {
  return FEATURE_ICONS[id] ?? IconCommand;
}

export function FeatureIcon({
  id,
  className,
  style,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Resolved through createElement: the glyph is a stable module-level
  // component chosen by data, never one constructed during render.
  return createElement(featureIcon(id), { className, style });
}
