/**
 * Generates human-readable public reference numbers:
 * - Purchase Inquiry: INQ-YYYYMMDD-XXXX
 * - Service Request:  SR-YYYYMMDD-XXXX
 * - Quotation:        QT-YYYYMMDD-XXXX
 * - Work Order:       WO-YYYYMMDD-XXXX
 */

function getDateStamp(date = new Date()) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function randomFourDigits() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateRef(prefix = 'REF', date = new Date()) {
  return `${prefix}-${getDateStamp(date)}-${randomFourDigits()}`;
}

function generateInquiryRef(date = new Date()) {
  return generateRef('INQ', date);
}

function generateServiceRequestRef(date = new Date()) {
  return generateRef('SR', date);
}

function generateQuotationRef(date = new Date()) {
  return generateRef('QT', date);
}

function generateWorkOrderRef(date = new Date()) {
  return generateRef('WO', date);
}

function generateQrToken(date = new Date()) {
  const yyyy = new Date(date).getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `NP-QR-${yyyy}-${rand}`;
}

module.exports = {
  generateRef,
  generateInquiryRef,
  generateServiceRequestRef,
  generateQuotationRef,
  generateWorkOrderRef,
  generateQrToken
};
