import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified")
    .default(false)
    .notNull(),
  role: text("role").default("buyer").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const customerProfile = pgTable(
  "customer_profile",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    contactName: text("contact_name"),
    businessName: text("business_name"),
    gstin: text("gstin"),
    customerType: text("customer_type").default("b2c").notNull(),
    billingAddressLine1: text("billing_address_line1"),
    billingAddressLine2: text("billing_address_line2"),
    billingCity: text("billing_city"),
    billingState: text("billing_state"),
    billingPincode: text("billing_pincode"),
    shippingAddressLine1: text("shipping_address_line1"),
    shippingAddressLine2: text("shipping_address_line2"),
    shippingCity: text("shipping_city"),
    shippingState: text("shipping_state"),
    shippingPincode: text("shipping_pincode"),
    shippingPreference: text("shipping_preference")
      .default("courier")
      .notNull(),
    transportName: text("transport_name"),
    transportPhone: text("transport_phone"),
    transportGstin: text("transport_gstin"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customer_profile_user_idx").on(table.userId),
    index("customer_profile_gstin_idx").on(table.gstin),
    index("customer_profile_business_name_idx").on(table.businessName),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  customerProfile: one(customerProfile, {
    fields: [user.id],
    references: [customerProfile.userId],
  }),
  manualPaymentSubmissions: many(manualPaymentSubmission),
}));

