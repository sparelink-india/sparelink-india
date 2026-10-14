import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
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
    /**
     * A part may be compatible with a vehicle exactly once.
     *
     * The two single-column indexes above cannot express that rule: a
     * (part_id, vehicle_id) pair can be inserted twice and both rows are legal,
     * which would make a "link this part" action silently non-idempotent and
     * make an unlink remove more rows than intended. This index is what lets the
     * admin write path treat a link as a set membership rather than a count.
     *
     * Added once the table was confirmed to contain no duplicate pairs, so the
     * index could be created without touching any existing row.
     */
    uniqueIndex("part_vehicle_compatibility_part_vehicle_unique").on(
      table.partId,
      table.vehicleId,
    ),
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
  /**
   * PAN of the firm. A PAN is a mandatory field on an Indian tax invoice, so
   * it is stored next to the GSTIN rather than reconstructed from it.
   */
  pan: text("pan"),
  /**
   * Two-digit GST state code (e.g. "23"). Together with the order's place of
   * supply this decides CGST/SGST (intra-state) vs IGST (inter-state).
   * Null means "unknown", and the invoice then shows the undivided GST line
   * rather than inventing a split.
   */
  stateCode: text("state_code"),
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
    /**
     * Immutable HSN/SAC snapshot taken at order time. Previously HSN was
     * recovered at invoice time by regex over the LIVE part.description, which
     * meant editing a catalogue record silently rewrote historical invoices.
     */
    hsn: text("hsn"),
    /** Unit of measure snapshot (e.g. "PCS", "LTR", "KG"). Null when unknown. */
    uom: text("uom"),
    /**
     * Half of lineGstPaise when the sale is intra-state (CGST + SGST), or the
     * whole of lineGstPaise when inter-state (IGST). Snapshotted so an invoice
     * never recomputes the split from the buyer's current address.
     */
    cgstPaise: integer("cgst_paise").default(0).notNull(),
    sgstPaise: integer("sgst_paise").default(0).notNull(),
    igstPaise: integer("igst_paise").default(0).notNull(),
    /** Place of supply state code snapshot, used to explain the split. */
    placeOfSupplyCode: text("place_of_supply_code"),
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

/* =====================================================================
   DEMAND CAPTURE (migration 0030)

   The gap this fills: nothing in the schema recorded that a customer wanted a
   quantity the business could not supply. When stock ran short the order either
   failed or the want was silently lost, so procurement could not answer "how
   many of part X do people actually want?" from any real record.

   DESIGN NOTES
   ------------
   - Demand is keyed on `part_id`, NOT on a listing. The same physical part can
     be listed under several dealers and firms, and procurement buys the PART.
     Keying on the listing would split one part's demand across many rows and
     make every aggregate wrong.
   - `firm_id` is a SNAPSHOT of the firm the demand was raised against. It is
     denormalised deliberately: firm is authoritative from the server context at
     capture time, and the record must keep naming that firm even if a listing is
     later re-pointed. Never read it back from client input.
   - Quantities are four independent counters so PART E's "never count the
     original 50 again as 40" rule is representable. Aggregation reads pending.
   - `idempotency_key` is UNIQUE and nullable: a double-clicked Request must not
     create a second row, but not every flow has a natural key.
   - There is NO supplier, cost, price or delivery-date column. A demand row
     records what a customer asked for and nothing else. Promising a date here
     would be inventing information.
   ===================================================================== */

/** How a demand line was raised. Mirrors reality, not intent. */
export const DEMAND_SOURCES = [
  "out_of_stock_request",
  "shortage_during_order",
  "quantity_request",
  "dealer_request",
  "admin_entry",
] as const;
export type DemandSource = (typeof DEMAND_SOURCES)[number];

export const partDemand = pgTable(
  "part_demand",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "restrict" }),

    /** Whoever is waiting. A user id or a dealer id, resolved server-side. */
    customerUserId: text("customer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    customerDealerId: text("customer_dealer_id").references(() => dealer.id, {
      onDelete: "set null",
    }),
    /** Optional "notify me" contact, captured only if the user supplies it. */
    notifyEmail: text("notify_email"),
    notifyPhone: text("notify_phone"),

    /** Total units asked for. Never reduced when part of an order ships. */
    requestedQuantity: integer("requested_quantity").notNull(),
    /** Units that could be filled from stock at the moment of capture. */
    fulfillableQuantity: integer("fulfillable_quantity").default(0).notNull(),
    /** Units earmarked against a purchase order. */
    allocatedQuantity: integer("allocated_quantity").default(0).notNull(),
    /** Units actually handed over. */
    fulfilledQuantity: integer("fulfilled_quantity").default(0).notNull(),

    source: text("source").notNull(),
    status: text("status").default("requested").notNull(),

    /** Firm context captured server-side; never supplied by the client. */
    firmId: text("firm_id").references(() => firm.id, { onDelete: "restrict" }),

    /** Set when this demand came from a real order, so the two can be tied. */
    orderId: text("order_id").references(() => order.id, { onDelete: "set null" }),
    orderItemId: text("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),

    /** Client token that makes a resubmission a no-op. Nullable by design. */
    idempotencyKey: text("idempotency_key"),

    customerNote: text("customer_note"),
    /** Set by procurement when a purchase order answers this line. */
    purchaseOrderItemId: text("purchase_order_item_id").references(
      () => purchaseOrderItem.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** When the line was last given to a customer, for fulfilment reporting. */
    fulfilledAt: timestamp("fulfilled_at"),
  },
  (table) => [
    index("part_demand_part_idx").on(table.partId),
    index("part_demand_status_idx").on(table.status),
    index("part_demand_customer_idx").on(table.customerUserId),
    index("part_demand_dealer_idx").on(table.customerDealerId),
    index("part_demand_order_idx").on(table.orderId),
    index("part_demand_po_item_idx").on(table.purchaseOrderItemId),
    /* Aggregation reads the open lines for one part; this is that access shape. */
    index("part_demand_open_idx").on(table.partId, table.status),
    /* Partial unique index: dedupe retries, but only where a key was supplied.
       A null key is not a duplicate, so flows without one are unaffected. */
    uniqueIndex("part_demand_idempotency_uidx").on(table.idempotencyKey),
  ],
);

