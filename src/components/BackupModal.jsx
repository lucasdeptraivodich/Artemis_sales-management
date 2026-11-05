import { useState } from 'react';
import {
  exportDatabaseToJson,
  importDatabaseFromJson,
  exportTransactionsCsv,
  getTransactions,
  getCustomers,
  getItems,
} from '../store';

export default function BackupModal({ onClose, onRestoreSuccess, showToast }) {
  const [importing, setImporting] = useState(false);

  const txCount = getTransactions().length;
  const custCount = getCustomers().length;
  const itemCount = getItems().length;

  const handleExportJson = () => {
    try {
      const jsonStr = exportDatabaseToJson();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `Artemis_QLBH_SaoLuu_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('💾 Đã tải file sao lưu JSON!');
    } catch (err) {
      showToast('Lỗi sao lưu: ' + err.message, 'error');
    }
  };

  const handleExportAllCsv = () => {
    try {
      const csvStr = exportTransactionsCsv();
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `Artemis_QLBH_DonHang_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📊 Đã tải file Excel CSV toàn bộ đơn!');
    } catch (err) {
      showToast('Lỗi xuất CSV: ' + err.message, 'error');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Phục hồi dữ liệu từ file sẽ cập nhật cơ sở dữ liệu trên máy bạn. Bạn có muốn tiếp tục?')) {
      e.target.value = '';
      return;
    }

    try {
      setImporting(true);
      const text = await file.text();
      await importDatabaseFromJson(text);
      showToast('🎉 Đã phục hồi dữ liệu thành công!');
      if (onRestoreSuccess) onRestoreSuccess();
      onClose();
    } catch (err) {
      showToast('Lỗi phục hồi file: ' + err.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[1.4rem]">💾</span>
            <div>
              <h2 className="text-[1.25rem] font-extrabold leading-tight">Sao Lưu & Phục Hồi</h2>
              <p className="text-[0.75rem] text-[var(--color-text-muted)]">Bảo toàn dữ liệu kinh doanh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] active:scale-90 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Database Status Card */}
        <div className="p-3.5 rounded-xl bg-[var(--color-dark-700)] border border-[var(--color-dark-500)] mb-4">
          <div className="flex items-center justify-between text-[0.82rem] mb-2">
            <span className="text-slate-400">Trạng thái cơ sở dữ liệu:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              🟢 IndexedDB Bền Vững
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[var(--color-dark-600)]">
            <div className="p-2 rounded-lg bg-[var(--color-dark-600)]">
              <span className="text-[1.05rem] font-extrabold text-white block">{txCount}</span>
              <span className="text-[0.7rem] text-slate-400">Đơn hàng</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--color-dark-600)]">
              <span className="text-[1.05rem] font-extrabold text-white block">{custCount}</span>
              <span className="text-[0.7rem] text-slate-400">Khách nợ</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--color-dark-600)]">
              <span className="text-[1.05rem] font-extrabold text-white block">{itemCount}</span>
              <span className="text-[0.7rem] text-slate-400">Món hàng</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleExportJson}
            className="w-full p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[0.92rem] flex items-center justify-between shadow"
          >
            <span className="flex items-center gap-2">
              <span>💾</span>
              <span>Tải File Sao Lưu Dự Phòng (.JSON)</span>
            </span>
            <span className="text-xs opacity-80">Khuyên dùng</span>
          </button>

          <button
            onClick={handleExportAllCsv}
            className="w-full p-3.5 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-white font-bold text-[0.92rem] flex items-center justify-between border border-white/5"
          >
            <span className="flex items-center gap-2">
              <span>📊</span>
              <span>Xuất Toàn Bộ Đơn Sang Excel (.CSV)</span>
            </span>
            <span className="text-xs text-emerald-400">Excel / Sheets</span>
          </button>

          <label className="w-full p-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[0.92rem] flex items-center justify-between border border-amber-500/30 cursor-pointer block">
            <span className="flex items-center gap-2">
              <span>📂</span>
              <span>{importing ? 'Đang phục hồi...' : 'Phục Hồi Dữ Liệu Từ File (.JSON)'}</span>
            </span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
              disabled={importing}
            />
            <span className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-extrabold">
              Chọn file
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
