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
    shippingPaise: integer("shipping_paise").default(0).notNull(),
    totalPaise: integer("total_paise").notNull(),
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
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
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