/**
 * Derived, admin-owned record of what to buy and why.
 *
 * A requirement is never an order. It exists so the shortfall and its causes
 * are written down once, reviewable, and linkable back to the demand that
 * caused it (Part S). `suggested_quantity` is advisory; `approved_quantity` is
 * what was actually ordered after admin editing, and `purchase_order_item_id`
 * records what it became.
 */
export const purchaseRequirement = pgTable(
  "purchase_requirement",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => part.id, { onDelete: "restrict" }),

    physicalQuantity: integer("physical_quantity").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    availableQuantity: integer("available_quantity").default(0).notNull(),
    pendingDemandQuantity: integer("pending_demand_quantity").default(0).notNull(),
    incomingQuantity: integer("incoming_quantity").default(0).notNull(),
    safetyStockQuantity: integer("safety_stock_quantity").default(0).notNull(),

    suggestedQuantity: integer("suggested_quantity").notNull(),
    /** Null until an admin approves a specific figure. */
    approvedQuantity: integer("approved_quantity"),

    status: text("status").default("suggested").notNull(),
    firmId: text("firm_id").references(() => firm.id, { onDelete: "restrict" }),

    /** Audit: why this row exists, in the operator's words at the time. */
    reason: text("reason"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    purchaseOrderId: text("purchase_order_id").references(
      () => purchaseOrder.id,
      { onDelete: "set null" },
    ),
    purchaseOrderItemId: text("purchase_order_item_id").references(
      () => purchaseOrderItem.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("purchase_requirement_part_idx").on(table.partId),
    index("purchase_requirement_status_idx").on(table.status),
    index("purchase_requirement_po_idx").on(table.purchaseOrderId),
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

/**
 * PROMOTIONAL BANNERS — the storefront advertisement slider.
 *
 * Deliberately a separate system from vehicle compatibility and from the hero:
 * it has no foreign key to `vehicle` or `part`, reads no compatibility table,
 * and shares no code path with fitment. Nothing here can affect what a part
 * fits.
 *
 * `imageKey` is the storage object key and is the source of truth. The public
 * URL is DERIVED from it at render time rather than stored, so re-pointing the
 * bucket or moving to a custom domain is a config change and not a data
 * migration. `destinationUrl` is a raw admin-authored value and is sanitised by
 * `lib/promotional-banners` on the way in AND on the way out, because a
 * customer-facing `href` is an injection sink.
 */
export const promotionalBanner = pgTable(
  "promotional_banner",
  {
    id: text("id").primaryKey(),
    /** Admin-facing name for this banner. Not necessarily shown to customers. */
    title: text("title").notNull(),
    /** Storage object key, e.g. `banners/2026/03/<id>.webp`. */
    imageKey: text("image_key").notNull(),
    /** Alt text. Falls back to `title` when null. */
    altText: text("alt_text"),
    /**
     * Optional click destination. Null means "display only" — the storefront
     * must then render a non-interactive element, never an empty <a>.
     */
    destinationUrl: text("destination_url"),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    /** Lower sorts first. Ties break on createdAt for a stable order. */
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("promotional_banner_enabled_order_idx").on(
      table.isEnabled,
      table.displayOrder,
    ),
  ],
);

/**
 * Durable, shared rate-limit counter.
 *
 * Replaces the module-level Map in `lib/rate-limit.ts`, which on Vercel gave
 * every warm lambda its own counters: a cold start cleared every limit and a
 * burst spread across N instances was admitted N times.
 *
 * Times are epoch milliseconds (Date.now()) so the expiry comparison has no
 * timezone dependency.
 */
export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    key: text("key").primaryKey(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    windowStartedAt: bigint("window_started_at", { mode: "number" }).notNull(),
    resetAt: bigint("reset_at", { mode: "number" }).notNull(),
  },
  (table) => [index("rate_limit_bucket_reset_idx").on(table.resetAt)],
);

/* ========================================================================== */
/* SPARELINK INDIA — CUSTOMER INTELLIGENCE & EXPERIENCE ANALYTICS             */
/* ========================================================================== */
/*
 * First-party visitor / session / behaviour analytics.
 *
 * DESIGN RULES THAT THE WHOLE MODULE DEPENDS ON
 *
 *  1. Nothing here is business-critical. Every table is additive. If analytics
 *     is dropped the website keeps working; if an analytics write fails, the
 *     customer journey is unaffected.
 *
 *  2. No secrets, ever. There is deliberately NO column that can hold a
 *     password, OTP, card number, UPI id, session cookie, bearer token or raw
 *     Authorization header. Structural impossibility is a stronger guarantee
 *     than a redaction function that might miss a new call site.
 *
 *  3. IP address is NOT stored as an identity. `lib/analytics/location.ts`
 *     derives a coarse country/state/city classification from the edge headers
 *     and persists only that, so a device is never identified by its address.
 *
 *  4. Analytics rows are NOT foreign-keyed to commerce rows. A deleted part
 *     must not delete its own history, and a page must never 500 because an
 *     analytics insert referenced a row that was removed a millisecond earlier.
 *     Denormalised snapshots (partNumber, productName, brand, city) are stored
 *     alongside the id for exactly that reason.
 *
 *  5. Precise GPS is opt-in, permission-gated and separately retained. It lives
 *     in `analyticsLocation` with an explicit `expiresAt`, and reading it back
 *     requires `analytics.precise_location`.
 */

/**
 * One row per first-party visitor identity.
 *
 * `id` is a server-generated opaque random UUID. It is deliberately NOT derived
 * from the IP address, the user agent, or any browser fingerprint, all of which
 * are spoofable and would amount to covert fingerprinting.
 *
 * Anonymous history is joined to an account the moment the visitor signs in:
 * `userId` is filled in and the backfill is performed by
 * `lib/analytics/session.ts`, so Customer 360 can show the pre-registration
 * journey.
 */
export const analyticsVisitor = pgTable(
  "analytics_visitor",
  {
    id: text("id").primaryKey(),
    /** Set when this anonymous visitor signs in or registers. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),

    /** Lifetime counters, maintained by the ingestion layer. */
    totalSessions: integer("total_sessions").default(0).notNull(),
    totalPageViews: integer("total_page_views").default(0).notNull(),
    totalSearches: integer("total_searches").default(0).notNull(),
    totalProductViews: integer("total_product_views").default(0).notNull(),
    totalEnquiries: integer("total_enquiries").default(0).notNull(),
    totalCartActivity: integer("total_cart_activity").default(0).notNull(),
    totalOrders: integer("total_orders").default(0).notNull(),
    /**
     * True when this visitor had at least one session before the current one.
     * Computed server-side so "returning" can never be spoofed by the client.
     */
    isReturning: boolean("is_returning").default(false).notNull(),

    /* --------------------------------------------------- last-known context */
    country: text("country"),
    /** State / region name. */
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),
    locationSource: text("location_source"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    viewportWidth: integer("viewport_width"),
    viewportHeight: integer("viewport_height"),
    locale: text("locale"),
    timezone: text("timezone"),

    /* --------------------------------------------------------- acquisition */
    referrerHost: text("referrer_host"),
    trafficSource: text("traffic_source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),

    /** granted | partial | denied — mirrored from analytics_consent. */
    consentState: text("consent_state").default("pending").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("analytics_visitor_user_idx").on(table.userId),
    index("analytics_visitor_last_seen_idx").on(table.lastSeenAt),
    index("analytics_visitor_first_seen_idx").on(table.firstSeenAt),
    index("analytics_visitor_city_idx").on(table.city),
    index("analytics_visitor_country_idx").on(table.country),
    index("analytics_visitor_device_idx").on(table.deviceCategory),
    index("analytics_visitor_traffic_source_idx").on(table.trafficSource),
  ],
);

/**
 * One row per visit.
 *
 * `lastActivityAt` is what "Live Visitors" sorts on. It is a near-real-time
 * heartbeat from the client rather than an always-open connection, because an
 * always-on socket per visitor would be both expensive and unnecessary for a
 * dashboard that a human looks at for a few seconds at a time.
 */
export const analyticsSession = pgTable(
  "analytics_session",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    startedAt: timestamp("started_at").defaultNow().notNull(),
    /** Set on explicit end-of-session or by the retention sweep. */
    endedAt: timestamp("ended_at"),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),

    landingPage: text("landing_page"),
    exitPage: text("exit_page"),
    referrer: text("referrer"),
    referrerHost: text("referrer_host"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    browserVersion: text("browser_version"),
    os: text("os"),
    viewportWidth: integer("viewport_width"),
    viewportHeight: integer("viewport_height"),
    locale: text("locale"),
    timezone: text("timezone"),

    country: text("country"),
    region: text("region"),
    city: text("city"),
    pincode: text("pincode"),
    /** APPROXIMATE | PRECISE | USER_ENTERED — never silently upgraded. */
    locationType: text("location_type"),
    locationSource: text("location_source"),

    consentState: text("consent_state").default("pending").notNull(),
    isBounced: boolean("is_bounced").default(true).notNull(),

    /* -------------------------------------------------- per-session counters */
    pageViews: integer("page_views").default(0).notNull(),
    eventCount: integer("event_count").default(0).notNull(),
    searchCount: integer("search_count").default(0).notNull(),
    productViewCount: integer("product_view_count").default(0).notNull(),
    cartCount: integer("cart_count").default(0).notNull(),
    checkoutCount: integer("checkout_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("analytics_session_visitor_idx").on(table.visitorId),
    index("analytics_session_user_idx").on(table.userId),
    index("analytics_session_started_at_idx").on(table.startedAt),
    index("analytics_session_last_activity_idx").on(table.lastActivityAt),
    index("analytics_session_city_idx").on(table.city),
    index("analytics_session_device_idx").on(table.deviceCategory),
  ],
);

/**
 * The general behaviour stream: every funnel milestone and every failure.
 *
 * This is the one table the funnel, the abandonment reports and the Live
 * Visitors view are all derived from, so it stays deliberately narrow. Anything
 * that needs its own filtering or retention policy (searches, product behaviour,
 * enquiries, errors, friction) has a dedicated table instead of being smeared
 * across a JSON blob here.
 *
 * `id` is the client-generated `eventId`, which is also the idempotency key:
 * a duplicate delivery from a retrying beacon is ignored by the primary key
 * rather than double-counted.
 */
export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),

    visitorId: text("visitor_id")
      .notNull()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => analyticsSession.id, { onDelete: "cascade" }),
    /** Server-derived from the session. A client cannot claim a userId. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    isAuthenticated: boolean("is_authenticated").default(false).notNull(),

    path: text("path"),
    referrer: text("referrer"),
    referrerHost: text("referrer_host"),
    trafficSource: text("traffic_source"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    viewportWidth: integer("viewport_width"),
    viewportHeight: integer("viewport_height"),
    locale: text("locale"),
    timezone: text("timezone"),

    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    /** Denormalised snapshots; analytics must survive part/category deletion. */
    partId: text("part_id"),
    categoryId: text("category_id"),
    searchQuery: text("search_query"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    /** Server clock. Differs from occurredAt when a client clock is wrong. */
    receivedAt: timestamp("received_at").defaultNow().notNull(),

    /**
     * Bounded JSON, only ever a small allow-listed map. Never free text from a
     * form. `lib/analytics/privacy.ts` rejects the payload if any sensitive key
     * or oversized value survives scrubbing.
     */
    metadata: text("metadata"),
  },
  (table) => [
    index("analytics_event_occurred_at_idx").on(table.occurredAt),
    index("analytics_event_received_at_idx").on(table.receivedAt),
    index("analytics_event_visitor_idx").on(table.visitorId),
    index("analytics_event_session_idx").on(table.sessionId),
    index("analytics_event_user_idx").on(table.userId),
    index("analytics_event_type_idx").on(table.eventType),
    index("analytics_event_type_occurred_idx").on(table.eventType, table.occurredAt),
    index("analytics_event_part_idx").on(table.partId),
    index("analytics_event_city_idx").on(table.city),
  ],
);

