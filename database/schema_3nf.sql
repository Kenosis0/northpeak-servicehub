-- ============================================================================
-- NorthPeak ServiceHub — 3NF Normalized Database Schema (MySQL 8.0 / InnoDB)
-- Client: NorthPeak Aircon & Refrigeration System Trading
-- ============================================================================

CREATE DATABASE IF NOT EXISTS northpeak_servicehub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE northpeak_servicehub;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS service_history;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS work_orders;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS quotation_items;
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS purchase_inquiries;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_brand (brand),
    INDEX idx_products_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL,
    INDEX idx_equipment_customer (customer_id),
    INDEX idx_equipment_next_pm (next_pm_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_inquiries_customer (customer_id),
    INDEX idx_inquiries_status (inquiry_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE SET NULL,
    INDEX idx_requests_customer (customer_id),
    INDEX idx_requests_status (status),
    INDEX idx_requests_type (service_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (prepared_by) REFERENCES users(user_id),
    INDEX idx_quotations_request (request_id),
    INDEX idx_quotations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. quotation_items (Preserves immutable historical unit prices)
CREATE TABLE quotation_items (
    quotation_item_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    item_type ENUM('Labor/Service', 'Spare Part', 'Aircon Unit', 'Material/Fee') NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    quoted_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
    INDEX idx_quotation_items_quote (quotation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inventory_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (technician_id) REFERENCES users(user_id),
    INDEX idx_work_orders_tech_schedule (technician_id, status, scheduled_start, scheduled_end),
    INDEX idx_work_orders_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (performed_by) REFERENCES users(user_id),
    INDEX idx_inv_tx_item (item_id),
    INDEX idx_inv_tx_wo (work_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (recorded_by) REFERENCES users(user_id),
    INDEX idx_payments_inquiry (inquiry_id),
    INDEX idx_payments_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (work_order_id) REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    INDEX idx_service_history_equipment (equipment_id, service_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. notifications (In-App & Email Alert Log)
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. audit_logs (Immutable Security & Transaction Audit Trail)
CREATE TABLE audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_role VARCHAR(50) NULL,
    action VARCHAR(120) NOT NULL,
    entity_name VARCHAR(80) NOT NULL,
    entity_id VARCHAR(50) NULL,
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_entity (entity_name, entity_id),
    INDEX idx_audit_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