export const customerProfileRelations = relations(
  customerProfile,
  ({ one }) => ({
    user: one(user, {
      fields: [customerProfile.userId],
      references: [user.id],
    }),
  }),
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const partCategory = pgTable("part_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const part = pgTable(
  "part",
  {
    id: text("id").primaryKey(),
    partNumber: text("part_number").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    brand: text("brand"),
    categoryId: text("category_id").references(() => partCategory.id, {
      onDelete: "set null",
    }),
    oemNumber: text("oem_number"),
    alternatePartNumbers: text("alternate_part_numbers"),
    barcode: text("barcode"),
    productType: text("product_type").default("aftermarket").notNull(),
    warrantyMonths: integer("warranty_months"),
    specifications: text("specifications"),
    slug: text("slug"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    isPublished: boolean("is_published").default(true).notNull(),
    /** APPROVED | PENDING_ADMIN_APPROVAL | REJECTED — existing rows default APPROVED. */
    approvalStatus: text("approval_status").default("APPROVED").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("part_brand_idx").on(table.brand),
    index("part_category_idx").on(table.categoryId),
    index("part_oem_number_idx").on(table.oemNumber),
    index("part_product_type_idx").on(table.productType),
    index("part_approval_status_idx").on(table.approvalStatus),
  ],
);

export const vehicle = pgTable(
  "vehicle",
  {
    id: text("id").primaryKey(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    variant: text("variant"),
    yearFrom: timestamp("year_from"),
    yearTo: timestamp("year_to"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("vehicle_make_idx").on(table.make),
    index("vehicle_model_idx").on(table.model),
  ],
);

export const partVehicleCompatibility = pgTable(
  "part_vehicle_compatibility",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("part_vehicle_compatibility_part_idx").on(table.partId),
    index("part_vehicle_compatibility_vehicle_idx").on(table.vehicleId),
  ],
);

export const enquiry = pgTable(
  "enquiry",
  {
    id: text("id").primaryKey(),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    message: text("message"),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("enquiry_buyer_idx").on(table.buyerId),
    index("enquiry_part_idx").on(table.partId),
    index("enquiry_status_idx").on(table.status),
  ],
);

export const dealer = pgTable(
  "dealer",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    ownerName: text("owner_name"),
    gstin: text("gstin"),
    pan: text("pan"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    billingAddress: text("billing_address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    approvalStatus: text("approval_status").default("pending").notNull(),
    creditLimitPaise: integer("credit_limit_paise").default(0).notNull(),
    paymentTerms: text("payment_terms"),
    priceGroup: text("price_group").default("standard").notNull(),
    discountGroup: text("discount_group"),
    rejectionReason: text("rejection_reason"),
    approvedAt: timestamp("approved_at"),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("dealer_user_idx").on(table.userId),
    index("dealer_gstin_idx").on(table.gstin),
    index("dealer_approval_status_idx").on(table.approvalStatus),
  ],
);

export const dealerListing = pgTable(
  "dealer_listing",
  {
    id: text("id").primaryKey(),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "cascade" }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "restrict",
    }),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
    sku: text("sku"),
    pricePaise: integer("price_paise").notNull(),
    mrpPaise: integer("mrp_paise"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("dealer_listing_dealer_idx").on(table.dealerId),
    index("dealer_listing_part_idx").on(table.partId),
    index("dealer_listing_status_idx").on(table.status),
  ],
);

export const firm = pgTable("firm", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  ledgerReference: text("ledger_reference").notNull().unique(),
  legalName: text("legal_name"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  gstin: text("gstin"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Firm-wise bank/UPI payment configuration.
 * Secrets stay in env; this table stores public payment display fields
 * that admins can configure. Env vars still take precedence when set.
 */
export const firmPaymentConfig = pgTable(
  "firm_payment_config",
  {
    id: text("id").primaryKey(),
    firmId: text("firm_id")
      .notNull()
      .unique()
      .references(() => firm.id, { onDelete: "cascade" }),
    accountName: text("account_name"),
    accountNumber: text("account_number"),
    ifscCode: text("ifsc_code"),
    bankName: text("bank_name"),
    branch: text("branch"),
    upiId: text("upi_id"),
    qrImageUrl: text("qr_image_url"),
    paymentInstructions: text("payment_instructions"),
    codEnabled: boolean("cod_enabled").default(true).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("firm_payment_config_firm_idx").on(table.firmId)],
);

export const inventory = pgTable(
  "inventory",
  {
    id: text("id").primaryKey(),
    dealerListingId: text("dealer_listing_id")
      .notNull()
      .unique()
      .references(() => dealerListing.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    warehouseCode: text("warehouse_code").default("MAIN").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("inventory_listing_idx").on(table.dealerListingId)],
);

export const enquiryOffer = pgTable(
  "enquiry_offer",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id")
      .notNull()
      .references(() => enquiry.id, { onDelete: "cascade" }),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "cascade" }),
    pricePaise: integer("price_paise").notNull(),
    quantity: integer("quantity").notNull(),
    message: text("message"),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("enquiry_offer_enquiry_idx").on(table.enquiryId),
    index("enquiry_offer_dealer_idx").on(table.dealerId),
    index("enquiry_offer_status_idx").on(table.status),
  ],
);

export const cart = pgTable(
  "cart",
  {
    id: text("id").primaryKey(),
    buyerId: text("buyer_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("cart_buyer_idx").on(table.buyerId)],
);

export const cartItem = pgTable(
  "cart_item",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    dealerListingId: text("dealer_listing_id")
      .notNull()
      .references(() => dealerListing.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    pricePaise: integer("price_paise").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cart_item_cart_idx").on(table.cartId),
    index("cart_item_listing_idx").on(table.dealerListingId),
    uniqueIndex("cart_item_cart_listing_unique").on(
      table.cartId,
      table.dealerListingId,
    ),
  ],
);

export const order = pgTable(
  "order",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").default("placed").notNull(),
    paymentStatus: text("payment_status").default("pending").notNull(),
    paymentMethod: text("payment_method")
      .default("cash_on_delivery")
      .notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    shippingPaise: integer("shipping_paise").default(0).notNull(),
    totalPaise: integer("total_paise").notNull(),
    checkoutIdempotencyKey: text("checkout_idempotency_key").unique(),
    shippingName: text("shipping_name").notNull(),
    shippingPhone: text("shipping_phone").notNull(),
    shippingAddressLine1: text("shipping_address_line1").notNull(),
    shippingAddressLine2: text("shipping_address_line2"),
    shippingCity: text("shipping_city").notNull(),
    shippingState: text("shipping_state").notNull(),
    shippingPincode: text("shipping_pincode").notNull(),
    buyerBusinessName: text("buyer_business_name"),
    buyerGstin: text("buyer_gstin"),
    customerType: text("customer_type").default("b2c").notNull(),
    shippingMethod: text("shipping_method").default("courier").notNull(),
    transportName: text("transport_name"),
    transportPhone: text("transport_phone"),
    transportGstin: text("transport_gstin"),
    billingAddressLine1: text("billing_address_line1"),
    billingAddressLine2: text("billing_address_line2"),
    billingCity: text("billing_city"),
    billingState: text("billing_state"),
    billingPincode: text("billing_pincode"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_buyer_idx").on(table.buyerId),
    index("order_status_idx").on(table.status),
    index("order_created_at_idx").on(table.createdAt),
    index("order_buyer_gstin_idx").on(table.buyerGstin),
  ],
);

export const orderItem = pgTable(
  "order_item",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    dealerListingId: text("dealer_listing_id")
      .notNull()
      .references(() => dealerListing.id, { onDelete: "restrict" }),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "restrict" }),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "restrict" }),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    partBrand: text("part_brand"),
    sku: text("sku"),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull(),
    listInclusivePaise: integer("list_inclusive_paise").default(0).notNull(),
    discountPercent: integer("discount_percent").default(0).notNull(),
    discountPaise: integer("discount_paise").default(0).notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    gstRate: integer("gst_rate").default(18).notNull(),
    basePaise: integer("base_paise").default(0).notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    lineDiscountPaise: integer("line_discount_paise").default(0).notNull(),
    lineBasePaise: integer("line_base_paise").default(0).notNull(),
    lineGstPaise: integer("line_gst_paise").default(0).notNull(),
    totalPaise: integer("total_paise").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("order_item_order_idx").on(table.orderId),
    index("order_item_dealer_idx").on(table.dealerId),
    index("order_item_listing_idx").on(table.dealerListingId),
  ],
);

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    firmOrderId: text("firm_order_id")
      .notNull()
      .unique()
      .references(() => firmOrder.id, { onDelete: "restrict" }),
    firmId: text("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: text("status").default("created").notNull(),
    paymentSessionId: text("payment_session_id"),
    gatewayStatus: text("gateway_status"),
    idempotencyKey: text("idempotency_key").unique(),
    paidAt: timestamp("paid_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_provider_status_idx").on(table.provider, table.status),
    index("payment_order_idx").on(table.orderId),
    index("payment_firm_idx").on(table.firmId),
  ],
);

