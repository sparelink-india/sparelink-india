# SPARELINK INDIA - COMPLETE MASTER REQUIREMENTS

PROJECT:
Existing Next.js application named SpareLink India.

OBJECTIVE:
Upgrade the existing application into a professional, production-ready, mobile-first automotive spare-parts platform supporting customer e-commerce, retailer/dealer B2B, inventory, orders, payments, support, warranty, returns and administration.

============================================================
ABSOLUTE RULE - DO NOT DESTROY EXISTING WORK
============================================================

THIS IS AN EXISTING WORKING APPLICATION.

FIRST INSPECT THE CURRENT CODEBASE.

DO NOT rebuild from scratch.

DO NOT unnecessarily overwrite:
- existing pages
- existing components
- existing APIs
- existing database
- existing Drizzle schema
- existing authentication
- existing Typesense search
- existing vehicle compatibility
- existing cart
- existing wishlist
- existing orders
- existing admin
- existing payment/account configuration
- existing Vercel configuration
- existing responsive/mobile design
- existing SpareLink branding
- existing burgundy theme

Before modifying anything:
1. Inspect the existing implementation.
2. Identify what already exists.
3. Reuse existing components and APIs wherever possible.
4. Extend existing systems instead of duplicating them.
5. Back up important files before major changes.

Every change must be classified internally as:

KEEP:
Already working and should remain.

UPDATE:
Existing feature needs modification.

REPLACE:
Existing implementation cannot support the required feature and must be replaced.

NEW:
Feature does not currently exist.

REMOVE:
Only remove when explicitly necessary.

NEVER replace working code just because creating a new implementation is easier.

============================================================
BUSINESS FIRMS
============================================================

SpareLink India must support THREE SEPARATE FIRMS:

1. Ambaji Traders
2. Hind Motors
3. India Sales

These firms must remain separate throughout the system.

Each firm must support separate:
- Business/legal name
- Address
- UPI ID
- Bank name
- Account name
- Account number
- IFSC
- Branch
- Bank transfer instructions
- Payment instructions
- Invoice information
- Customer-care information where applicable

Orders must identify which firm they belong to.

Invoices must identify the correct firm.

Payments must identify the correct firm.

Never mix payment information between firms.

Architecture must allow a fourth firm to be added later without rebuilding the payment system.

============================================================
PAYMENT RULE - NO PAID PAYMENT GATEWAY
============================================================

DO NOT integrate:
- Razorpay
- Stripe
- Cashfree
- PayU
- Any paid third-party payment gateway

The user specifically does NOT want paid payment gateways.

Payment methods must support:
- Firm-wise UPI
- Direct bank transfer
- Net banking/bank transfer instructions
- Optional COD if enabled

The user will enter the UPI ID and bank/net-banking details separately for:
- Ambaji Traders
- Hind Motors
- India Sales

When an order belongs to a firm, show ONLY that firm's payment details.

Never expose another firm's details.

Never store:
- Card numbers
- CVV
- ATM PIN
- UPI PIN
- Net banking passwords
- Other sensitive payment credentials

============================================================
COMMON WEBSITE
============================================================

Website must be fully responsive and mobile-first.

One website must work on:
- Mobile
- Tablet
- Desktop
- Large desktop

No separate mobile website.

Must not have:
- horizontal overflow
- overlapping elements
- clipped text
- invisible text
- broken select fields
- broken search
- buttons outside viewport
- broken cards
- broken images

Test at:
- 320px
- 375px
- 390px
- 430px
- Tablet
- Desktop

============================================================
LANGUAGE
============================================================

Support:
- English
- Hindi

Create scalable translation architecture.

Do not duplicate entire pages for Hindi and English.

============================================================
SEARCH
============================================================

Search must support:
- Part name
- Part number
- OEM number
- Alternate part number
- Brand
- Category
- Vehicle make
- Vehicle model
- Vehicle year
- Vehicle variant

The existing application uses Typesense.

KEEP and reuse the existing Typesense implementation.

DO NOT replace Typesense unnecessarily.

Search must provide:
- products
- compatible vehicles
- similar products
- alternative products
- substitute products

Public catalogue search should work.

Commercial/private information must be protected according to authentication and role.

============================================================
PRODUCT CATEGORIES
============================================================

Support:
- Engine
- Brake
- Clutch
- Electrical
- Suspension
- Filters
- Body Parts
- Accessories

