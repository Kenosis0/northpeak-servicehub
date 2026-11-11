-- ============================================================================
-- NorthPeak ServiceHub — Comprehensive Seed Data (All 15 3NF Tables)
-- Default Password for ALL demo accounts: Password123!
-- Bcrypt Hash: $2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa
-- ============================================================================

USE northpeak_servicehub;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE audit_logs;
TRUNCATE TABLE notifications;
TRUNCATE TABLE service_history;
TRUNCATE TABLE payments;
TRUNCATE TABLE inventory_transactions;
TRUNCATE TABLE work_orders;
TRUNCATE TABLE inventory_items;
TRUNCATE TABLE quotation_items;
TRUNCATE TABLE quotations;
TRUNCATE TABLE service_requests;
TRUNCATE TABLE purchase_inquiries;
TRUNCATE TABLE equipment;
TRUNCATE TABLE products;
TRUNCATE TABLE customers;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. users (All 5 Roles: Administrator, Service Staff, Technician, Inventory Staff, Customer)
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, full_name, email, phone, password_hash, role, specialization, is_active) VALUES
(1, 'Roberto Mendoza', 'admin@northpeak.ph', '0917-100-1001', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Administrator', NULL, TRUE),
(2, 'Camille Villanueva', 'staff@northpeak.ph', '0917-200-2002', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Service Staff', NULL, TRUE),
(3, 'Arnel Bautista', 'tech1@northpeak.ph', '0917-300-3001', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Technician', 'Split-Type & Inverter Diagnostics', TRUE),
(4, 'Jerome Pangilinan', 'tech2@northpeak.ph', '0917-300-3002', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Technician', 'Commercial Cassette & Floor Mounted HVAC', TRUE),
(5, 'Liza Dizon', 'inventory@northpeak.ph', '0917-400-4001', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Inventory Staff', NULL, TRUE),
(6, 'Marco Dela Cruz', 'customer1@gmail.com', '0918-555-0101', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Customer', NULL, TRUE),
(7, 'Patricia Reyes', 'customer2@gmail.com', '0918-555-0202', '$2a$10$.cM.qcfz80jeWAF5Mkzsve9wyP18tfMi7JxGPgCa6MeB/A4cwPBSa', 'Customer', NULL, TRUE);

-- ----------------------------------------------------------------------------
-- 2. customers (Linked 1:1 with Customer users)
-- ----------------------------------------------------------------------------
INSERT INTO customers (customer_id, user_id, customer_type, company_name, full_name, email, phone, billing_address, service_address) VALUES
(1, 6, 'Residential', NULL, 'Marco Dela Cruz', 'customer1@gmail.com', '0918-555-0101', 'Blk 14 Lot 8 Sampaguita St., Angeles City, Pampanga', 'Blk 14 Lot 8 Sampaguita St., Angeles City, Pampanga'),
(2, 7, 'Commercial', 'Apex Dental & Medical Clinic', 'Patricia Reyes', 'customer2@gmail.com', '0918-555-0202', '2F MacArthur Highway Commercial Center, San Fernando, Pampanga', '2F MacArthur Highway Commercial Center, San Fernando, Pampanga');

-- ----------------------------------------------------------------------------
-- 3. products (5 Brand-New Aircon Units: Daikin, Carrier, Panasonic, Koppel, LG)
-- ----------------------------------------------------------------------------
INSERT INTO products (product_id, sku_code, brand, model_name, ac_type, horsepower, inverter_type, unit_price, stock_qty, warranty_months, specs_summary, is_active) VALUES
(1, 'AC-DAI-15INV', 'Daikin', 'D-Smart Queen FTKC35TVM 1.5HP', 'Split Type', '1.5 HP', 'Inverter', 34500.00, 8, 12, 'R32 Refrigerant, Coanda Airflow, Intelligent Eye, Quiet Operation (19 dBA)', TRUE),
(2, 'AC-CAR-20INV', 'Carrier', 'Aura Xtreme 53KCV018 2.0HP', 'Split Type', '2.0 HP', 'Inverter', 46800.00, 5, 24, 'High-Efficiency Inverter Compressor, 8-in-1 Air Filter, Eco Gear Mode', TRUE),
(3, 'AC-PAN-10WIN', 'Panasonic', 'CW-XU1021VPH 1.0HP Aero', 'Window Type', '1.0 HP', 'Inverter', 24900.00, 12, 12, 'Twin Cool Inverter, nanoe-X Air Purification, Wireless Remote', TRUE),
(4, 'AC-KOP-30FLR', 'Koppel', 'KV36FM-ARF21C 3.0HP Super Inverter', 'Floor Mounted', '3.0 HP', 'Inverter', 68500.00, 3, 12, 'Heavy-Duty Commercial Floor Standing AC, Gold Fin Condenser, R410A', TRUE),
(5, 'AC-LG-25CAS', 'LG', 'ZTNQ24GPLA0 2.5HP 4-Way Ceiling Cassette', 'Cassette Type', '2.5 HP', 'Inverter', 72000.00, 4, 24, 'Dual Inverter Compressor, Independent Vane Control, Built-in Drain Pump', TRUE);

-- ----------------------------------------------------------------------------
-- 4. equipment (4 Registered Customer AC Units with QR Tokens)
-- ----------------------------------------------------------------------------
INSERT INTO equipment (equipment_id, customer_id, product_id, qr_token, brand, model, serial_number, ac_type, capacity_hp, installed_location, installation_date, warranty_expiry, maintenance_interval_months, last_service_date, next_pm_date, status) VALUES
(1, 1, 1, 'NP-QR-2026-0001', 'Daikin', 'D-Smart Queen FTKC35TVM 1.5HP', 'DK-2025-884120A', 'Split Type', '1.5 HP', 'Master Bedroom (2nd Floor) - Angeles City Residence', '2025-05-15', '2026-05-15', 6, '2026-05-15', '2026-11-15', 'Active'),
(2, 1, 3, 'NP-QR-2026-0002', 'Panasonic', 'CW-XU1021VPH 1.0HP Aero', 'PN-2025-339104B', 'Window Type', '1.0 HP', 'Home Office / Study Room (1st Floor) - Angeles City Residence', '2025-08-20', '2026-08-20', 6, '2026-08-20', '2027-02-20', 'Active'),
(3, 2, 2, 'NP-QR-2026-0003', 'Carrier', 'Aura Xtreme 53KCV018 2.0HP', 'CR-2025-771920C', 'Split Type', '2.0 HP', 'Dental Treatment Suite 1 - Apex Clinic San Fernando', '2025-04-10', '2027-04-10', 3, '2026-08-10', '2026-11-10', 'Under Repair'),
(4, 2, 4, 'NP-QR-2026-0004', 'Koppel', 'KV36FM-ARF21C 3.0HP Super Inverter', 'KP-2025-550192D', 'Floor Mounted', '3.0 HP', 'Main Patient Reception Lobby - Apex Clinic San Fernando', '2025-06-01', '2026-06-01', 3, '2026-09-01', '2026-12-01', 'Active');

-- ----------------------------------------------------------------------------
-- 5. service_requests (Multi-Type Service Requests for Customer 1 & Customer 2)
-- ----------------------------------------------------------------------------
INSERT INTO service_requests (request_id, reference_no, customer_id, equipment_id, service_type, issue_description, current_location, destination_location, preferred_date, preferred_time_slot, priority, requires_quotation, payment_status, status) VALUES
(1, 'SR-20261105-1001', 1, 1, 'Preventive Maintenance and Cleaning', 'Scheduled 6-month general chemical cleaning, evaporator coil wash, and drain line flushing.', 'Blk 14 Lot 8 Sampaguita St., Angeles City, Pampanga', NULL, '2026-11-12', 'Morning (8AM-12PM)', 'Normal', TRUE, 'Fully Paid', 'Completed'),
(2, 'SR-20261108-1002', 2, 3, 'Repair and Troubleshooting', 'Split-type unit blowing warm air and outdoor condenser cuts off after 10 minutes. Possible capacitor failure and low R32 refrigerant pressure.', '2F MacArthur Highway Commercial Center, San Fernando, Pampanga', NULL, '2026-11-14', 'Afternoon (1PM-5PM)', 'High', TRUE, 'Downpayment Received', 'Scheduled'),
(3, 'SR-20261110-1003', 1, 2, 'Relocation or Transfer', 'Dismantling and transferring existing 1.0HP unit from 1st floor study room to newly renovated guest annex.', 'Blk 14 Lot 8 Sampaguita St. (1st Floor Study), Angeles City', 'Blk 14 Lot 8 Sampaguita St. (Rear Guest Annex), Angeles City', '2026-11-18', 'Morning (8AM-12PM)', 'Normal', TRUE, 'Unpaid', 'Quoted'),
(4, 'SR-20261110-1004', 2, NULL, 'Installation', 'Standard wall-mounted split-type installation for newly purchased Daikin 1.5HP unit (from Inquiry INQ-20261110-2002).', '2F MacArthur Highway Commercial Center (Consultation Room 2), San Fernando', NULL, '2026-11-20', 'Morning (8AM-12PM)', 'Normal', TRUE, 'Downpayment Received', 'Under Review');

-- ----------------------------------------------------------------------------
-- 6. purchase_inquiries (Aircon Sales Inquiries with Optional Installation)
-- ----------------------------------------------------------------------------
INSERT INTO purchase_inquiries (inquiry_id, reference_no, customer_id, product_id, quantity, unit_price_snapshot, total_amount, request_installation, installation_address, preferred_date, payment_status, inquiry_status, linked_service_request_id, staff_remarks) VALUES
(1, 'INQ-20261109-2001', 1, 1, 1, 34500.00, 34500.00, TRUE, 'Blk 14 Lot 8 Sampaguita St. (2nd Floor Kids Room), Angeles City, Pampanga', '2026-11-22', 'Unpaid', 'Pending Review', NULL, 'Awaiting stock confirmation and initial downpayment verification.'),
(2, 'INQ-20261110-2002', 2, 1, 1, 34500.00, 34500.00, TRUE, '2F MacArthur Highway Commercial Center (Consultation Room 2), San Fernando', '2026-11-20', 'Downpayment Received', 'Stock Confirmed', 4, 'Stock reserved and linked Installation Service Request SR-20261110-1004 automatically generated.');

-- ----------------------------------------------------------------------------
-- 7. quotations (Temporary & Finalized Quotes + Revision History)
-- ----------------------------------------------------------------------------
INSERT INTO quotations (quotation_id, quotation_no, request_id, revision_no, parent_quotation_id, quote_stage, labor_cost, parts_total, total_amount, downpayment_required, status, customer_decision_notes, valid_until, prepared_by, decided_at) VALUES
(1, 'QT-20261105-3001', 1, 1, NULL, 'Finalized', 1500.00, 350.00, 1850.00, 500.00, 'Approved', 'Approved for scheduled PM cleaning.', '2026-11-20', 2, '2026-11-05 14:30:00'),
(2, 'QT-20261108-3002', 2, 1, NULL, 'Finalized', 2200.00, 2950.00, 5150.00, 2500.00, 'Approved', 'Approved by Clinic Admin. 50% downpayment settled via GCash.', '2026-11-22', 2, '2026-11-09 10:15:00'),
(3, 'QT-20261110-3003', 3, 1, NULL, 'Finalized', 3500.00, 1800.00, 5300.00, 2000.00, 'Pending Customer Review', NULL, '2026-11-25', 2, NULL);

-- ----------------------------------------------------------------------------
-- 8. quotation_items (Immutable Line Item Price Snapshots)
-- ----------------------------------------------------------------------------
INSERT INTO quotation_items (quotation_item_id, quotation_id, item_type, description, quantity, quoted_price, subtotal) VALUES
(1, 1, 'Labor/Service', 'Full Split-Type Chemical Pull-Down Cleaning & Sanitization (1.5HP)', 1, 1500.00, 1500.00),
(2, 1, 'Material/Fee', 'Coil Cleaning Solution & Antibacterial Disinfectant Treatment', 1, 350.00, 350.00),
(3, 2, 'Labor/Service', 'Inverter Outdoor Condenser Troubleshooting & Refrigerant Recharging Labor', 1, 2200.00, 2200.00),
(4, 2, 'Spare Part', 'Dual Run Capacitor 45+5 uF 450VAC Heavy Duty', 1, 850.00, 850.00),
(5, 2, 'Spare Part', 'R32 Refrigerant Gas Recharge (per lb top-up)', 3, 700.00, 2100.00),
(6, 3, 'Labor/Service', 'AC Unit Dismantling, Transfer, Wall Bracket Re-mounting & Vacuuming', 1, 3500.00, 3500.00),
(7, 3, 'Material/Fee', 'Heavy Duty Outdoor L-Bracket & PVC Drain Pipe Extension', 1, 1800.00, 1800.00);

-- ----------------------------------------------------------------------------
-- 9. inventory_items (8 Spare Parts & Consumables, including Low-Stock items)
-- ----------------------------------------------------------------------------
INSERT INTO inventory_items (item_id, sku_code, part_name, category, unit_of_measure, unit_price, total_stock_qty, reserved_qty, reorder_level) VALUES
(1, 'PRT-CAP-4505', 'Dual Run Capacitor 45+5 uF 450VAC', 'Capacitor', 'pcs', 850.00, 18, 1, 5),
(2, 'PRT-FRE-R32', 'R32 Eco-Inverter Refrigerant Gas (Refill lb)', 'Refrigerant/Freon', 'lbs', 700.00, 30, 3, 8),
(3, 'PRT-FRE-R410', 'R410A Puron Refrigerant Gas (Refill lb)', 'Refrigerant/Freon', 'lbs', 650.00, 4, 0, 6),
(4, 'PRT-CMP-15INV', 'Rotary Inverter Compressor 1.5HP R32', 'Compressor', 'pcs', 8900.00, 2, 0, 3),
(5, 'PRT-COP-1438', 'Insulated Copper Tube Pair 1/4 & 3/8 (per ft)', 'Copper Tube', 'ft', 320.00, 85, 0, 20),
(6, 'PRT-FAN-ODM1', 'Universal Outdoor Condenser Fan Motor 35W', 'Fan Motor', 'pcs', 2400.00, 9, 0, 4),
(7, 'PRT-BRK-HD20', 'Galvanized Outdoor Condenser Wall Bracket (up to 2.5HP)', 'Mounting Hardware', 'sets', 950.00, 14, 0, 5),
(8, 'PRT-PCB-UNV1', 'Universal Split-Type Control Board / Sensor Kit', 'Electronics/PCB', 'kits', 1950.00, 3, 0, 5);

-- ----------------------------------------------------------------------------
-- 10. work_orders (Completed & Scheduled Technician Dispatch Records)
-- ----------------------------------------------------------------------------
INSERT INTO work_orders (work_order_id, work_order_no, request_id, quotation_id, technician_id, scheduled_start, scheduled_end, diagnosis_notes, work_performed, technician_remarks, evidence_photo_url, status, completed_at) VALUES
(1, 'WO-20261106-4001', 1, 1, 3, '2026-11-06 08:30:00', '2026-11-06 11:00:00', 'Heavy dust accumulation on indoor blower wheel and evaporator fins causing 20% airflow reduction.', 'Performed high-pressure hydro-cleaning of indoor evaporator and outdoor condenser, flushed condensate drain pan, checked amp draw (4.2A normal).', 'Unit cooling performance restored to 100%. Next PM set in 6 months.', NULL, 'Completed', '2026-11-06 10:50:00'),
(2, 'WO-20261114-4002', 2, 2, 3, '2026-11-14 13:00:00', '2026-11-14 16:00:00', NULL, NULL, NULL, NULL, 'Scheduled', NULL);

-- ----------------------------------------------------------------------------
-- 11. inventory_transactions (Work-Order-Linked Reservations & Stock Movements)
-- ----------------------------------------------------------------------------
INSERT INTO inventory_transactions (transaction_id, item_id, work_order_id, tx_type, quantity, performed_by, remarks) VALUES
(1, 1, 2, 'Reservation', 1, 5, 'Reserved 1x Dual Run Capacitor for WO-20261114-4002 (Apex Clinic Repair)'),
(2, 2, 2, 'Reservation', 3, 5, 'Reserved 3 lbs R32 Refrigerant for WO-20261114-4002 (Apex Clinic Repair)');

-- ----------------------------------------------------------------------------
-- 12. payments (Staff-Recorded Offline Payments & Downpayments)
-- ----------------------------------------------------------------------------
INSERT INTO payments (payment_id, inquiry_id, request_id, amount_paid, payment_type, payment_method, reference_receipt_no, recorded_by, recorded_at) VALUES
(1, NULL, 1, 1850.00, 'Full Payment', 'Cash', 'OR-NP-2026-0881', 2, '2026-11-06 11:15:00'),
(2, NULL, 2, 2500.00, 'Downpayment', 'GCash / Maya Receipt', 'GCASH-9948102344', 2, '2026-11-09 10:20:00'),
(3, 2, 4, 15000.00, 'Downpayment', 'Bank Transfer', 'BPI-TRF-88291044', 2, '2026-11-10 15:00:00');

-- ----------------------------------------------------------------------------
-- 13. service_history (Chronological Equipment Maintenance Ledger)
-- ----------------------------------------------------------------------------
INSERT INTO service_history (history_id, equipment_id, work_order_id, service_type, diagnosis_summary, actions_taken, parts_replaced_summary, technician_name, service_date, computed_next_pm_date) VALUES
(1, 1, 1, 'Preventive Maintenance and Cleaning', 'Heavy dust accumulation on indoor blower wheel and evaporator fins causing 20% airflow reduction.', 'Performed high-pressure hydro-cleaning of indoor evaporator and outdoor condenser, flushed condensate drain pan, checked amp draw (4.2A normal).', 'Coil Cleaning Solution & Antibacterial Disinfectant Treatment', 'Arnel Bautista', '2026-11-06', '2027-05-06');

-- ----------------------------------------------------------------------------
-- 14. notifications (Sample Alerts Across Roles)
-- ----------------------------------------------------------------------------
INSERT INTO notifications (notification_id, user_id, title, message, is_read) VALUES
(1, 6, 'Quotation Ready for Review (QT-20261110-3003)', 'A finalized quotation for your Relocation request (SR-20261110-1003) amounting to PHP 5,300.00 is ready for your approval.', FALSE),
(2, 7, 'Technician Scheduled (WO-20261114-4002)', 'Technician Arnel Bautista has been dispatched for your Repair request (SR-20261108-1002) on 2026-11-14 13:00.', FALSE),
(3, 3, 'New Work Order Assigned: WO-20261114-4002', 'You are scheduled for Repair and Troubleshooting at Apex Dental & Medical Clinic on 2026-11-14 (1:00 PM - 4:00 PM).', FALSE),
(4, 5, 'Low Stock Alert: 3 Spare Parts Below Reorder Level', 'R410A Refrigerant (4 lbs), 1.5HP Inverter Compressor (2 pcs), and Universal PCB Kit (3 kits) are at or below reorder threshold.', FALSE),
(5, 2, 'New Purchase Inquiry: INQ-20261109-2001', 'Marco Dela Cruz submitted an inquiry for 1x Daikin D-Smart Queen 1.5HP with optional installation.', FALSE);

-- ----------------------------------------------------------------------------
-- 15. audit_logs (Immutable Security & Transaction Audit Trail)
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (log_id, user_id, user_role, action, entity_name, entity_id, details) VALUES
(1, 2, 'Service Staff', 'INQUIRY_PROCESSED_WITH_INSTALLATION', 'purchase_inquiries', 'INQ-20261110-2002', 'Confirmed stock and auto-generated linked Installation Service Request SR-20261110-1004'),
(2, 2, 'Service Staff', 'PAYMENT_RECORDED', 'payments', '2', 'Recorded Downpayment of PHP 2,500.00 (GCASH-9948102344) for SR-20261108-1002'),
(3, 2, 'Service Staff', 'WORK_ORDER_DISPATCHED', 'work_orders', 'WO-20261114-4002', 'Assigned Technician Arnel Bautista (2026-11-14 13:00 to 16:00) with zero schedule conflict'),
(4, 5, 'Inventory Staff', 'INVENTORY_RESERVATION', 'inventory_transactions', '1', 'Reserved 1x PRT-CAP-4505 and 3x PRT-FRE-R32 for WO-20261114-4002'),
(5, 3, 'Technician', 'WORK_ORDER_COMPLETED', 'work_orders', 'WO-20261106-4001', 'Completed PM cleaning for equipment NP-QR-2026-0001; auto-calculated next_pm_date = 2027-05-06');
