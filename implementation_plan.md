# NorthPeak ServiceHub — Master AI Agent Implementation Plan

**Project Title:** NorthPeak ServiceHub: A Web-Based Air Conditioning Sales, Service, Inventory, and Maintenance Management System  
**Target Client:** NorthPeak Aircon & Refrigeration System Trading  
**Architecture:** 3-Tier Web Application (React Frontend + Node.js/Express REST API + MySQL 8.0 3NF Database)

---

## 0. Instructions for the AI Coding Agent

You are an Autonomous Senior Full-Stack Engineer tasked with building **NorthPeak ServiceHub** from scratch. Follow these non-negotiable architectural and domain rules across all phases:

1. **Strictly 5 User Roles (RBAC):**
   - `Customer`
   - `Service Staff`
   - `Technician`
   - `Inventory Staff`
   - `Administrator`
   *(Never create separate roles for Sales Staff, Coordinator, or Manager; their responsibilities are consolidated into `Service Staff` and `Administrator`.)*

2. **5 Core Business Workflows:**
   - **Aircon Sales & Purchase Inquiries** (with Optional Installation Handoff)
   - **Installation**
   - **Troubleshooting and Repair**
   - **Preventive Maintenance and Cleaning**
   - **Relocation or Transfer** (requires `current_location` and `destination_location`)

3. **Non-Negotiable Business Logic Rules:**
   - **Public Reference Numbers:** Auto-generate human-readable tracking codes alongside primary keys:
     - Purchase Inquiry: `INQ-YYYYMMDD-XXXX`
     - Service Request: `SR-YYYYMMDD-XXXX`
     - Quotation: `QT-YYYYMMDD-XXXX`
     - Work Order: `WO-YYYYMMDD-XXXX`
   - **Staff-Recorded Offline Payments:** No online payment gateways. Service Staff manually records payment status (`Unpaid`, `Downpayment Received`, `Fully Paid`) with payment method (`Cash`, `Bank Transfer`, `GCash/Maya Receipt`) and reference number.
   - **Quotation Downpayment Lock & Revision Rule:**
     - Quotations can be `Temporary` (initial estimate) or `Finalized`.
     - Line items in `quotation_items` snapshot `quoted_price` so future catalog changes never alter historical quotes.
     - **Pre-Downpayment (`Unpaid`):** Customer can `Approve`, `Request Revision`, or `Cancel/Reject` (cancelling rejects the quote and marks the linked Service Request as `Cancelled`).
     - **Post-Downpayment Lock (`Downpayment Received` or `Fully Paid`):** Cancellation/Rejection is **strictly blocked** in both UI and API (`HTTP 400`). If pricing/scope adjustments are needed, only a **Quotation Revision** is allowed, which creates a new quotation record with $\text{revision\_no} = \text{previous\_revision\_no} + 1$ and links `parent_quotation_id`, while marking the previous revision as `Superseded`.
   - **Schedule Conflict Detection:** Before assigning a technician to a schedule/work order, query existing active assignments for that `technician_id` where:
     $$\text{new\_start} < \text{existing\_end} \quad \text{AND} \quad \text{new\_end} > \text{existing\_start}$$
     If a match exists, block assignment and return `HTTP 409 Conflict`.
   - **Inventory Math & Work-Order Linkage:**
     - Available stock is defined as:
       $$\text{Available\_Stock} = \text{total\_stock\_qty} - \text{reserved\_qty}$$
     - `Reservation` increments `reserved_qty` (requires $\text{Available\_Stock} \ge \text{qty}$).
     - `Issue` (when consumed on a Work Order) decrements both `total_stock_qty` and `reserved_qty`.
     - `Return` decrements `reserved_qty` (if unissued) or increments `total_stock_qty` (if already issued).
     - `Adjustment` directly modifies `total_stock_qty` with mandatory remarks.
   - **Work Order Completion & Auto-PM Date Calculation:**
     - Marking a Work Order `Completed` requires diagnostic notes, actions taken, and remarks.
     - Inside a single ACID database transaction: update `work_orders.status = 'Completed'`, insert a record into `service_history`, and update the equipment's `last_service_date` and `next_pm_date` by adding `maintenance_interval_months` (default $3$ or $6$ months) to the completion date.

