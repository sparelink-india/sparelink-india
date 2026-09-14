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
    customerType: text("customer_type").default("b2c").notNull(), // "b2b" | "b2c"
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
    shippingPreference: text("shipping_preference").default("courier").notNull(), // "self_pickup" | "transport" | "courier"
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
}));

export const customerProfileRelations = relations(customerProfile, ({ one }) => ({
  user: one(user, {
    fields: [customerProfile.userId],
    references: [user.id],
  }),
}));

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("part_brand_idx").on(table.brand),
    index("part_category_idx").on(table.categoryId),
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
    gstin: text("gstin"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("dealer_user_idx").on(table.userId),
    index("dealer_gstin_idx").on(table.gstin),
  ],
);

export const dealerListing = pgTable(
  "dealer_listing",
  {
    id: text("id").primaryKey(),
    dealerId: text("dealer_id")
      .notNull()
      .references(() => dealer.id, { onDelete: "cascade" }),
    firmId: text("firm_id").references(() => firm.id, { onDelete: "restrict" }),
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
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const inventory = pgTable(
  "inventory",
  {
    id: text("id").primaryKey(),
    dealerListingId: text("dealer_listing_id")
      .notNull()
      .unique()
      .references(() => dealerListing.id, { onDelete: "cascade" }),
    quantity: integer("quantity").default(0).notNull(),
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
    paymentMethod: text("payment_method").default("cash_on_delivery").notNull(),
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
    // Additive immutable snapshot fields
    buyerBusinessName: text("buyer_business_name"),
    buyerGstin: text("buyer_gstin"),
    customerType: text("customer_type").default("b2c").notNull(), // "b2b" | "b2c"
    shippingMethod: text("shipping_method").default("courier").notNull(), // "self_pickup" | "transport" | "courier"
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
      .unique()
      .references(() => order.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: text("status").default("created").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_provider_status_idx").on(table.provider, table.status),
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