export const firmOrder = pgTable(
  "firm_order",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    firmId: text("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "restrict" }),
    allocationNumber: text("allocation_number").notNull().unique(),
    amountPaise: integer("amount_paise").notNull(),
    subtotalPaise: integer("subtotal_paise").default(0).notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    paymentMethod: text("payment_method")
      .default("cash_on_delivery")
      .notNull(),
    invoiceReference: text("invoice_reference"),
    fulfillmentStatus: text("fulfillment_status").default("pending").notNull(),
    paymentStatus: text("payment_status").default("unpaid").notNull(),
    paymentAccountingReference: text("payment_accounting_reference")
      .notNull()
      .unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("firm_order_order_firm_unique").on(table.orderId, table.firmId),
    index("firm_order_firm_status_idx").on(
      table.firmId,
      table.fulfillmentStatus,
    ),
  ],
);

export const firmOrderItem = pgTable(
  "firm_order_item",
  {
    id: text("id").primaryKey(),
    firmOrderId: text("firm_order_id")
      .notNull()
      .references(() => firmOrder.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id")
      .notNull()
      .unique()
      .references(() => orderItem.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("firm_order_item_firm_order_idx").on(table.firmOrderId)],
);

export const manualPaymentSubmission = pgTable(
  "manual_payment_submission",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    firmOrderId: text("firm_order_id").references(() => firmOrder.id, {
      onDelete: "set null",
    }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    utrReference: text("utr_reference").notNull(),
    paymentDate: timestamp("payment_date").notNull(),
    proofFileUrl: text("proof_file_url"),
    proofFileName: text("proof_file_name"),
    proofFileType: text("proof_file_type"),
    status: text("status").default("submitted").notNull(),
    adminNote: text("admin_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("manual_payment_order_idx").on(table.orderId),
    index("manual_payment_buyer_idx").on(table.buyerId),
    index("manual_payment_status_idx").on(table.status),
    index("manual_payment_utr_idx").on(table.utrReference),
    index("manual_payment_firm_idx").on(table.firmId),
  ],
);

export const manualPaymentSubmissionRelations = relations(
  manualPaymentSubmission,
  ({ one }) => ({
    order: one(order, {
      fields: [manualPaymentSubmission.orderId],
      references: [order.id],
    }),
    buyer: one(user, {
      fields: [manualPaymentSubmission.buyerId],
      references: [user.id],
    }),
    reviewer: one(user, {
      fields: [manualPaymentSubmission.reviewedBy],
      references: [user.id],
    }),
  }),
);

/** Customer saved delivery addresses (multiple). */
export const customerAddress = pgTable(
  "customer_address",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").default("Home").notNull(),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customer_address_user_idx").on(table.userId),
    index("customer_address_pincode_idx").on(table.pincode),
  ],
);

/** Customer vehicle garage — "Meri Gaadi Ke Liye Parts". */
export const customerVehicle = pgTable(
  "customer_vehicle",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vehicleType: text("vehicle_type").default("car").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year"),
    variant: text("variant"),
    registrationNumber: text("registration_number"),
    vin: text("vin"),
    catalogVehicleId: text("catalog_vehicle_id").references(() => vehicle.id, {
      onDelete: "set null",
    }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("customer_vehicle_user_idx").on(table.userId),
    index("customer_vehicle_make_model_idx").on(table.make, table.model),
  ],
);

export const wishlist = pgTable(
  "wishlist",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wishlist_user_part_unique").on(table.userId, table.partId),
    index("wishlist_user_idx").on(table.userId),
  ],
);

