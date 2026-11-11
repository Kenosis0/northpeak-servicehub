/**
 * Leap-year and month-end safe calculation for Preventive Maintenance (next_pm_date).
 * Formats dates strictly as YYYY-MM-DD.
 */

function formatDateYMD(dateInput = new Date()) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = new Date(dateInput);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Adds intervalMonths (default 6) to completionDate (YYYY-MM-DD or Date)
 * while clamping to the end of the target month (e.g. Aug 31 + 6 months -> Feb 28/29).
 */
function calculateNextPmDate(completionDate = new Date(), intervalMonths = 6) {
  const ymd = formatDateYMD(completionDate);
  const [yearStr, monthStr, dayStr] = ymd.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1; // 0-based
  const day = parseInt(dayStr, 10);

  const monthsToAdd = Number.isFinite(Number(intervalMonths)) && Number(intervalMonths) > 0
    ? parseInt(intervalMonths, 10)
    : 6;

  const totalMonths = year * 12 + monthIndex + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths % 12;

  // Last day of targetYear / targetMonthIndex
  const maxDayInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDayInTargetMonth);

  const yyyy = String(targetYear);
  const mm = String(targetMonthIndex + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = {
  formatDateYMD,
  calculateNextPmDate
};