---

## 1. Repository & Directory Structure

Create a monorepo structure as follows:

```text
northpeak-servicehub/
├── database/
│   ├── schema_3nf.sql          # Full DDL for all 15 normalized tables
│   └── seed.sql                # Demo accounts for all 5 roles + sample catalog, parts, and tickets
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── uploads/
│   │   └── evidence/           # Diagnostic photos uploaded by technicians
│   └── src/
│       ├── index.js            # Express app entry point
│       ├── config/
│       │   └── db.js           # mysql2/promise connection pool
│       ├── middleware/
│       │   ├── authMiddleware.js   # JWT verification & 5-role RBAC guard
│       │   └── uploadMiddleware.js # Multer config (JPG/PNG <= 5MB)
│       ├── utils/
│       │   ├── refGenerator.js     # Generates INQ-, SR-, QT-, WO- codes
│       │   ├── auditLogger.js      # Writes immutable logs to audit_logs
│       │   ├── notifyHelper.js     # Creates in-app notifications + optional Nodemailer SMTP
│       │   └── pmCalculator.js     # Leap-year safe date math for next_pm_date
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── userController.js
│       │   ├── customerEquipmentController.js
│       │   ├── productInquiryController.js
│       │   ├── serviceRequestController.js
│       │   ├── quotationController.js
│       │   ├── workOrderController.js
│       │   ├── inventoryController.js
│       │   └── reportDashboardController.js
│       └── routes/
│           └── apiRoutes.js
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── services/
        │   └── api.js          # Axios instance with JWT interceptor
        ├── components/
        │   ├── Layout.jsx      # Role-based sidebar, topbar, notifications bell
        │   ├── ProtectedRoute.jsx
        │   ├── StatusBadge.jsx
        │   └── QRModal.jsx     # Displays printable QR sticker for AC units
        └── pages/
            ├── auth/
            │   ├── LoginPage.jsx
            │   └── RegisterPage.jsx
            ├── customer/
            │   ├── CustomerDashboard.jsx
            │   ├── ProductCatalogInquiry.jsx
            │   ├── MyServiceRequests.jsx
            │   ├── MyQuotations.jsx
            │   └── MyEquipmentHistory.jsx
            ├── staff/
            │   ├── StaffDashboard.jsx
            │   ├── ManageInquiries.jsx
            │   ├── ManageServiceRequests.jsx
            │   ├── QuotationBuilder.jsx
            │   ├── ScheduleDispatch.jsx
            │   ├── CustomerEquipmentManager.jsx
            │   └── ProductCatalogManager.jsx
            ├── technician/
            │   ├── TechDashboard.jsx
            │   ├── QRScannerLookup.jsx
            │   └── WorkOrderExecution.jsx
            ├── inventory/
            │   ├── InventoryDashboard.jsx
            │   ├── SparePartsCatalog.jsx
            │   └── WorkOrderPartsConsole.jsx
            └── admin/
                ├── AdminDashboard.jsx
                ├── UserRoleManagement.jsx
                ├── OperationalReports.jsx
                └── AuditTrailViewer.jsx
```

---

## PHASE 1: Database Foundation & 3NF Schema (`database/`)

### Step 1.1: Create `database/schema_3nf.sql`
Implement the following 15 tables in MySQL 8.0 (`InnoDB`):