Allow future categories.

============================================================
PRODUCT INFORMATION
============================================================

Products must support:
- Product name
- Photos
- Videos where available
- SKU
- Part number
- OEM number
- Alternate part numbers
- Barcode
- Brand
- Category
- Specifications
- Compatible vehicles
- Make
- Model
- Year
- Variant
- MRP
- Selling price
- GST
- Stock status
- Warranty
- Genuine/original
- Aftermarket
- Refurbished

Clearly label:
- Genuine / Original
- Aftermarket
- Refurbished

Clearly identify:
- MRP
- Selling price
- GST
- Tax inclusive/exclusive

============================================================
PRODUCT PAGE
============================================================

Support:
- Product image
- Product gallery
- Specifications
- Part number
- OEM number
- Brand
- Category
- MRP
- Selling price
- GST
- Stock
- Warranty
- Product type
- Compatible vehicles
- Similar products
- Alternative products
- Substitute products
- Add to Cart
- Wishlist
- Enquire on WhatsApp

Do not expose retailer-specific/private commercial data to unauthorized users.

============================================================
CUSTOMER PANEL
============================================================

Customers:
- Individual vehicle owners
- Mechanics

Authentication:
- Mobile OTP and/or email login

Profile:
- Name
- Mobile
- Email
- Multiple delivery addresses

Dashboard:
- Previous orders
- Invoices
- Reorder
- Wishlist
- Addresses
- Saved vehicles
- Returns
- Warranty claims
- Support tickets
- Notifications

============================================================
VEHICLE GARAGE
============================================================

Customer can save multiple:
- Cars
- Bikes
- Tractors
- Commercial vehicles

Vehicle fields:
- Make
- Model
- Year
- Variant
- Registration number
- VIN where supported

Create:
"MERI GAADI KE LIYE PARTS"

Selected vehicle should show compatible products.

Do not fake VIN or registration-number lookup.

Only integrate external vehicle data if a legitimate provider/API is available.

============================================================
VEHICLE COMPATIBILITY
============================================================

Product-to-vehicle compatibility must support:
- Make
- Model
- Year
- Variant

Use existing compatibility tables/system wherever possible.

Do not create duplicate vehicle systems.

============================================================
CUSTOMER PURCHASE
============================================================

Support:
- Cart
- Wishlist
- Quick WhatsApp enquiry
- Order placement
- Order tracking
- Invoice download
- Reorder
- Cancellation before dispatch
- Returns
- Replacement
- Warranty

Delivery:
- Delivery charge
- Expected delivery date
- Serviceable pincode check

Optional:
- Urgent Bhopal/local delivery

Do not show urgent delivery unless configured.

============================================================
GENUINE VERIFICATION
============================================================

Support QR/serial verification ONLY if manufacturer support/data exists.

Never fake verification.

============================================================
REVIEWS
============================================================

Support:
- Product reviews
- Ratings
- Verified purchase/verified customer indicator where possible

============================================================
RETURNS / REPLACEMENT / WARRANTY
============================================================

Support:
- Return request
- Replacement request
- Wrong part
- Damaged item
- Missing item
- Warranty claim
- Photo upload
- Video upload
- Document upload

Customer can track request status.

Cancellation allowed before dispatch according to business rules.

============================================================
NOTIFICATIONS
============================================================

Architecture should support:
- SMS
- WhatsApp
- Email
- Push notifications

Events:
- Order placed
- Confirmed
- Packed
- Shipped
- Out for delivery
- Delivered
- Cancelled
- Return
- Replacement
- Warranty
- Support updates
- Payment updates

Do not add paid services unnecessarily.

============================================================
SUPPORT
============================================================

Support:
- WhatsApp
- Phone
- Support tickets
- Part identification help form
- Mechanic support/chat where infrastructure permits

============================================================
RETAILER / DEALER B2B PANEL
============================================================

Retailers must have a separate B2B dashboard.

Registration:
- Business name
- Owner name
- Mobile
- Email
- GSTIN
- PAN
- Shop address
- Billing address
- GST certificate
- Business proof

Admin approval required.

Retailer account:
- Approval status
- Credit limit
- Payment terms
- Price group
- Discount group
- Multiple branches
- Staff users

============================================================
RETAILER PRICING
============================================================

Support:
- Retailer price
- Customer price
- Quantity slab pricing
- Brand-wise discount
- Minimum order quantity
- Retailer margin
- Discount
- Price groups

