import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, ShieldCheck, MapPin, Wrench, History, Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import QRModal from '../../components/QRModal';

export default function MyEquipmentHistory() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQrUnit, setSelectedQrUnit] = useState(null);

  // Interactive QR Token Lookup (TC-004 & TC-014 Tenant Isolation Verification)
  const [qrLookupToken, setQrLookupToken] = useState('');
  const [qrLookupFeedback, setQrLookupFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    async function loadEquipment() {
      try {
        const res = await api.get('/equipment');
        setEquipment(res.data.equipment || []);
      } catch (err) {
        console.error('Failed to load equipment:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEquipment();
  }, []);

  const handleVerifyQrToken = async (tokenToCheck) => {
    const clean = String(tokenToCheck ?? qrLookupToken).trim();
    if (!clean) return;
    setQrLookupToken(clean);
    setQrLookupFeedback({ type: '', message: '' });
    try {
      const res = await api.get(`/equipment/qr/${encodeURIComponent(clean)}`);
      const unit = res.data.equipment;
      setQrLookupFeedback({
        type: 'success',
        message: `Verified QR [${unit.qr_token}]: ${unit.brand} ${unit.model} (${unit.installed_location}) — Next PM Due: ${unit.next_pm_date || 'N/A'}`
      });
      setSelectedQrUnit(unit);
    } catch (err) {
      setQrLookupFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          `HTTP ${err.response?.status || 403}: Access denied or QR token not found.`
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          My Registered AC Units, QR Stickers & Maintenance Ledger
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View your QR-tagged aircon units, automated Preventive Maintenance (PM) due dates, and complete technician service history.
        </p>
      </div>

      {/* QR Token Lookup & Multi-Tenant Isolation Verifier (TC-004 & TC-014) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#0284C7]" />
            <span className="text-xs font-bold text-slate-900">
              Quick QR Sticker Verification (TC-004 & TC-014 Multi-Tenant Isolation)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleVerifyQrToken('NP-QR-2026-0001')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-bold"
            >
              Test Own QR: NP-QR-2026-0001
            </button>
            <button
              type="button"
              onClick={() => handleVerifyQrToken('NP-QR-2026-0003')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-mono font-bold"
            >
              Test Other Customer QR (TC-014 403): NP-QR-2026-0003
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={qrLookupToken}
            onChange={(e) => setQrLookupToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerifyQrToken(qrLookupToken)}
            placeholder="Enter QR Token (e.g. NP-QR-2026-0001)..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
          />
          <button
            type="button"
            onClick={() => handleVerifyQrToken(qrLookupToken)}
            className="px-4 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Verify QR
          </button>
        </div>

        {qrLookupFeedback.message && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              qrLookupFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {qrLookupFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{qrLookupFeedback.message}</span>
            </div>
            <button onClick={() => setQrLookupFeedback({ type: '', message: '' })}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading your equipment...</div>
      ) : equipment.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
          No registered AC units found for your account.
        </div>
      ) : (
        <div className="space-y-6">
          {equipment.map((unit) => (
            <div
              key={unit.equipment_id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Unit Header */}
              <div className="px-6 py-4 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-extrabold px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/40">
                    {unit.qr_token}
                  </span>
                  <div>
                    <h2 className="font-bold text-base">
                      {unit.brand} {unit.model}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {unit.ac_type} • {unit.capacity_hp} • Serial: <span className="font-mono">{unit.serial_number}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={unit.status} />
                  <button
                    onClick={() => setSelectedQrUnit(unit)}
                    className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Printable QR Sticker
                  </button>
                </div>
              </div>

              {/* Specs & PM Schedule Bar */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border-b border-slate-200 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[10px]">Installed Location</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{unit.installed_location}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[10px]">Warranty Expiry</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {unit.warranty_expiry || 'Standard 12M'} (Installed: {unit.installation_date || 'N/A'})
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-500 uppercase text-[10px]">Last Service Date</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {unit.last_service_date || 'No prior record'} (Every {unit.maintenance_interval_months} mos)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-700 uppercase text-[10px]">
                      Next Preventive Maintenance Due
                    </div>
                    <div className="font-extrabold text-sm text-emerald-700 mt-0.5">
                      {unit.next_pm_date || 'Upon Completion'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chronological Service History Table */}
              <div className="p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-sky-600" />
                  Chronological Equipment Maintenance & Repair Ledger ({unit.service_history?.length || 0})
                </h3>

                {!unit.service_history || unit.service_history.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    No completed service history entries recorded for this unit yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                          <th className="py-2.5 px-4 font-bold">Service Date</th>
                          <th className="py-2.5 px-4 font-bold">Service Type</th>
                          <th className="py-2.5 px-4 font-bold">Diagnosis & Actions Taken</th>
                          <th className="py-2.5 px-4 font-bold">Parts Used</th>
                          <th className="py-2.5 px-4 font-bold">Technician</th>
                          <th className="py-2.5 px-4 font-bold">Computed Next PM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unit.service_history.map((sh) => (
                          <tr key={sh.history_id}>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {sh.service_date}
                            </td>
                            <td className="py-3 px-4 font-semibold text-sky-800">
                              {sh.service_type}
                            </td>
                            <td className="py-3 px-4 max-w-md">
                              <div className="font-semibold text-slate-800">
                                Diagnosis: {sh.diagnosis_summary}
                              </div>
                              <div className="text-slate-600 mt-0.5">
                                Action: {sh.actions_taken}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {sh.parts_replaced_summary || 'None'}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {sh.technician_name}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                              {sh.computed_next_pm_date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedQrUnit && (
        <QRModal equipment={selectedQrUnit} onClose={() => setSelectedQrUnit(null)} />
      )}
    </div>
  );
}