```sql
CREATE DATABASE IF NOT EXISTS northpeak_servicehub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE northpeak_servicehub;

-- 1. users (All 5 Roles)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Customer', 'Service Staff', 'Technician', 'Inventory Staff', 'Administrator') NOT NULL DEFAULT 'Customer',
    specialization VARCHAR(100) NULL COMMENT 'For Technicians: e.g., Split-Type, Commercial, Inverter',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. customers (Extended profile linked 1:1 or 1:N with users)
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    customer_type ENUM('Residential', 'Commercial') NOT NULL DEFAULT 'Residential',
    company_name VARCHAR(150) NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    billing_address TEXT NOT NULL,
    service_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 3. products (Brand-new Aircon Catalog for Sales Inquiries & Quoting)
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    sku_code VARCHAR(50) NOT NULL UNIQUE,
    brand VARCHAR(80) NOT NULL,
    model_name VARCHAR(120) NOT NULL,
    ac_type ENUM('Window Type', 'Split Type', 'Floor Mounted', 'Cassette Type', 'Portable') NOT NULL,
    horsepower VARCHAR(20) NOT NULL COMMENT 'e.g., 1.0 HP, 1.5 HP, 2.0 HP, 2.5 HP',
    inverter_type ENUM('Inverter', 'Non-Inverter') NOT NULL DEFAULT 'Inverter',
    unit_price DECIMAL(12,2) NOT NULL,
    stock_qty INT NOT NULL DEFAULT 0,
    warranty_months INT NOT NULL DEFAULT 12,
    specs_summary TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. equipment (Customer-owned registered AC units with QR Token)
CREATE TABLE equipment (
    equipment_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NULL,
    qr_token VARCHAR(64) NOT NULL UNIQUE COMMENT 'Unique token encoded in QR sticker',
    brand VARCHAR(80) NOT NULL,
    model VARCHAR(120) NOT NULL,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    ac_type VARCHAR(50) NOT NULL,
    capacity_hp VARCHAR(20) NOT NULL,
    installed_location VARCHAR(255) NOT NULL,
    installation_date DATE NULL,
    warranty_expiry DATE NULL,
    maintenance_interval_months INT NOT NULL DEFAULT 6,
    last_service_date DATE NULL,
    next_pm_date DATE NULL,
    status ENUM('Active', 'Under Repair', 'Decommissioned') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

-- 5. purchase_inquiries (FR-005: Aircon Sales & Optional Installation Handoff)
CREATE TABLE purchase_inquiries (
    inquiry_id INT AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(30) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_snapshot DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    request_installation BOOLEAN NOT NULL DEFAULT FALSE,
    installation_address TEXT NULL,
    preferred_date DATE NULL,
    payment_status ENUM('Unpaid', 'Downpayment Received', 'Fully Paid') NOT NULL DEFAULT 'Unpaid',
    inquiry_status ENUM('Pending Review', 'Stock Confirmed', 'Awaiting Payment', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending Review',
    linked_service_request_id INT NULL COMMENT 'Populated if request_installation = TRUE',
    staff_remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- 6. service_requests (FR-006: Installation, Repair, PM/Cleaning, Relocation)
CREATE TABLE service_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    reference_no VARCHAR(30) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    equipment_id INT NULL COMMENT 'Nullable for brand-new installations',
    service_type ENUM('Installation', 'Repair and Troubleshooting', 'Preventive Maintenance and Cleaning', 'Relocation or Transfer') NOT NULL,
    issue_description TEXT NOT NULL,
    current_location TEXT NOT NULL,
    destination_location TEXT NULL COMMENT 'Required when service_type = Relocation or Transfer',
    preferred_date DATE NOT NULL,
    preferred_time_slot VARCHAR(50) NOT NULL DEFAULT 'Morning (8AM-12PM)',
    priority ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
    requires_quotation BOOLEAN NOT NULL DEFAULT TRUE,
    payment_status ENUM('Unpaid', 'Downpayment Received', 'Fully Paid') NOT NULL DEFAULT 'Unpaid',
    status ENUM('Submitted', 'Under Review', 'Quoted', 'Approved', 'Scheduled', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE SET NULL
);

-- 7. quotations (FR-007: Temporary & Finalized Quotes + Revision History)
CREATE TABLE quotations (
    quotation_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_no VARCHAR(30) NOT NULL UNIQUE,
    request_id INT NOT NULL,
    revision_no INT NOT NULL DEFAULT 1,
    parent_quotation_id INT NULL,
    quote_stage ENUM('Temporary', 'Finalized') NOT NULL DEFAULT 'Temporary',
    labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    parts_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    downpayment_required DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('Pending Customer Review', 'Approved', 'Revision Requested', 'Rejected/Cancelled', 'Superseded') NOT NULL DEFAULT 'Pending Customer Review',
    customer_decision_notes TEXT NULL,
    valid_until DATE NOT NULL,
    prepared_by INT NOT NULL,
    decided_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_quotation_id) REFERENCES quotations(quotation_id) ON DELETE SET NULL,
    FOREIGN KEY (prepared_by) REFERENCES users(user_id)
);

-- 8. quotation_items (Preserves immutable historical unit prices)
CREATE TABLE quotation_items (
    quotation_item_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    item_type ENUM('Labor/Service', 'Spare Part', 'Aircon Unit', 'Material/Fee') NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    quoted_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE
);

-- 9. inventory_items (Spare Parts & Consumables Warehouse)
CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    sku_code VARCHAR(50) NOT NULL UNIQUE,
    part_name VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL COMMENT 'e.g., Compressor, Capacitor, Refrigerant/Freon, Fan Motor, Copper Tube',
    unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'pcs',
    unit_price DECIMAL(12,2) NOT NULL,
    total_stock_qty INT NOT NULL DEFAULT 0,
    reserved_qty INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. work_orders (FR-008: Conflict-Checked Technician Dispatch & Execution)
CREATE TABLE work_orders (
    work_order_id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_no VARCHAR(30) NOT NULL UNIQUE,
    request_id INT NOT NULL,
    quotation_id INT NULL,
    technician_id INT NOT NULL,
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME NOT NULL,
    diagnosis_notes TEXT NULL,
    work_performed TEXT NULL,
    technician_remarks TEXT NULL,
    evidence_photo_url VARCHAR(255) NULL,
    status ENUM('Scheduled', 'En Route', 'In Progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Scheduled',
    completed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE SET NULL,
    FOREIGN KEY (technician_id) REFERENCES users(user_id)
);

-- 11. inventory_transactions (FR-009: Work-Order-Linked Stock Movements)
CREATE TABLE inventory_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    work_order_id INT NULL,
    tx_type ENUM('Reservation', 'Issue', 'Return', 'Adjustment') NOT NULL,
    quantity INT NOT NULL,
    performed_by INT NOT NULL,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory_items(item_id),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(work_order_id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by) REFERENCES users(user_id)
);

-- 12. payments (Staff-Recorded Offline Payments & Downpayments)
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    inquiry_id INT NULL,
    request_id INT NULL,
    amount_paid DECIMAL(12,2) NOT NULL,
    payment_type ENUM('Downpayment', 'Full Payment', 'Balance Settlement') NOT NULL,
    payment_method ENUM('Cash', 'Bank Transfer', 'GCash / Maya Receipt', 'Check') NOT NULL,
    reference_receipt_no VARCHAR(100) NULL,
    recorded_by INT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inquiry_id) REFERENCES purchase_inquiries(inquiry_id) ON DELETE SET NULL,
    FOREIGN KEY (request_id) REFERENCES service_requests(request_id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id)
);

-- 13. service_history (Chronological Equipment Maintenance & Repair Ledger)
CREATE TABLE service_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    equipment_id INT NOT NULL,
    work_order_id INT NOT NULL,
    service_type VARCHAR(80) NOT NULL,
    diagnosis_summary TEXT NOT NULL,
    actions_taken TEXT NOT NULL,
    parts_replaced_summary TEXT NULL,
    technician_name VARCHAR(120) NOT NULL,
    service_date DATE NOT NULL,
    computed_next_pm_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(work_order_id) ON DELETE CASCADE
);

-- 14. notifications (In-App & Email Alert Log)
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 15. audit_logs (Immutable Security & Transaction Audit Trail)
CREATE TABLE audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_role VARCHAR(50) NULL,
    action VARCHAR(120) NOT NULL,
    entity_name VARCHAR(80) NOT NULL,
    entity_id VARCHAR(50) NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 1.2: Create `database/seed.sql`
Create seed records with pre-hashed bcrypt passwords (e.g., `Password123!`) for all 5 roles so the defense panel can test every role immediately:
- `admin@northpeak.ph` (`Administrator`)
- `staff@northpeak.ph` (`Service Staff`)
- `tech1@northpeak.ph` & `tech2@northpeak.ph` (`Technician`)
- `inventory@northpeak.ph` (`Inventory Staff`)
- `customer1@gmail.com` & `customer2@gmail.com` (`Customer`)
- Seed 5 aircon units in `products` (Daikin, Carrier, Panasonic, Koppel, LG), 4 registered customer AC units in `equipment` (with pre-generated `qr_token` values like `NP-QR-2026-0001`), and 8 spare parts in `inventory_items` (including 1 low-stock item where $\text{total\_stock\_qty} \le \text{reorder\_level}$ to demonstrate the low-stock alert widget).

---

## PHASE 2: Backend Core, Security & Utilities (`server/`)

### Step 2.1: Initialize Backend Packages
In `server/`, install:
```bash
npm init -y
npm install express cors dotenv mysql2 bcryptjs jsonwebtoken multer nodemailer qrcode
```

### Step 2.2: Implement Security & RBAC Middleware (`src/middleware/authMiddleware.js`)
- `verifyToken`: Extracts Bearer JWT from `Authorization` header, verifies signature, attaches `req.user = { user_id, role, customer_id, full_name }`.
- `requireRoles(...allowedRoles)`: Returns `403 Forbidden` if `!allowedRoles.includes(req.user.role)`.
- **Tenant Isolation Rule:** Whenever `req.user.role === 'Customer'`, force all SQL queries on `purchase_inquiries`, `service_requests`, `quotations`, and `equipment` to filter by `WHERE customer_id = req.user.customer_id`.

### Step 2.3: Implement Utilities (`src/utils/`)
- `refGenerator.js`: Generates unique reference numbers (`INQ-20261111-1042`, `SR-20261111-8831`, etc.).
- `auditLogger.js`: `logAction(pool, req.user, action, entityName, entityId, details)` inserts into `audit_logs`.
- `pmCalculator.js`: Takes `completionDate` and `intervalMonths` (default $6$) and safely computes `next_pm_date` formatted as `YYYY-MM-DD`.

---

## PHASE 3: Backend REST API Controllers (`server/src/controllers/`)

Build the following endpoints and wrap multi-table mutations in `await connection.beginTransaction()` / `await connection.commit()`:

### 1. Auth & User Management (`authController.js`, `userController.js`)
- `POST /api/auth/login` — Validates email/password (`bcrypt.compare`), checks `is_active`, logs audit event, returns `{ token, user }`. *(Covers TC-001, TC-002)*
- `POST /api/auth/register` — Creates a `Customer` account in `users` AND a linked profile in `customers` inside a transaction. *(Covers TC-003)*
- `GET /api/users` & `POST /api/users` & `PATCH /api/users/:id` — `Administrator` only; creates staff/technician/inventory accounts and toggles active status. *(Covers FR-003)*

### 2. Customer, Product Catalog & QR Equipment (`customerEquipmentController.js`)
- `GET /api/products` (Public/All) & `POST /api/products`, `PUT /api/products/:id` (`Service Staff`, `Administrator`).
- `GET /api/equipment` — Filtered by `customer_id` for Customers; full list with search/filter for Staff/Tech/Admin.
- `POST /api/equipment` (`Service Staff`, `Administrator`) — Registers an AC unit and generates a unique `qr_token` (e.g., `NP-QR-${Date.now()}`).
- `GET /api/equipment/qr/:token` (`Technician`, `Service Staff`, `Customer`, `Administrator`) — Looks up equipment by `qr_token`, enforces Customer tenant isolation (Customer A cannot scan Customer B's QR code), and returns unit specs + chronological `service_history`. *(Covers FR-004, TC-004, TC-014)*

### 3. Purchase Inquiries & Optional Installation Handoff (`productInquiryController.js`)
- `POST /api/inquiries` (`Customer`) — Submits an aircon purchase inquiry (`product_id`, `quantity`, `request_installation`, `installation_address`, `preferred_date`). Snapshots `unit_price` from `products`.
- `PATCH /api/inquiries/:id/process` (`Service Staff`) — Updates inquiry status (`Stock Confirmed`, `Completed`), records offline payment status (`Unpaid`, `Downpayment Received`, `Fully Paid`), and **if `request_installation === true` and no linked service request exists yet**, automatically creates a linked `Installation` record in `service_requests` with its own `SR-YYYYMMDD-XXXX` reference number! *(Covers FR-005, TC-005)*

### 4. Multi-Type Service Requests (`serviceRequestController.js`)
- `POST /api/requests` (`Customer`, `Service Staff`) — Supports `Installation`, `Repair and Troubleshooting`, `Preventive Maintenance and Cleaning`, and `Relocation or Transfer`.
  - Validation: If `service_type === 'Relocation or Transfer'`, require `destination_location` (`HTTP 400` if missing). *(Covers FR-006, TC-006)*
- `GET /api/requests` — Supports filtering by `status`, `service_type`, and search by `reference_no`.
- `PATCH /api/requests/:id/payment` (`Service Staff`) — Records offline payment in `payments` and updates `service_requests.payment_status` (`Unpaid`, `Downpayment Received`, `Fully Paid`).

### 5. Conditional Quotations, Downpayment Lock & Revisions (`quotationController.js`)
- `POST /api/quotations` (`Service Staff`) — Creates a `Temporary` or `Finalized` quotation with line items in `quotation_items`. Updates `service_requests.status = 'Quoted'`.
- `POST /api/quotations/:id/decision` (`Customer`, `Service Staff`) — Handles customer decisions:
  - `decision === 'Approve'`: Marks quotation `Approved` and service request `Approved`.
  - `decision === 'Cancel'`: Checks `service_requests.payment_status`.
    - If `payment_status === 'Unpaid'`, sets quotation to `Rejected/Cancelled` and service request to `Cancelled`. *(Covers TC-007)*
    - If `payment_status !== 'Unpaid'` (`Downpayment Received` or `Fully Paid`), **reject the request with `HTTP 400`**: *"Cancellation is locked because a downpayment has already been recorded. Please use Quotation Revision."* *(Covers TC-008)*
  - `decision === 'Request Revision'`: Marks status as `Revision Requested` with customer notes.
- `POST /api/quotations/:id/revise` (`Service Staff`) — Fetches existing quotation, sets its status to `Superseded`, and inserts a new quotation row with `revision_no = old.revision_no + 1` and `parent_quotation_id = old.quotation_id`, along with updated `quotation_items`. *(Covers FR-007, TC-008)*

### 6. Conflict-Checked Scheduling & Work Orders (`workOrderController.js`)
- `POST /api/work-orders` (`Service Staff`) — Assigns `technician_id`, `scheduled_start`, `scheduled_end`.
  - **Conflict Check Query:**
    ```sql
    SELECT work_order_no, scheduled_start, scheduled_end
    FROM work_orders
    WHERE technician_id = ?
      AND status IN ('Scheduled', 'En Route', 'In Progress')
      AND (? < scheduled_end AND ? > scheduled_start)
    ```
  - If rows $> 0$, return `409 Conflict` with details of the overlapping work order. *(Covers FR-008, TC-009)*
- `PATCH /api/work-orders/:id/complete` (`Technician`) — Accepts `diagnosis_notes`, `work_performed`, `technician_remarks`, and optional photo upload (`req.file`).
  - Consumes any `Reserved` inventory items linked to this `work_order_id` (converts to `Issue` or deducts stock).
  - Inserts into `service_history`.
  - Updates `equipment.last_service_date = CURDATE()` and `equipment.next_pm_date = DATE_ADD(CURDATE(), INTERVAL maintenance_interval_months MONTH)`. *(Covers FR-008, TC-010, TC-011)*

### 7. Work-Order-Linked Inventory Transactions (`inventoryController.js`)
- `GET /api/inventory` — Returns all spare parts including calculated `available_stock = total_stock_qty - reserved_qty` and `is_low_stock = (total_stock_qty - reserved_qty) <= reorder_level`.
- `POST /api/inventory/transactions` (`Inventory Staff`, `Technician`) — Executes inside a DB transaction:
  - `Reservation`: Checks `available_stock >= quantity`, increments `reserved_qty`.
  - `Issue`: Decrements `total_stock_qty` and (if previously reserved for that WO) `reserved_qty`.
  - `Return`: Restores stock or releases reservation.
  - `Adjustment`: Updates `total_stock_qty` and logs to `audit_logs`. *(Covers FR-009, TC-012)*

### 8. Dashboards & Reports (`reportDashboardController.js`)
- `GET /api/dashboard/summary` — Role-specific KPI cards + chart datasets + upcoming PM schedules + low-stock alerts.
- `GET /api/reports` (`Administrator`, `Service Staff`, `Inventory Staff`) — Filterable by date range and category (`inquiries`, `requests`, `quotations`, `work_orders`, `inventory`, `payments`). *(Covers FR-010, FR-011, TC-013)*

---

## PHASE 4: Frontend Setup & Role-Based Shell (`client/`)

### Step 4.1: Initialize React + Vite + Tailwind CSS
```bash
npm create vite@latest client -- --template react
cd client
npm install axios react-router-dom lucide-react qrcode.react html5-qrcode
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 4.2: Design System & Navigation Shell (`Layout.jsx`)
- Use a clean, industrial HVAC palette: Deep Navy (`#0F172A`), Arctic Blue (`#0284C7`), Emerald (`#10B981` for approved/completed), Amber (`#F59E0B` for pending/revision), Rose (`#EF4444` for conflict/locked).
- Include a **Quick Demo Role Switcher** banner on the Login screen so during the defense presentation you can log in as any of the 5 roles (`Customer`, `Service Staff`, `Technician`, `Inventory Staff`, `Administrator`) with 1 click!

