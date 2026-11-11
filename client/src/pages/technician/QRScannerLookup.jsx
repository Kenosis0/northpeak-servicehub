import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  CameraOff,
  Search,
  ShieldCheck,
  Calendar,
  MapPin,
  History,
  AlertCircle,
  Printer
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import QRModal from '../../components/QRModal';

const DEMO_QR_TOKENS = [
  { token: 'NP-QR-2026-0001', label: 'Daikin 1.5HP Split (Marco)' },
  { token: 'NP-QR-2026-0002', label: 'Panasonic 1.0HP Window (Marco)' },
  { token: 'NP-QR-2026-0003', label: 'Carrier 2.0HP Split (Apex Clinic)' },
  { token: 'NP-QR-2026-0004', label: 'Koppel 3.0HP Floor (Apex Clinic)' }
];

export default function QRScannerLookup() {
  const [tokenInput, setTokenInput] = useState('NP-QR-2026-0001');
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const html5QrCodeRef = useRef(null);

  const handleLookup = async (targetToken = tokenInput) => {
    const clean = String(targetToken || '').trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/equipment/qr/${encodeURIComponent(clean)}`);
      setEquipment(res.data.equipment);
    } catch (err) {
      setEquipment(null);
      setError(
        err.response?.data?.message || `No equipment found for QR token '${clean}'.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleLookup('NP-QR-2026-0001');
    return () => {
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async () => {
    setError('');
    setCameraActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader-region');
        html5QrCodeRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            setTokenInput(decodedText);
            stopCameraScanner();
            handleLookup(decodedText);
          },
          () => {}
        );
      } catch (err) {
        setCameraActive(false);
        setError(
          'Camera access unavailable or denied in this browser environment. Use the 1-Click QR Token buttons or manual input below.'
        );
      }
    }, 150);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch {
        // Ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">
          QR Code Equipment Lookup & Chronological Service History
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Scan an aircon unit's QR sticker via camera or select a QR token below to pull up technical specs, warranty status, and full maintenance ledger (FR-004 / TC-004).
        </p>
      </div>

      {/* Scanner & Input Control Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup(tokenInput)}
              placeholder="Enter QR Token (e.g. NP-QR-2026-0001) or Serial Number..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
            />
          </div>
          <button
            onClick={() => handleLookup(tokenInput)}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Looking up...' : 'Lookup QR Token'}
          </button>
          {!cameraActive ? (
            <button
              type="button"
              onClick={startCameraScanner}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              Camera QR Scan
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCameraScanner}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </button>
          )}
        </div>

        {/* 1-Click Demo QR Token Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Quick Demo QR Tokens:
          </span>
          {DEMO_QR_TOKENS.map((item) => (
            <button
              key={item.token}
              type="button"
              onClick={() => {
                setTokenInput(item.token);
                handleLookup(item.token);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                equipment?.qr_token === item.token
                  ? 'bg-[#0284C7] text-white border-[#0284C7]'
                  : 'bg-slate-50 hover:bg-sky-50 text-slate-700 border-slate-200'
              }`}
            >
              {item.token} — <span className="font-sans font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Camera Viewport */}
        {cameraActive && (
          <div className="max-w-sm mx-auto p-4 rounded-2xl bg-slate-900 text-white text-center">
            <div id="qr-reader-region" className="w-full overflow-hidden rounded-xl" />
            <p className="text-xs text-slate-300 mt-2">
              Point camera at the NorthPeak QR equipment sticker
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Equipment Result Card */}
      {equipment && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-extrabold px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/40">
                {equipment.qr_token}
              </span>
              <div>
                <h2 className="text-lg font-extrabold">
                  {equipment.brand} {equipment.model}
                </h2>
                <p className="text-xs text-slate-300">
                  {equipment.ac_type} • {equipment.capacity_hp} • Serial Number:{' '}
                  <span className="font-mono font-bold text-white">{equipment.serial_number}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <StatusBadge status={equipment.status} />
              <button
                onClick={() => setShowQrModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#0284C7] hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Printable QR Sticker
              </button>
            </div>
          </div>

          {/* Unit Metadata Grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border-b border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Customer Owner</div>
              <div className="font-bold text-slate-900 mt-0.5">{equipment.customer_name}</div>
              {equipment.customer_company && (
                <div className="text-sky-700 font-semibold">{equipment.customer_company}</div>
              )}
              <div className="text-slate-500">{equipment.customer_phone}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-sky-600" /> Installed Location
              </div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {equipment.installed_location}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-sky-600" /> Installation & Warranty
              </div>
              <div className="font-semibold text-slate-900 mt-0.5">
                Installed: {equipment.installation_date || 'N/A'}
              </div>
              <div className="text-slate-600">
                Warranty Until: <strong>{equipment.warranty_expiry || 'Standard'}</strong>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-600" /> Preventive Maintenance Schedule
              </div>
              <div className="font-semibold text-slate-800 mt-0.5">
                Last Service: {equipment.last_service_date || 'None'}
              </div>
              <div className="font-extrabold text-emerald-700 text-sm">
                Next PM Due: {equipment.next_pm_date || 'Pending'} ({equipment.maintenance_interval_months}m)
              </div>
            </div>
          </div>

          {/* Chronological Service History */}
          <div className="p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#0284C7]" />
              Chronological Equipment Maintenance & Repair Ledger ({equipment.service_history?.length || 0})
            </h3>

            {!equipment.service_history || equipment.service_history.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No completed service history entries recorded for this unit yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                      <th className="py-2.5 px-4 font-bold">Date</th>
                      <th className="py-2.5 px-4 font-bold">Work Order & Type</th>
                      <th className="py-2.5 px-4 font-bold">Diagnosis & Actions Taken</th>
                      <th className="py-2.5 px-4 font-bold">Parts Replaced</th>
                      <th className="py-2.5 px-4 font-bold">Technician</th>
                      <th className="py-2.5 px-4 font-bold">Computed Next PM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {equipment.service_history.map((sh) => (
                      <tr key={sh.history_id}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {sh.service_date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-[#0284C7]">
                            {sh.work_order_no || `WO #${sh.work_order_id}`}
                          </div>
                          <div className="font-semibold text-slate-800">{sh.service_type}</div>
                        </td>
                        <td className="py-3 px-4 max-w-md">
                          <div className="font-semibold text-slate-900">
                            Diagnosis: {sh.diagnosis_summary}
                          </div>
                          <div className="text-slate-600 mt-0.5">Actions: {sh.actions_taken}</div>
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
      )}

      {showQrModal && equipment && (
        <QRModal equipment={equipment} onClose={() => setShowQrModal(false)} />
      )}
    </div>
  );
}