Clearly distinguish:
- Customer price
- Retailer price

Clearly label:
- Tax inclusive
- Tax exclusive

============================================================
RETAILER ORDERING
============================================================

Support:
- Bulk Excel upload
- Bulk CSV upload
- Fast part-number ordering
- Repeat order
- Saved purchase list
- Partial availability
- Back-order
- Stock reservation
- Multiple delivery addresses
- Retailer-specific shipping rates

============================================================
RETAILER FINANCE
============================================================

Retailer access:
- Purchase invoices
- GST invoices
- Credit notes
- Outstanding balance
- Ledger
- Payment history

Payment:
- UPI
- Direct bank transfer
- Net banking/bank transfer
- Credit account

NO PAID PAYMENT GATEWAY.

============================================================
RETAILER BUSINESS TOOLS
============================================================

Support:
- Quotation creation
- PDF quotation
- WhatsApp quotation sharing
- Saved purchase lists
- Reorder alerts
- Low-stock alerts
- Sales reports
- Purchase reports
- Optional retailer stock management
- Dedicated sales representative

============================================================
RETAILER COMPLAINTS
============================================================

Support:
- Wrong part
- Shortage
- Damage
- Missing item
- Payment issue
- Other

Track complaint status.

============================================================
ADMIN PANEL
============================================================

Admin control centre modules:

- Dashboard
- Products
- Categories
- Brands
- Vehicles
- Compatibility
- Inventory
- Warehouses
- Orders
- Customers
- Retailers
- Pricing
- Payments
- Invoices
- Returns
- Warranty
- Support
- Marketing
- Reports
- Staff
- Permissions
- Firms
- Settings
- Audit logs

============================================================
ADMIN PRODUCT MANAGEMENT
============================================================

Support:
- Add
- Edit
- Archive/delete
- Bulk upload
- SKU
- OEM/part number
- Alternate part numbers
- Barcode
- Brand
- Category
- Vehicle compatibility
- Model
- Variant
- Images
- Videos
- Specifications
- Warranty
- Genuine/aftermarket/refurbished
- MRP
- Selling price
- GST
- Retailer price
- Discounts

Product approval before publishing.

Related products:
- Related
- Substitute
- Accessories/bundles

============================================================
BULK CATALOGUE
============================================================

Support Excel/CSV upload.

Validate:
- Required fields
- Duplicate SKU
- Duplicate part number
- Invalid category
- Invalid brand
- Invalid vehicle
- Invalid GST
- Invalid pricing
- Invalid stock

Show import errors.

Never silently corrupt catalogue data.

============================================================
INVENTORY
============================================================

Support:
- Central stock
- Warehouse stock
- Reserved stock
- Available stock
- Low stock
- Out of stock
- Supplier purchase entry
- Stock adjustment
- Adjustment reason
- Damaged stock
- Returned stock
- Defective stock
- Batch tracking
- Serial tracking
- Barcode scanning
- Stock history
- Audit log

============================================================
WAREHOUSE
============================================================

Architecture must support multiple warehouses.

Warehouse:
- Stock
- Reserved
- Available

Orders can reserve stock.

Automatic multi-warehouse allocation is future/Phase 3, but architecture must allow it.

============================================================
ORDER MANAGEMENT
============================================================

Admin must manage:
- Customer orders
- Retailer orders

Statuses:
- Pending
- Confirmed
- Packed
- Shipped
- Delivered
- Cancelled
- Returned

Support:
- Manual phone orders
- Manual WhatsApp orders
- Invoice
- Shipping label
- Courier tracking
- Partial shipment
- Back-order
- Cancellation
- Replacement
- Refund approval
- COD verification
- Delivery failure

============================================================
FIRM-WISE ORDERS
============================================================

Every order must identify:
- Firm
- Customer/retailer
- Products
- Amount
- GST
- Payment method
- Payment status
- Shipping
- Invoice

Firms:
- Ambaji Traders
- Hind Motors
- India Sales

============================================================
FIRM-WISE PAYMENT CONFIGURATION
============================================================

Create or reuse a firm/business configuration system.

Ambaji Traders:
- UPI ID
- Bank details
- Payment instructions

Hind Motors:
- UPI ID
- Bank details
- Payment instructions

India Sales:
- UPI ID
- Bank details
- Payment instructions

Admin can configure these independently.

Order must use only the correct firm's payment information.