/**
 * One row per meaningful page view, with entry/exit and dwell time.
 *
 * `durationMs` is reported by the client on navigation away. A view that is
 * never closed (tab killed, hard refresh on a slow connection) keeps its last
 * known heartbeat instead of being reported as zero, so an artificially small
 * duration is never mistaken for a bounce.
 */
export const analyticsPageView = pgTable(
  "analytics_page_view",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => analyticsSession.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    path: text("path").notNull(),
    /** homepage | catalogue | category | search | product | brand | ... */
    pageType: text("page_type").notNull(),
    /** Document title, truncated. Not page content. */
    title: text("title"),

    referrer: text("referrer"),
    referrerHost: text("referrer_host"),
    isEntrance: boolean("is_entrance").default(false).notNull(),
    isExit: boolean("is_exit").default(false).notNull(),
    durationMs: integer("duration_ms").default(0).notNull(),

    partId: text("part_id"),
    categoryId: text("category_id"),
    brand: text("brand"),
    searchQuery: text("search_query"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    viewportWidth: integer("viewport_width"),
    viewportHeight: integer("viewport_height"),

    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    metadata: text("metadata"),
  },
  (table) => [
    index("analytics_page_view_occurred_at_idx").on(table.occurredAt),
    index("analytics_page_view_visitor_idx").on(table.visitorId),
    index("analytics_page_view_session_idx").on(table.sessionId),
    index("analytics_page_view_user_idx").on(table.userId),
    index("analytics_page_view_path_idx").on(table.path),
    index("analytics_page_view_type_idx").on(table.pageType),
    index("analytics_page_view_type_occurred_idx").on(
      table.pageType,
      table.occurredAt,
    ),
    index("analytics_page_view_part_idx").on(table.partId),
  ],
);