export const retailerDocument = pgTable(
  "retailer_document",
  {
    id: text("id").primaryKey(),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: text("file_type"),
    status: text("status").default("submitted").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("retailer_document_dealer_idx").on(table.dealerId)],
);

export const returnRequest = pgTable(
  "return_request",
  {
    id: text("id").primaryKey(),
    requestNumber: text("request_number").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    orderItemId: text("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    requestType: text("request_type").notNull(),
    reason: text("reason").notNull(),
    description: text("description"),
    status: text("status").default("submitted").notNull(),
    photoUrls: text("photo_urls"),
    videoUrls: text("video_urls"),
    documentUrls: text("document_urls"),
    adminNote: text("admin_note"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("return_request_buyer_idx").on(table.buyerId),
    index("return_request_order_idx").on(table.orderId),
    index("return_request_status_idx").on(table.status),
    index("return_request_firm_idx").on(table.firmId),
  ],
);

export const warrantyClaim = pgTable(
  "warranty_claim",
  {
    id: text("id").primaryKey(),
    claimNumber: text("claim_number").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "restrict" }),
    orderItemId: text("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    partId: text("part_id").references(() => part.id, {
      onDelete: "set null",
    }),
    issueDescription: text("issue_description").notNull(),
    status: text("status").default("submitted").notNull(),
    photoUrls: text("photo_urls"),
    videoUrls: text("video_urls"),
    documentUrls: text("document_urls"),
    adminNote: text("admin_note"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("warranty_claim_buyer_idx").on(table.buyerId),
    index("warranty_claim_order_idx").on(table.orderId),
    index("warranty_claim_status_idx").on(table.status),
  ],
);

export const supportTicket = pgTable(
  "support_ticket",
  {
    id: text("id").primaryKey(),
    ticketNumber: text("ticket_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => order.id, {
      onDelete: "set null",
    }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: text("status").default("open").notNull(),
    priority: text("priority").default("normal").notNull(),
    photoUrls: text("photo_urls"),
    videoUrls: text("video_urls"),
    documentUrls: text("document_urls"),
    assignedTo: text("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),
    internalNotes: text("internal_notes"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("support_ticket_user_idx").on(table.userId),
    index("support_ticket_status_idx").on(table.status),
    index("support_ticket_category_idx").on(table.category),
  ],
);

/** Phase 2 prep: warehouse architecture (single MAIN warehouse for Phase 1). */
export const warehouse = pgTable(
  "warehouse",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("warehouse_firm_idx").on(table.firmId)],
);

/** Audit log for sensitive admin actions (Phase 1 architecture). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorUserId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

/** Phase 6: supplier master (admin-managed; no invented legal IDs). */
export const supplier = pgTable(
  "supplier",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    gstin: text("gstin"),
    pan: text("pan"),
    paymentTerms: text("payment_terms"),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_firm_idx").on(table.firmId),
    index("supplier_active_idx").on(table.isActive),
  ],
);

