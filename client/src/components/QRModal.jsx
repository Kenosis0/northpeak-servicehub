import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, QrCode, ShieldCheck, Calendar, MapPin } from 'lucide-react';

export default function QRModal({ equipment, onClose }) {
  if (!equipment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base">Printable Equipment QR Tag</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Sticker Area */}
        <div className="p-6">
          <div className="border-2 border-dashed border-slate-800 rounded-xl p-5 bg-slate-50 text-center">
            <div className="text-xs font-bold tracking-widest uppercase text-sky-700 mb-1">
              NorthPeak Aircon & Refrigeration System Trading
            </div>
            <div className="text-[11px] text-slate-500 mb-4">
              Official Registered Equipment Service Sticker
            </div>

            <div className="inline-flex p-4 bg-white rounded-xl shadow-sm border border-slate-200 mb-4">
              <QRCodeSVG
                value={equipment.qr_token || 'NP-QR-UNKNOWN'}
                size={170}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="font-mono text-lg font-extrabold text-slate-900 tracking-wider bg-sky-100/80 border border-sky-300 rounded-lg py-1.5 px-3 inline-block mb-4">
              {equipment.qr_token}
            </div>

            <div className="text-left space-y-2 text-xs border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Unit Model:</span>
                <span className="font-bold text-slate-900">
                  {equipment.brand} {equipment.model}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Type & Capacity:</span>
                <span className="font-semibold text-slate-800">
                  {equipment.ac_type} • {equipment.capacity_hp}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Serial Number:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {equipment.serial_number}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" /> Location:
                </span>
                <span className="font-medium text-slate-800 text-right">
                  {equipment.installed_location}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Next PM Due:
                </span>
                <span className="font-bold text-emerald-700">
                  {equipment.next_pm_date || 'Upon First Service'}
                </span>
              </div>
              {equipment.warranty_expiry && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Warranty Until:
                  </span>
                  <span className="font-semibold text-slate-700">{equipment.warranty_expiry}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0284C7] hover:bg-sky-700 text-white shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print QR Sticker
          </button>
        </div>
      </div>
    </div>
  );
}