/**
 * Every meaningful customer search, including the ones that found nothing.
 *
 * Zero-result searches are the highest-value row in this table and the reason it
 * exists separately from `analytics_event`: "customers asked for X and we do not
 * stock it" is unserved demand, and it is invisible unless the zero-result case
 * is recorded rather than treated as a non-event.
 *
 * `normalizedQuery` (lowercased, collapsed whitespace, punctuation stripped) is
 * what the admin reports group by, so cosmetic variations of one query count
 * once. The raw `query` is retained but falls under the shorter free-text
 * retention window in `lib/analytics/retention.ts`.
 */
export const analyticsSearch = pgTable(
  "analytics_search",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => analyticsSession.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    /** part_number | part_name | brand | vehicle | category | generic */
    searchType: text("search_type").default("generic").notNull(),

    partNumber: text("part_number"),
    partName: text("part_name"),
    brand: text("brand"),
    categoryName: text("category_name"),
    vehicle: text("vehicle"),

    resultCount: integer("result_count").default(0).notNull(),
    hasResults: boolean("has_results").default(false).notNull(),
    responseTimeMs: integer("response_time_ms"),

    /* ------------------------------------------------------ search outcomes */
    didClickResult: boolean("did_click_result").default(false).notNull(),
    didOpenProduct: boolean("did_open_product").default(false).notNull(),
    didWishlist: boolean("did_wishlist").default(false).notNull(),
    didAddToCart: boolean("did_add_to_cart").default(false).notNull(),
    didEnquire: boolean("did_enquire").default(false).notNull(),
    didOrder: boolean("did_order").default(false).notNull(),
    selectedPartId: text("selected_part_id"),

    path: text("path"),
    deviceCategory: text("device_category"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_search_occurred_at_idx").on(table.occurredAt),
    index("analytics_search_normalized_idx").on(table.normalizedQuery),
    index("analytics_search_visitor_idx").on(table.visitorId),
    index("analytics_search_session_idx").on(table.sessionId),
    index("analytics_search_user_idx").on(table.userId),
    index("analytics_search_has_results_idx").on(table.hasResults),
    index("analytics_search_part_number_idx").on(table.partNumber),
    index("analytics_search_city_idx").on(table.city),
    index("analytics_search_brand_idx").on(table.brand),
    index("analytics_search_type_occurred_idx").on(
      table.searchType,
      table.occurredAt,
    ),
  ],
);