Architecture must support future additional firms.

============================================================
CUSTOMER / RETAILER MANAGEMENT
============================================================

Admin:
Customer:
- Profile
- Mobile
- Email
- Addresses
- Vehicles
- Orders
- Invoices
- Returns
- Warranty
- Support

Retailer:
- KYC
- GST
- PAN
- Documents
- Approval
- Price group
- Discount
- Credit limit
- Payment terms
- Ledger
- Outstanding
- Orders

============================================================
STAFF ROLES
============================================================

Support:
- Super Admin
- Inventory Manager
- Sales Manager
- Support Staff
- Accountant

Use role-based access.

Sensitive actions must be logged.

============================================================
FINANCE / REPORTS
============================================================

Reports:
- Sales
- Purchase
- Profit
- GST
- Customer sales
- Retailer sales
- Brand sales
- Category sales
- Fast-moving products
- Slow-moving products
- Returns
- Warranty
- Payment settlement
- Retailer outstanding

Export:
- Excel
- PDF

============================================================
ACCOUNTING
============================================================

Architecture must support future:
- Busy
- Tally
- Zoho

Do not break existing Busy integration.

If integration is unavailable, prepare architecture rather than fake integration.

============================================================
MARKETING
============================================================

Support:
- Homepage banners
- Offers
- Coupon codes
- Retailer promotions
- Push templates
- SMS templates
- Email templates
- WhatsApp templates
- Abandoned cart reminders
- Product enquiry leads

============================================================
SEO
============================================================

Product:
- SEO title
- SEO description
- Keywords
- URL/slug
- Meta title
- Meta description

Do not unnecessarily change existing URLs.

============================================================
BLOG
============================================================

Support future blog:
- Vehicle maintenance
- Spare-parts education
- Product education
- Buying guides

============================================================
SUPPORT TICKET SYSTEM
============================================================

Automatically generate unique complaint number.

Categories:
- Wrong part
- Damaged item
- Missing item
- Late delivery
- Warranty
- Payment issue
- Other

Customer:
- Create
- Upload photo
- Upload video
- Upload documents
- Track status

Admin:
- Assign
- Internal notes
- Escalate
- Resolve
- Resolution notes
- Resolution time report

============================================================
LEGAL PAGES
============================================================

Provide:
- Terms & Conditions
- Privacy Policy
- Shipping Policy
- Return/Refund Policy
- Warranty Policy
- Contact Us
- Customer Care
- Grievance Officer
- Complaint mechanism
- Business/legal information
- Address

Before purchase clearly show:
- Product details
- Seller/business details
- Warranty
- Payment
- Delivery
- Return/refund

Do not invent legal claims.

============================================================
SECURITY
============================================================

Maintain/add:
- HTTPS/SSL
- Secure authentication
- Admin 2FA architecture
- Role-based access
- API authorization
- CAPTCHA/login protection where appropriate
- Audit logs
- Price-change logs
- Stock-change logs
- Order-change logs
- Secure uploads
- Data export request
- Data deletion request
- Privacy consent
- Data-use notice

Never expose:
- API keys
- Database credentials
- Authentication secrets
- Private environment variables

============================================================
BACKUP
============================================================

Application must remain recoverable through Git/version control.

Database backup strategy must be supported.

Before major changes:
- backup important files
- preserve existing working state

============================================================
PHASE 1 - FIRST PRIORITY
============================================================

Make these production-ready first:

1. Product catalogue
2. Search
3. Vehicle compatibility
4. Customer login
5. Retailer registration
6. Retailer approval
7. Cart
8. Order placement
9. Admin product management
10. Admin stock management
11. Admin order management
12. Firm-wise direct payment
13. Invoice
14. Shipping
15. WhatsApp support
16. Phone support
17. Return/refund
18. Warranty
19. Mobile responsive website
20. Hindi/English architecture

============================================================
PHASE 2
============================================================

After Phase 1:
- Bulk Excel ordering
- Retailer credit ledger
- Warehouse management
- Barcode scanning
- Busy integration
- Tally integration
- Zoho integration
- Delivery partner integration
- Loyalty points
- Coupons
- Vehicle registration search
- Retailer quotation tool

============================================================
PHASE 3
============================================================

Later:
- VIN matching
- AI part identification
- Automatic multi-warehouse allocation
- Demand forecasting
- Retailer mobile app
- Supplier portal
- Manufacturer API
- Distributor API