/** Phase 6: stock adjustment ledger (never silent stock changes). */
export const stockAdjustment = pgTable(
  "stock_adjustment",
  {
    id: text("id").primaryKey(),
    inventoryId: text("inventory_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "restrict" }),
    dealerListingId: text("dealer_listing_id")
      .notNull()
      .references(() => dealerListing.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    warehouseCode: text("warehouse_code").default("MAIN").notNull(),
    goodsReceiptId: text("goods_receipt_id"),
    goodsReceiptItemId: text("goods_receipt_item_id"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("stock_adjustment_inventory_idx").on(table.inventoryId),
    index("stock_adjustment_listing_idx").on(table.dealerListingId),
    index("stock_adjustment_created_idx").on(table.createdAt),
  ],
);

/** Phase 6: business sales order (separate from retail checkout order). */
export const salesOrder = pgTable(
  "sales_order",
  {
    id: text("id").primaryKey(),
    soNumber: text("so_number").notNull().unique(),
    status: text("status").default("draft").notNull(),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "restrict",
    }),
    dealerId: text("dealer_id").references(() => dealer.id, {
      onDelete: "set null",
    }),
    buyerUserId: text("buyer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    partyName: text("party_name").notNull(),
    partyPhone: text("party_phone"),
    deliveryAddress: text("delivery_address"),
    notes: text("notes"),
    subtotalPaise: integer("subtotal_paise").default(0).notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    totalPaise: integer("total_paise").default(0).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    convertedOrderId: text("converted_order_id").references(() => order.id, {
      onDelete: "set null",
    }),
    quotationId: text("quotation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("sales_order_status_idx").on(table.status),
    index("sales_order_firm_idx").on(table.firmId),
    index("sales_order_dealer_idx").on(table.dealerId),
  ],
);

export const salesOrderItem = pgTable(
  "sales_order_item",
  {
    id: text("id").primaryKey(),
    salesOrderId: text("sales_order_id")
      .notNull()
      .references(() => salesOrder.id, { onDelete: "cascade" }),
    dealerListingId: text("dealer_listing_id").references(() => dealerListing.id, {
      onDelete: "set null",
    }),
    partId: text("part_id").references(() => part.id, { onDelete: "set null" }),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    gstRate: integer("gst_rate").default(18).notNull(),
    lineGstPaise: integer("line_gst_paise").default(0).notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("sales_order_item_so_idx").on(table.salesOrderId)],
);

/** Phase 6: purchase order (stock does not increase until goods receipt). */
export const purchaseOrder = pgTable(
  "purchase_order",
  {
    id: text("id").primaryKey(),
    poNumber: text("po_number").notNull().unique(),
    status: text("status").default("draft").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "restrict",
    }),
    warehouseCode: text("warehouse_code").default("MAIN").notNull(),
    expectedDeliveryDate: timestamp("expected_delivery_date"),
    notes: text("notes"),
    subtotalPaise: integer("subtotal_paise").default(0).notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    totalPaise: integer("total_paise").default(0).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("purchase_order_status_idx").on(table.status),
    index("purchase_order_supplier_idx").on(table.supplierId),
    index("purchase_order_firm_idx").on(table.firmId),
  ],
);

export const purchaseOrderItem = pgTable(
  "purchase_order_item",
  {
    id: text("id").primaryKey(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: "cascade" }),
    dealerListingId: text("dealer_listing_id").references(() => dealerListing.id, {
      onDelete: "set null",
    }),
    partId: text("part_id").references(() => part.id, { onDelete: "set null" }),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    /** Cumulative confirmed goods-receipt quantity. PO create leaves this at 0. */
    receivedQuantity: integer("received_quantity").default(0).notNull(),
    unitCostPaise: integer("unit_cost_paise").notNull(),
    gstRate: integer("gst_rate").default(18).notNull(),
    lineGstPaise: integer("line_gst_paise").default(0).notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("purchase_order_item_po_idx").on(table.purchaseOrderId)],
);