---

## PHASE 5: Frontend Role Modules & Interactive Screens (`client/src/pages/`)

1. **Customer Portal (`pages/customer/`):**
   - **Aircon Catalog & Purchase Inquiry:** Browse units, click *"Inquire to Purchase"*, toggle **"Include Optional Installation"** (which reveals installation address & preferred date), and view inquiry status & payment badge.
   - **Submit Service Request:** Choose from the 4 service types. Selecting **"Relocation or Transfer"** dynamically reveals the mandatory **Destination Location** input field.
   - **Quotations & Revision Decisions:** View itemized breakdown and revision history badge (`Rev 1`, `Rev 2`). If `payment_status === 'Unpaid'`, show `Approve`, `Request Revision`, and `Cancel Request` buttons. If `payment_status === 'Downpayment Received'`, disable `Cancel` with a clear lock tooltip: *"Downpayment recorded — Cancellation locked. You may request a quotation revision."*
   - **My Equipment & Service History:** View registered AC units, open printable QR code modal, and see `Next Preventive Maintenance Due Date`.

2. **Service Staff Portal (`pages/staff/`):**
   - **Purchase Inquiry Triage:** Confirm stock, record offline payment (`Unpaid` $\rightarrow$ `Downpayment Received` $\rightarrow$ `Fully Paid`), and see automatic creation of linked Installation Service Request.
   - **Service Request & Quotation Builder:** Create `Temporary` or `Finalized` quotes, add catalog/part/labor line items, or create a **New Revision (`Rev + 1`)** while preserving superseded revisions in a collapsible history table.
   - **Conflict-Aware Dispatch Calendar:** Select technician, start/end datetime, and see real-time conflict warning if overlapping with another job.