/**
 * Product behaviour, from impression through to order.
 *
 * Split from `analytics_event` because product analytics is queried by partId
 * thousands of times a day ("top viewed", "high view / zero order") and must not
 * have to scan the whole behaviour stream to answer it.
 *
 * Supplier cost, margin and landed cost are NOT here and must never be added:
 * this table is read by a customer-facing export surface and by a future mobile
 * client, and it must stay customer-safe.
 */
export const analyticsProductEvent = pgTable(
  "analytics_product_event",
  {
    id: text("id").primaryKey(),
    /**
     * impression | view | modal_open | detail_view | gallery |
     * specifications | compatibility | wishlist_add | wishlist_remove |
     * cart_add | cart_remove | buy_now | whatsapp | enquiry_form |
     * checkout | order
     */
    eventType: text("event_type").notNull(),

    visitorId: text("visitor_id")
      .notNull()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => analyticsSession.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    /** Snapshot columns: the report must survive part deletion. */
    partId: text("part_id"),
    partNumber: text("part_number"),
    productName: text("product_name"),
    brand: text("brand"),
    categoryId: text("category_id"),
    categoryName: text("category_name"),

    quantity: integer("quantity"),
    /**
     * Resolved server-side from the authoritative dealer_listing -> firm chain.
     * NEVER accepted from the client: a forged firm id would be a cross-firm
     * reporting leak (see THREE-FIRM SAFETY in the module brief).
     */
    firmId: text("firm_id"),

    path: text("path"),
    searchQuery: text("search_query"),
    deviceCategory: text("device_category"),

    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_product_event_occurred_at_idx").on(table.occurredAt),
    index("analytics_product_event_visitor_idx").on(table.visitorId),
    index("analytics_product_event_session_idx").on(table.sessionId),
    index("analytics_product_event_user_idx").on(table.userId),
    index("analytics_product_event_part_idx").on(table.partId),
    index("analytics_product_event_part_type_idx").on(
      table.partId,
      table.eventType,
    ),
    index("analytics_product_event_type_occurred_idx").on(
      table.eventType,
      table.occurredAt,
    ),
    index("analytics_product_event_firm_idx").on(table.firmId),
    index("analytics_product_event_city_idx").on(table.city),
  ],
);

/**
 * Attribution for the existing `enquiry` table.
 *
 * `enquiry` itself is deliberately untouched: it is commerce data with its own
 * lifecycle. This table answers the questions `enquiry` cannot — which search
 * brought the customer to the part, where they were, on what device, and whether
 * the same visitor had already bounced through two other parts first.
 *
 * `enquiryId` cascades, so removing an enquiry also removes its analytics
 * attribution rather than leaving an orphan pointing at a row that no longer
 * exists.
 */
