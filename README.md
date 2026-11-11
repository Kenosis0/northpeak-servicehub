# NorthPeak ServiceHub

**A Web-Based Air Conditioning Sales, Service, Inventory, and Maintenance Management System**  
**Target Client:** NorthPeak Aircon & Refrigeration System Trading  
**Architecture:** 3-Tier Web Application (React + Vite + Tailwind CSS Frontend • Node.js/Express REST API • MySQL 8.0 3NF Database)

---

## 1. System Overview & Core Domain Rules

NorthPeak ServiceHub unifies retail aircon purchase inquiries, multi-type field service operations, conflict-checked technician scheduling, QR-tagged equipment maintenance tracking, and work-order-linked spare parts inventory under **strictly 5 RBAC user roles**:

1. **`Customer`** — Browses the aircon catalog, submits purchase inquiries (with optional installation handoff), books multi-type service requests, approves/revises/cancels quotations, and views QR-tagged AC units and preventive maintenance (PM) due dates.
2. **`Service Staff`** — Triages purchase inquiries, records offline payments (`Cash`, `Bank Transfer`, `GCash / Maya Receipt`, `Check`), builds `Temporary` or `Finalized` quotations and revisions (`Rev + 1`), registers customer AC units with printable QR codes, and dispatches technicians with real-time schedule conflict detection.
3. **`Technician`** — Scans or enters equipment QR tokens (`NP-QR-YYYY-XXXX`) to inspect unit specs and repair history, updates job dispatch status (`En Route`, `In Progress`), uploads diagnostic evidence photos, and completes work orders (which atomically updates `service_history` and computes `next_pm_date`).
4. **`Inventory Staff`** — Manages spare parts and consumables (`Available Stock = Total Stock − Reserved`), monitors low-stock alerts, and executes work-order-linked `Reservation`, `Issue`, `Return`, and `Adjustment` stock movements.
5. **`Administrator`** — Accesses the executive KPI dashboard, manages users and the 5 RBAC roles, exports operational reports (CSV / Print), and audits the immutable security and transaction trail.

---

## 2. Quick Demo Accounts (1-Click Login Enabled)

All seeded demo accounts use the password: **`Password123!`**

| Role | Full Name | Email | Password | Key Test Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | Roberto Mendoza | `admin@northpeak.ph` | `Password123!` | Executive KPIs, `/api/users` RBAC (`TC-014`), Reports (`TC-013`), Audit Trail |
| **Service Staff** | Camille Villanueva | `staff@northpeak.ph` | `Password123!` | Inquiry Handoff (`TC-005`), Quote Revision (`TC-008`), Conflict Check (`TC-009`) |
| **Technician** | Arnel Bautista | `tech1@northpeak.ph` | `Password123!` | QR Lookup (`TC-004`), Field Completion & Auto-PM (`TC-010`, `TC-011`) |
| **Inventory Staff** | Liza Dizon | `inventory@northpeak.ph` | `Password123!` | Low-Stock Alerts & Work-Order Inventory Math (`TC-012`) |
| **Customer (A)** | Marco Dela Cruz | `customer1@gmail.com` | `Password123!` | Unpaid Quote Cancel (`TC-007`), Relocation Request (`TC-006`), Own QR (`NP-QR-2026-0001`) |
| **Customer (B)** | Patricia Reyes | `customer2@gmail.com` | `Password123!` | Downpayment Lock (`TC-008`), Tenant Isolation (`TC-014` on `NP-QR-2026-0003`) |

---

## 3. Repository Structure

```text
northpeak-servicehub/
├── database/
│   ├── schema_3nf.sql          # Full DDL for all 15 3NF tables (MySQL 8.0 / InnoDB)
│   └── seed.sql                # Pre-hashed demo accounts, products, QR equipment, parts & tickets
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── uploads/evidence/       # Technician diagnostic photo uploads
│   └── src/
│       ├── index.js            # Express REST API entry point (Port 5000)
│       ├── config/db.js        # mysql2/promise connection pool
│       ├── middleware/         # JWT verification, 5-role RBAC guard & Multer upload middleware
│       ├── utils/              # Ref generator, audit logger, notifications, PM date calculator & TC matrix verifier
│       ├── controllers/        # 9 domain controllers enforcing ACID transactions
│       └── routes/apiRoutes.js # Unified REST API routes
└── client/
    ├── package.json
    ├── vite.config.js          # Vite dev server (Port 5173) proxying /api and /uploads to :5000
    └── src/
        ├── context/AuthContext.jsx
        ├── services/api.js
        ├── components/         # Layout, ProtectedRoute, StatusBadge, QRModal
        └── pages/              # Complete interactive screens for all 5 roles
```