3. **Technician Mobile-Responsive Portal (`pages/technician/`):**
   - **QR Code Equipment Lookup:** Scan QR via camera (`html5-qrcode`) or enter/click a QR token (`NP-QR-2026-0001`) to immediately pull up AC unit specs, warranty status, and full repair/cleaning history.
   - **Work Order Execution Form:** Enter diagnosis notes, work performed, remarks, upload diagnostic photo, and click **Complete Work Order** (which triggers auto-PM date calculation).

4. **Inventory Staff Portal (`pages/inventory/`):**
   - **Spare Parts Warehouse Table:** Shows `Total Stock`, `Reserved`, `Available Stock` ($\text{Total} - \text{Reserved}$), and red `Low Stock` badges.
   - **Work Order Parts Console:** Execute `Reservation`, `Issue`, `Return`, and `Adjustment` transactions linked directly to active Work Orders.

5. **Administrator Portal (`pages/admin/`):**
   - **Executive KPI Dashboard:** Cards for Active Requests, Pending Quotes, Active Work Orders, Low-Stock Parts, and Upcoming PM Alerts.
   - **User & RBAC Manager:** Create users, assign any of the 5 roles, activate/deactivate accounts.
   - **Operational Report Generator:** Filter by date & module with clean Print/CSV export.
   - **Immutable Audit Trail Viewer:** Chronological table of security and transactional events.