export const analyticsEnquiry = pgTable(
  "analytics_enquiry",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id")
      .notNull()
      .unique()
      .references(() => enquiry.id, { onDelete: "cascade" }),

    visitorId: text("visitor_id").references(() => analyticsVisitor.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").references(() => analyticsSession.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    partId: text("part_id"),
    partNumber: text("part_number"),
    productName: text("product_name"),
    brand: text("brand"),
    categoryId: text("category_id"),
    quantity: integer("quantity"),

    /** price_quote | availability | bulk | warranty | general */
    enquiryType: text("enquiry_type"),
    /** whatsapp | form | call | email */
    channel: text("channel"),

    searchQuery: text("search_query"),
    path: text("path"),
    referrer: text("referrer"),
    referrerHost: text("referrer_host"),

    country: text("country"),
    region: text("region"),
    city: text("city"),
    pincode: text("pincode"),
    locationType: text("location_type"),
    locationSource: text("location_source"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_enquiry_occurred_at_idx").on(table.occurredAt),
    index("analytics_enquiry_enquiry_idx").on(table.enquiryId),
    index("analytics_enquiry_user_idx").on(table.userId),
    index("analytics_enquiry_visitor_idx").on(table.visitorId),
    index("analytics_enquiry_session_idx").on(table.sessionId),
    index("analytics_enquiry_part_idx").on(table.partId),
    index("analytics_enquiry_city_idx").on(table.city),
    index("analytics_enquiry_type_idx").on(table.enquiryType),
  ],
);

/**
 * First-party error intelligence, deduplicated by fingerprint.
 *
 * One row per distinct problem, not per occurrence: 4,000 identical hydration
 * warnings cost one row and a counter, not 4,000 writes on the hot path.
 *
 * The fingerprint is a hash of (source, errorCode, route, page) — never of the
 * message, because a message usually carries a variable (an id, a part number)
 * that would defeat deduplication entirely.
 *
 * `stackSample` is capped and scrubbed. It is only ever populated from a
 * client-side JavaScript stack, which contains no server state.
 */
export const analyticsError = pgTable(
  "analytics_error",
  {
    id: text("id").primaryKey(),
    /** sha256 of source|code|route|page. Unique — the dedupe key. */
    fingerprint: text("fingerprint").notNull(),

    /** Stable machine code, e.g. JS_RUNTIME, API_TIMEOUT, IMAGE_FAILED. */
    errorCode: text("error_code").notNull(),
    /** Scrubbed and truncated. Never a raw server stack or response body. */
    message: text("message"),
    status: integer("status"),
    /** js | api | server | image | payment | search */
    source: text("source").default("js").notNull(),

    /** API route template, e.g. /api/catalogue/product-detail. Never a query. */
    route: text("route"),
    page: text("page"),
    stackSample: text("stack_sample"),

    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    affectedVisitors: integer("affected_visitors").default(0).notNull(),
    affectedSessions: integer("affected_sessions").default(0).notNull(),
    affectedPages: integer("affected_pages").default(0).notNull(),
    /** Bounded JSON array of the most affected page paths. */
    topPages: text("top_pages"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),

    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("analytics_error_fingerprint_unique").on(table.fingerprint),
    index("analytics_error_last_seen_idx").on(table.lastSeenAt),
    index("analytics_error_code_idx").on(table.errorCode),
    index("analytics_error_resolved_idx").on(table.isResolved),
    index("analytics_error_source_last_seen_idx").on(
      table.source,
      table.lastSeenAt,
    ),
    index("analytics_error_page_idx").on(table.page),
  ],
);

/**
 * Conservative UX-friction signals.
 *
 * A row here means "this control showed no measurable state change after several
 * attempts", never "the customer was angry". The distinction matters: a 3-click
 * burst on a carousel is normal exploration, so the thresholds are deliberately
 * conservative and every classification is reviewed by a human before anything
 * is concluded from it.
 *
 * No keystroke content, no form values, no element text. `elementId` is a
 * developer-supplied `data-analytics-id` string or a generated structural
 * selector, never the DOM node's innerText.
 */
export const analyticsFriction = pgTable(
  "analytics_friction",
  {
    id: text("id").primaryKey(),
    /**
     * repeated_click | dead_click | repeated_search | validation_loop |
     * nav_loop | repeated_product_open | checkout_retry | payment_retry |
     * api_timeout | slow_load | failed_interaction
     */
    kind: text("kind").notNull(),

    path: text("path"),
    /** data-analytics-id, or a generated structural selector. Never innerText. */
    elementId: text("element_id"),
    label: text("label"),

    occurrences: integer("occurrences").default(1).notNull(),
    firstOccurredAt: timestamp("first_occurred_at").defaultNow().notNull(),
    lastOccurredAt: timestamp("last_occurred_at").defaultNow().notNull(),

    visitorId: text("visitor_id").references(() => analyticsVisitor.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").references(() => analyticsSession.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    country: text("country"),
    region: text("region"),
    city: text("city"),

    metadata: text("metadata"),
  },
  (table) => [
    index("analytics_friction_last_occurred_idx").on(table.lastOccurredAt),
    index("analytics_friction_kind_last_idx").on(table.kind, table.lastOccurredAt),
    index("analytics_friction_visitor_idx").on(table.visitorId),
    index("analytics_friction_session_idx").on(table.sessionId),
    index("analytics_friction_path_idx").on(table.path),
  ],
);

/**
 * Location observations, at three explicitly-labelled levels.
 *
 * PRECISE coordinates are ONLY ever written here, and only after the browser or
 * app reported an explicit permission grant. `expiresAt` is set on insert and
 * enforced by the retention sweep, so precise coordinates cannot accumulate
 * indefinitely just because nobody remembered to clean them up.
 *
 * A customer's own entered address is USER_ENTERED and is retained for as long as
 * the customer/address relationship needs it, which is a different question from
 * behavioural history and is why it is a distinct locationType.
 */
export const analyticsLocation = pgTable(
  "analytics_location",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id").references(() => analyticsVisitor.id, {
      onDelete: "cascade",
    }),
    sessionId: text("session_id").references(() => analyticsSession.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

    /** PRECISE | APPROXIMATE | USER_ENTERED */
    locationType: text("location_type").notNull(),
    /** GPS | IP | USER_ADDRESS | APP_PERMISSION */
    locationSource: text("location_source").notNull(),

    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracyMeters: doublePrecision("accuracy_meters"),

    country: text("country"),
    region: text("region"),
    stateCode: text("state_code"),
    city: text("city"),
    pincode: text("pincode"),
    locality: text("locality"),
    formattedAddress: text("formatted_address"),
    /** Provider place id. Only when an authorised provider actually returned one. */
    placeId: text("place_id"),

    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    /** Retention deadline. Precise rows get the shortest window by far. */
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_location_occurred_at_idx").on(table.occurredAt),
    index("analytics_location_visitor_idx").on(table.visitorId),
    index("analytics_location_user_idx").on(table.userId),
    index("analytics_location_expires_at_idx").on(table.expiresAt),
    index("analytics_location_city_idx").on(table.city),
    index("analytics_location_state_code_idx").on(table.stateCode),
    index("analytics_location_type_idx").on(table.locationType),
  ],
);