---

## 4. Startup Instructions

### Step 1: Configure & Seed MySQL 8.0 Database

Ensure MySQL 8.0 is running on `127.0.0.1:3306`. Copy `server/.env.example` to `server/.env` and update `DB_USER` / `DB_PASSWORD` if needed:

```bash
cd server
cp .env.example .env
npm install
npm run seed
```

*(Alternatively, import `database/schema_3nf.sql` followed by `database/seed.sql` in MySQL Workbench, phpMyAdmin, or via the `mysql` CLI:)*

```bash
mysql -u root -p < database/schema_3nf.sql
mysql -u root -p < database/seed.sql
```

### Step 2: Start the Express Backend API (`http://localhost:5000`)

```bash
cd server
npm run dev
```

### Step 3: Start the React + Vite Frontend (`http://localhost:5173`)

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser and use the **1-Click Defense Demo Role Switcher** on the Login screen (or in the left sidebar footer) to switch across all 5 roles immediately.

---

## 5. Automated Defense Verification Matrix (`TC-001` to `TC-014`)

To run the automated controller and business-rule verification suite across all 14 test cases:

```bash
npm --prefix server run verify:matrix
```

| Test Case | Scenario | Verified Behavior |
| :--- | :--- | :--- |
| **TC-001** | Valid Login across 5 Roles | Authenticates all 5 roles and returns signed JWT + role dashboard redirect. |
| **TC-002** | Invalid Login Credentials | Rejects invalid credentials with `401 Unauthorized` and logs security event. |
| **TC-003** | Customer Self-Registration | Atomically creates linked `users` (`Customer`) and `customers` records. |
| **TC-004** | QR Code Equipment Lookup | Looks up `NP-QR-2026-0001` and returns unit specs, warranty, and `service_history`. |
| **TC-005** | Purchase Inquiry + Optional Installation | Confirming an inquiry with `request_installation = true` auto-creates `SR-YYYYMMDD-XXXX`. |
| **TC-006** | Relocation Service Request Validation | Selecting `Relocation or Transfer` requires `destination_location` (`400 Bad Request` if omitted). |
| **TC-007** | Pre-Downpayment Quotation Cancellation | When `payment_status = 'Unpaid'`, customer cancellation marks quote `Rejected/Cancelled` and request `Cancelled`. |
| **TC-008** | Post-Downpayment Lock & Revision Loop | When `payment_status != 'Unpaid'`, cancellation is blocked (`400`) and staff issues `Revision #2` (`parent_quotation_id` linked, `Rev #1` marked `Superseded`). |
| **TC-009** | Technician Schedule Conflict Check | Overlapping technician schedule (`new_start < existing_end AND new_end > existing_start`) returns `409 Conflict`. |
| **TC-010** | Work Order Field Completion & Photo Upload | Technician submits diagnosis, actions taken, remarks, and photo; status becomes `Completed`. |
| **TC-011** | Automated Preventive Maintenance Calculation | Completing a Work Order inserts into `service_history` and sets `next_pm_date = completion_date + maintenance_interval_months`. |
| **TC-012** | Work-Order-Linked Inventory Math | `Reservation` increments `reserved_qty` and reduces `Available Stock`; `Issue` deducts `total_stock_qty` and releases `reserved_qty`. |
| **TC-013** | Operational Reports & Dashboard | Filters and exports reports for `inquiries`, `requests`, `quotations`, `work_orders`, `inventory`, and `payments`. |
| **TC-014** | RBAC & Multi-Tenant Security Isolation | Customer A cannot access Customer B's QR/requests (`403 Forbidden`); non-Admins are blocked from `/api/users` (`403 Forbidden`). |