/** Phase 6: quotation foundation (convertible to sales order). */
export const quotation = pgTable(
  "quotation",
  {
    id: text("id").primaryKey(),
    quotationNumber: text("quotation_number").notNull().unique(),
    status: text("status").default("draft").notNull(),
    firmId: text("firm_id").references(() => firm.id, {
      onDelete: "restrict",
    }),
    dealerId: text("dealer_id").references(() => dealer.id, {
      onDelete: "set null",
    }),
    partyName: text("party_name").notNull(),
    partyPhone: text("party_phone"),
    validUntil: timestamp("valid_until"),
    notes: text("notes"),
    subtotalPaise: integer("subtotal_paise").default(0).notNull(),
    gstPaise: integer("gst_paise").default(0).notNull(),
    totalPaise: integer("total_paise").default(0).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    convertedSalesOrderId: text("converted_sales_order_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("quotation_status_idx").on(table.status),
    index("quotation_dealer_idx").on(table.dealerId),
  ],
);

export const quotationItem = pgTable(
  "quotation_item",
  {
    id: text("id").primaryKey(),
    quotationId: text("quotation_id")
      .notNull()
      .references(() => quotation.id, { onDelete: "cascade" }),
    dealerListingId: text("dealer_listing_id").references(() => dealerListing.id, {
      onDelete: "set null",
    }),
    partId: text("part_id").references(() => part.id, { onDelete: "set null" }),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    gstRate: integer("gst_rate").default(18).notNull(),
    lineGstPaise: integer("line_gst_paise").default(0).notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("quotation_item_quotation_idx").on(table.quotationId)],
);

/** Order shipping / tracking fields extension via separate table. */
export const orderShipment = pgTable(
  "order_shipment",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    firmOrderId: text("firm_order_id").references(() => firmOrder.id, {
      onDelete: "set null",
    }),
    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    shippingLabelUrl: text("shipping_label_url"),
    expectedDeliveryDate: timestamp("expected_delivery_date"),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_shipment_order_idx").on(table.orderId),
    index("order_shipment_tracking_idx").on(table.trackingNumber),
  ],
);

/**
 * Admin-configurable pricing categories (dealer/customer groups).
 * Codes may align with dealer.price_group; no commercial % invented here.
 */
export const pricingCategory = pgTable(
  "pricing_category",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("pricing_category_active_idx").on(table.isActive)],
);

/**
 * Configurable pricing rules. discount_percent is null until admin sets it.
 * Hierarchy (highest first): customer → dealer → pricing_category → listing.
 */
export const pricingRule = pgTable(
  "pricing_rule",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    scope: text("scope").notNull(),
    pricingCategoryId: text("pricing_category_id").references(
      () => pricingCategory.id,
      { onDelete: "set null" },
    ),
    customerUserId: text("customer_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    dealerId: text("dealer_id").references(() => dealer.id, {
      onDelete: "cascade",
    }),
    discountPercent: integer("discount_percent"),
    isActive: boolean("is_active").default(true).notNull(),
    validFrom: timestamp("valid_from"),
    validUntil: timestamp("valid_until"),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("pricing_rule_scope_idx").on(table.scope),
    index("pricing_rule_customer_idx").on(table.customerUserId),
    index("pricing_rule_dealer_idx").on(table.dealerId),
    index("pricing_rule_category_idx").on(table.pricingCategoryId),
    index("pricing_rule_active_idx").on(table.isActive),
  ],
);