/**
 * Customer-submitted problem reports.
 *
 * A SCREENSHOT IS ONLY EVER UPLOADED BY THE CUSTOMER, through an explicit file
 * picker. There is no covert capture path in this module: nothing in
 * `lib/analytics/client.ts` touches `getDisplayMedia`, `html2canvas`, the Screen
 * Capture API or the browser's screen surface.
 *
 * `screenshotKey` is a private object-storage key with randomised path segments
 * (see `lib/analytics/screenshots.ts`). No public bucket URL is ever stored, and
 * the admin read path is a short-lived signed request, so a leaked page URL
 * cannot be turned into a permanent public link.
 */
export const analyticsProblemReport = pgTable(
  "analytics_problem_report",
  {
    id: text("id").primaryKey(),

    visitorId: text("visitor_id").references(() => analyticsVisitor.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id").references(() => analyticsSession.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    /** search | product | checkout | payment | account | other */
    category: text("category").notNull(),
    description: text("description"),

    path: text("path"),
    partId: text("part_id"),
    partNumber: text("part_number"),
    searchQuery: text("search_query"),

    deviceCategory: text("device_category"),
    browser: text("browser"),
    os: text("os"),
    viewportWidth: integer("viewport_width"),
    viewportHeight: integer("viewport_height"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    locationType: text("location_type"),

    /** Private storage key. Randomised, never a customer-supplied filename. */
    screenshotKey: text("screenshot_key"),
    screenshotMime: text("screenshot_mime"),
    screenshotBytes: integer("screenshot_bytes"),
    screenshotWidth: integer("screenshot_width"),
    screenshotHeight: integer("screenshot_height"),

    /** Fingerprint link to a deduplicated error row, when one matched. */
    relatedErrorId: text("related_error_id"),
    /** Optional "was this helpful?" score collected on a normal page. */
    helpfulScore: integer("helpful_score"),

    /** open | triaged | resolved | dismissed */
    status: text("status").default("open").notNull(),
    adminNotes: text("admin_notes"),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("analytics_problem_report_created_at_idx").on(table.createdAt),
    index("analytics_problem_report_status_idx").on(table.status),
    index("analytics_problem_report_visitor_idx").on(table.visitorId),
    index("analytics_problem_report_user_idx").on(table.userId),
    index("analytics_problem_report_part_idx").on(table.partId),
    index("analytics_problem_report_category_idx").on(table.category),
  ],
);

/**
 * Per-visitor tracking preference.
 *
 * A `denied` row is authoritative: `lib/analytics/ingest.ts` refuses
 * behavioural events for that visitor even if the client keeps sending them, so
 * a preference cannot be bypassed by simply ignoring the client-side check.
 *
 * Local storage holds only a copy so the client can stop queueing immediately.
 * This table is the record of truth and the audit trail.
 */
export const analyticsConsent = pgTable(
  "analytics_consent",
  {
    id: text("id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .unique()
      .references(() => analyticsVisitor.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    /** granted | partial | denied */
    consentState: text("consent_state").default("pending").notNull(),
    analyticsAllowed: boolean("analytics_allowed").default(false).notNull(),
    /** Coarse country/state/city from the edge headers. */
    locationAllowed: boolean("location_allowed").default(false).notNull(),
    /** Exact GPS. Always separate, always a deliberate extra grant. */
    preciseLocationAllowed: boolean("precise_location_allowed")
      .default(false)
      .notNull(),
    /** Present so session replay can be switched on without a schema change. */
    replayAllowed: boolean("replay_allowed").default(false).notNull(),

    source: text("source"),
    /** Bumped when the wording changes, so an old grant is not silently reused. */
    policyVersion: text("policy_version"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("analytics_consent_user_idx").on(table.userId),
    index("analytics_consent_state_idx").on(table.consentState),
  ],
);

/**
 * Daily rollup used by the dashboard so a 30-day chart does not scan 30 days of
 * raw events on every page load.
 *
 * `metric` + `dimension` + `dimensionValue` is a deliberately narrow
 * metric/label store rather than 40 nullable counter columns, so adding a new
 * report does not require a migration and the row count stays proportional to
 * (metric, dimension, day) rather than to traffic volume.
 *
 * Rebuilt idempotently from the raw tables by the aggregation job, so it can be
 * dropped and regenerated at any time without losing the source of truth.
 */
export const analyticsDailyAggregate = pgTable(
  "analytics_daily_aggregate",
  {
    id: text("id").primaryKey(),
    /** YYYY-MM-DD in UTC. */
    date: text("date").notNull(),
    /** visitors | sessions | page_views | searches | zero_result_searches | ... */
    metric: text("metric").notNull(),
    /** all | page | device | browser | os | city | state | source | part | ... */
    dimension: text("dimension").default("all").notNull(),
    /** "" for dimension = all. */
    dimensionValue: text("dimension_value").default("").notNull(),
    value: bigint("value", { mode: "number" }).default(0).notNull(),
    /** Secondary figure kept alongside, e.g. search results count. */
    secondaryValue: bigint("secondary_value", { mode: "number" })
      .default(0)
      .notNull(),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("analytics_daily_aggregate_unique").on(
      table.date,
      table.metric,
      table.dimension,
      table.dimensionValue,
    ),
    index("analytics_daily_aggregate_metric_date_idx").on(
      table.metric,
      table.date,
    ),
    index("analytics_daily_aggregate_dim_idx").on(
      table.metric,
      table.dimension,
      table.dimensionValue,
      table.date,
    ),
    index("analytics_daily_aggregate_date_idx").on(table.date),
  ],
);

/**
 * Granular admin grants for the analytics surface.
 *
 * The existing role check ("is this user an admin") is necessary but not
 * sufficient: Customer 360 exposes a named customer's contact details and the
 * location report can expose precise coordinates. Those are separate grants, so
 * an operations admin can be given funnel and search data without being given
 * the customer list.
 *
 * Absence of a row means "not granted". There is deliberately no wildcard row:
 * an explicit list of grants is auditable, and granting everything is the
 * super-admin action rather than a default.
 */
export const analyticsAdminPermission = pgTable(
  "analytics_admin_permission",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("analytics_admin_permission_user_perm_unique").on(
      table.userId,
      table.permission,
    ),
    index("analytics_admin_permission_user_idx").on(table.userId),
  ],
);

/* ========================================================================== */
/* INDIA LOCATION REFERENCE DATA                                              */
/* ========================================================================== */
/*
 * Authoritative state / city / pincode data for the country this business
 * actually ships to.
 *
 * This is reference data, not analytics, but it lives here because the location
 * system depends on it and because the alternative - a `select` with six cities
 * hard-coded in a component - is exactly the failure the brief calls out.
 *
 * The pincode table holds a seeded set of real, verifiable pincodes. The full
 * India Post dataset is imported by `scripts/import-india-pincodes.ts` from an
 * official CSV. The server NEVER rejects an order because a pincode is absent
 * from this table: an unknown pincode is recorded as unverified rather than
 * blocking a customer.
 */

/** Two-letter codes that match the GST state-code list in lib/gst.ts. */
export const indiaState = pgTable(
  "india_state",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    stateCode: text("state_code").notNull(),
    isUnionTerritory: boolean("is_union_territory").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("india_state_code_unique").on(table.stateCode),
    index("india_state_name_idx").on(table.name),
  ],
);

export const indiaCity = pgTable(
  "india_city",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    stateId: text("state_id")
      .notNull()
      .references(() => indiaState.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("india_city_state_name_unique").on(table.stateId, table.name),
    index("india_city_state_idx").on(table.stateId),
    index("india_city_slug_idx").on(table.slug),
    index("india_city_name_idx").on(table.name),
  ],
);

export const indiaPincode = pgTable(
  "india_pincode",
  {
    /** The pincode itself is the natural key. */
    id: text("id").primaryKey(),
    cityId: text("city_id").references(() => indiaCity.id, {
      onDelete: "set null",
    }),
    stateId: text("state_id")
      .notNull()
      .references(() => indiaState.id, { onDelete: "cascade" }),
    locality: text("locality"),
    /** Courier delivery zone, e.g. "Delhi", "South". */
    region: text("region"),
    postOffice: text("post_office"),
  },
  (table) => [
    index("india_pincode_state_idx").on(table.stateId),
    index("india_pincode_city_idx").on(table.cityId),
    index("india_pincode_locality_idx").on(table.locality),
  ],
);