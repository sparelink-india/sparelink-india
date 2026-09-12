import { relations } from "drizzle-orm";
import {
  boolean,
  index,
    integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified").default(false).notNull(),
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

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
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

export const partCategory = pgTable(
  "part_category",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);
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