export const pricingRuleAudit = pgTable(
  "pricing_rule_audit",
  {
    id: text("id").primaryKey(),
    pricingRuleId: text("pricing_rule_id")
      .notNull()
      .references(() => pricingRule.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    oldValues: text("old_values"),
    newValues: text("new_values"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("pricing_rule_audit_rule_idx").on(table.pricingRuleId)],
);

/**
 * Immutable dealer AR ledger. Outstanding is derived from entries.
 * Existing dealers start with zero ledger rows (neutral), never invented balances.
 */
export const partyLedgerEntry = pgTable(
  "party_ledger_entry",
  {
    id: text("id").primaryKey(),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "restrict" }),
    entryType: text("entry_type").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    balanceAfterPaise: integer("balance_after_paise").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    externalReference: text("external_reference"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key").unique(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("party_ledger_dealer_idx").on(table.dealerId),
    index("party_ledger_created_idx").on(table.createdAt),
    index("party_ledger_ref_idx").on(table.referenceType, table.referenceId),
  ],
);

/** Confirmed goods receipt against a purchase order (stock increases here). */
export const goodsReceipt = pgTable(
  "goods_receipt",
  {
    id: text("id").primaryKey(),
    receiptNumber: text("receipt_number").notNull().unique(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: "restrict" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    warehouseCode: text("warehouse_code").default("MAIN").notNull(),
    status: text("status").default("confirmed").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    notes: text("notes"),
    receivedByUserId: text("received_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("goods_receipt_po_idx").on(table.purchaseOrderId),
    index("goods_receipt_supplier_idx").on(table.supplierId),
    index("goods_receipt_status_idx").on(table.status),
  ],
);

export const goodsReceiptItem = pgTable(
  "goods_receipt_item",
  {
    id: text("id").primaryKey(),
    goodsReceiptId: text("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipt.id, { onDelete: "cascade" }),
    purchaseOrderItemId: text("purchase_order_item_id")
      .notNull()
      .references(() => purchaseOrderItem.id, { onDelete: "restrict" }),
    dealerListingId: text("dealer_listing_id").references(() => dealerListing.id, {
      onDelete: "set null",
    }),
    partId: text("part_id").references(() => part.id, { onDelete: "set null" }),
    partNumber: text("part_number").notNull(),
    partName: text("part_name").notNull(),
    quantityReceived: integer("quantity_received").notNull(),
    stockAdjustmentId: text("stock_adjustment_id").references(
      () => stockAdjustment.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("goods_receipt_item_receipt_idx").on(table.goodsReceiptId),
    index("goods_receipt_item_po_item_idx").on(table.purchaseOrderItemId),
  ],
);

/**
 * CI / manufacturer source catalogue rows — commercial SpareLink price lives on dealer_listing.
 * Source price must never overwrite customer selling price.
 */
export const catalogueSourceItem = pgTable(
  "catalogue_source_item",
  {
    id: text("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    sourceSku: text("source_sku").notNull(),
    sourceId: text("source_id"),
    name: text("name"),
    manufacturer: text("manufacturer").default("ci").notNull(),
    brand: text("brand"),
    categoryName: text("category_name"),
    oeCode: text("oe_code"),
    sourcePricePaise: integer("source_price_paise"),
    sourceImageUrl: text("source_image_url"),
    sourceUrl: text("source_url"),
    sourceHash: text("source_hash"),
    sourceStatus: text("source_status").default("LIVE").notNull(),
    approvalStatus: text("approval_status")
      .default("PENDING_ADMIN_APPROVAL")
      .notNull(),
    partId: text("part_id").references(() => part.id, { onDelete: "set null" }),
    lastSeenAt: timestamp("last_seen_at"),
    sourcePriceChangedAt: timestamp("source_price_changed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("catalogue_source_item_source_sku_uidx").on(
      table.sourceKey,
      table.manufacturer,
      table.sourceSku,
    ),
    index("catalogue_source_item_part_idx").on(table.partId),
    index("catalogue_source_item_status_idx").on(table.sourceStatus),
    index("catalogue_source_item_approval_idx").on(table.approvalStatus),
  ],
);

/** Traceable CI sync runs — never interpret failed fetches as full catalogue deletion. */
export const catalogueSyncRun = pgTable(
  "catalogue_sync_run",
  {
    id: text("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    status: text("status").default("RUNNING").notNull(),
    dryRun: boolean("dry_run").default(false).notNull(),
    fetchComplete: boolean("fetch_complete").default(false).notNull(),
    fetchedCount: integer("fetched_count").default(0).notNull(),
    newCount: integer("new_count").default(0).notNull(),
    updatedCount: integer("updated_count").default(0).notNull(),
    unchangedCount: integer("unchanged_count").default(0).notNull(),
    sourceRemovedCount: integer("source_removed_count").default(0).notNull(),
    approvalPendingCount: integer("approval_pending_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    triggeredBy: text("triggered_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("catalogue_sync_run_source_idx").on(table.sourceKey),
    index("catalogue_sync_run_status_idx").on(table.status),
    index("catalogue_sync_run_started_idx").on(table.startedAt),
  ],
);