---

## PHASE 6: Defense Verification Matrix (`TC-001` to `TC-014`)

Before finishing, the AI Coding Agent must verify that all 14 Test Cases from Section 17 of the documentation pass:

| Test Case ID | Scenario to Verify | Expected System Behavior |
| :--- | :--- | :--- |
| **TC-001** | Valid Login across 5 Roles | Redirects user to their specific role dashboard with valid JWT. |
| **TC-002** | Invalid Login Credentials | Rejects login with `401 Unauthorized` and clear error message. |
| **TC-003** | Customer Self-Registration | Creates linked `users` and `customers` records. |
| **TC-004** | QR Code Equipment Lookup | Scanning/entering `NP-QR-2026-0001` displays AC specs, warranty, and past service history. |
| **TC-005** | Purchase Inquiry + Optional Installation | Submitting inquiry with `request_installation = true` and confirming it auto-creates a linked `Installation` Service Request (`SR-...`). |
| **TC-006** | Relocation Service Request Validation | Selecting `Relocation or Transfer` requires both `current_location` and `destination_location`. |
| **TC-007** | Pre-Downpayment Quotation Cancellation | When `payment_status = 'Unpaid'`, customer can cancel/reject the finalized quote, cancelling the request. |
| **TC-008** | Post-Downpayment Lock & Revision Loop | Once `Downpayment Received` is recorded, cancellation is blocked (`400`) and staff can issue `Revision #2` (`parent_quotation_id` linked). |
| **TC-009** | Technician Schedule Conflict Check | Assigning a technician to an overlapping date/time returns `409 Conflict` and prevents double-booking. |
| **TC-010** | Work Order Field Completion & Photo Upload | Technician logs diagnosis, work performed, remarks, and photo; status becomes `Completed`. |
| **TC-011** | Automated Preventive Maintenance Calculation | Completing a Work Order writes to `service_history` and sets `next_pm_date = completion_date + maintenance_interval_months`. |
| **TC-012** | Work-Order-Linked Inventory Math | Reserving 2 capacitors increases `reserved_qty` by 2 and reduces `Available Stock` by 2; Issuing deducts from `total_stock_qty`. |
| **TC-013** | Operational Reports & Dashboard | Admin filters and exports reports for Inquiries, Requests, Quotations, Work Orders, Payments, and Inventory. |
| **TC-014** | RBAC & Multi-Tenant Security Isolation | Customer A cannot view Customer B's requests/QR records (`403 Forbidden`); non-Admins cannot access `/api/users`. |

---