============================================================
EXTERNAL SERVICES
============================================================

Never fake an external integration.

If API/service credentials are unavailable:
- create architecture
- create configuration placeholders
- keep integration disabled
- clearly report what is required

============================================================
DATABASE
============================================================

FIRST inspect the current Drizzle schema.

Do not duplicate existing tables.

Potential entities:
- firms/businesses
- products/parts
- categories
- brands
- vehicles
- compatibility
- product_images
- inventory
- warehouses
- users
- retailers
- retailer_documents
- price_groups
- orders
- order_items
- payments
- addresses
- invoices
- returns
- warranty_claims
- support_tickets
- notifications
- audit_logs

Only add required entities after inspecting the existing schema.

============================================================
EXISTING BURGUNDY THEME
============================================================

The existing SpareLink burgundy theme is already implemented.

KEEP IT.

Do not rebuild the entire visual design.

Preserve:
- SpareLink branding
- Burgundy background
- Existing visual identity
- Existing responsive styling

Improve readability only where required.

Avoid bright green text/backgrounds if they reduce readability or create eye strain.

============================================================
EXISTING SEARCH
============================================================

Existing Typesense search is working.

DO NOT replace it unnecessarily.

Before changes inspect:
- /api/search/parts
- frontend search
- Typesense configuration
- compatibility lookup
- indexing implementation

After changes test:
- M663
- part name
- brand
- vehicle search

Do not break public catalogue search.

============================================================
IMPLEMENTATION PROCESS
============================================================

1. Inspect project.
2. Understand existing architecture.
3. Identify KEEP / UPDATE / REPLACE / NEW / REMOVE.
4. Back up files requiring major changes.
5. Implement Phase 1.
6. Add only required database changes.
7. Run safe database migrations.
8. Run type check.
9. Run lint.
10. Run production build.
11. Fix all errors.
12. Test important APIs.
13. Test search.
14. Test authentication.
15. Test customer flow.
16. Test retailer flow.
17. Test admin flow.
18. Test cart/order.
19. Test firm-wise payment.
20. Test invoice.
21. Test support.
22. Test return/warranty.
23. Test mobile layout.
24. Deploy ONLY after successful validation.

============================================================
DEPLOYMENT
============================================================

Do not deploy broken code.

Only deploy if:
- production build passes
- type check passes where configured
- lint passes where configured
- critical APIs work
- search works
- existing routes compile
- mobile layout is usable

Use the existing Vercel project/configuration.

Do not create a new Vercel project unnecessarily.

============================================================
FINAL REPORT
============================================================

At completion report:

KEEP:
What existing functionality was preserved.

UPDATED:
What existing functionality was modified.

REPLACED:
What was replaced and why.

NEW:
New features/files/components/database/API routes.

REMOVED:
Anything removed.

DATABASE:
Schema changes.

API:
New/modified API routes.

AUTH:
Authentication/authorization changes.

PAYMENT:
Exactly how Ambaji Traders, Hind Motors and India Sales are separated.

MOBILE:
Responsive changes.

SEARCH:
How existing Typesense search was preserved.

SECURITY:
Security changes.

TEST:
Tests performed.

DEPLOY:
Deployment result only if actually successful.

Never claim a feature is implemented if it is only planned.

============================================================
FINAL OBJECTIVE
============================================================

Make the existing SpareLink India application a long-term production-ready:

AUTOMOTIVE SPARE PARTS
+
CUSTOMER E-COMMERCE
+
RETAILER/DEALER B2B
+
INVENTORY
+
ORDER MANAGEMENT
+
FIRM-WISE PAYMENT
+
SUPPORT
+
WARRANTY
+
RETURNS
+
ADMIN
+
REPORTING

platform.

It must be:
- Fast
- Mobile-first
- Responsive
- Secure
- Scalable
- Maintainable
- Production-ready
- SEO-friendly
- Hindi/English ready
- Long-term maintainable

MOST IMPORTANT:
INSPECT FIRST.
KEEP EXISTING WORKING FEATURES.
DO NOT DESTROY EXISTING CODE.
EXTEND WHERE POSSIBLE.
REPLACE ONLY WHEN NECESSARY.
DO NOT DUPLICATE EXISTING SYSTEMS.
DO NOT USE PAID PAYMENT GATEWAYS.
KEEP THE THREE FIRMS SEPARATE.
TEST BEFORE DEPLOYMENT.