import { useState } from 'react';
import { getDetailedCashFlowReport, formatMoney, exportTransactionsCsv } from '../store';

const CATEGORY_ICONS = {
  'Nhập hàng': '📦',
  'Phí ship': '🚚',
  'Bao bì/Đóng gói': '🎁',
  'Tiền điện/Nước': '💡',
  'Ăn uống': '🍜',
  'Khác...': '📝',
};

export default function CashFlowModal({ onClose, showToast }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const report = getDetailedCashFlowReport(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleExportCsv = () => {
    try {
      const csv = exportTransactionsCsv(year, month);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BaoCao_DongTien_T${month + 1}_${year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📥 Đã tải file Excel báo cáo!');
    } catch (err) {
      showToast('Lỗi khi xuất file: ' + err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[520px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[1.4rem]">📊</span>
            <div>
              <h2 className="text-[1.25rem] font-extrabold leading-tight">Báo Cáo Dòng Tiền</h2>
              <p className="text-[0.75rem] text-[var(--color-text-muted)]">Thu chi & Lợi nhuận kinh doanh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] active:scale-90 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-between bg-[var(--color-dark-700)] p-2 rounded-xl mb-4 border border-[var(--color-dark-500)]">
          <button
            onClick={prevMonth}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-sm font-bold active:scale-95 transition-transform"
          >
            ◀ Trước
          </button>
          <span className="font-extrabold text-[1rem] text-amber-300">
            Tháng {month + 1} / {year}
          </span>
          <button
            onClick={nextMonth}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-sm font-bold active:scale-95 transition-transform"
          >
            Sau ▶
          </button>
        </div>

        {/* Net Cash Flow Summary Banner */}
        <div
          className="p-4 rounded-2xl mb-4 border"
          style={{
            background:
              report.netCashFlow >= 0
                ? 'linear-gradient(135deg, rgba(22, 101, 52, 0.4), rgba(34, 197, 94, 0.15))'
                : 'linear-gradient(135deg, rgba(153, 27, 27, 0.4), rgba(239, 68, 68, 0.15))',
            borderColor: report.netCashFlow >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.78rem] uppercase font-bold tracking-wider opacity-80">
                Dòng tiền ròng thực tế
              </p>
              <h3
                className="text-[1.65rem] font-extrabold tracking-tight mt-0.5"
                style={{ color: report.netCashFlow >= 0 ? 'var(--color-green-400)' : 'var(--color-red-400)' }}
              >
                {report.netCashFlow >= 0 ? '+' : ''}
                {formatMoney(report.netCashFlow)}
              </h3>
              <p className="text-[0.72rem] opacity-70 mt-0.5">
                (Tiền thực nhận vào ví - Tiền đã chi ra)
              </p>
            </div>
            <div className="text-right">
              <span className="text-[0.8rem] px-2.5 py-1 rounded-full bg-slate-900/60 font-semibold border border-white/10">
                {report.saleCount} đơn bán
              </span>
            </div>
          </div>
        </div>

        {/* Flow Breakdown */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
            <span className="text-[0.75rem] text-emerald-300 font-bold uppercase block mb-1">
              📥 Tổng Tiền Vào
            </span>
            <span className="text-[1.2rem] font-extrabold text-emerald-400 block">
              +{formatMoney(report.actualCashInflow)}
            </span>
            <div className="mt-2 pt-2 border-t border-emerald-500/10 text-[0.72rem] space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Thu ngay/CK:</span>
                <span className="font-semibold">{formatMoney(report.cashSaleIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>COD nhận:</span>
                <span className="font-semibold">{formatMoney(report.codReceivedIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Khách trả nợ:</span>
                <span className="font-semibold">{formatMoney(report.debtPaymentIncome)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-500/20">
            <span className="text-[0.75rem] text-orange-300 font-bold uppercase block mb-1">
              📤 Tổng Tiền Chi
            </span>
            <span className="text-[1.2rem] font-extrabold text-orange-400 block">
              -{formatMoney(report.totalExpense)}
            </span>
            <div className="mt-2 pt-2 border-t border-orange-500/10 text-[0.72rem] space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Số khoản chi:</span>
                <span className="font-semibold">{report.expenseCount} khoản</span>
              </div>
              <div className="flex justify-between">
                <span>Giá vốn bán:</span>
                <span className="font-semibold">{formatMoney(report.totalCostOfGoods)}</span>
              </div>
              <div className="flex justify-between">
                <span>LN ròng:</span>
                <span className="font-bold text-amber-300">{formatMoney(report.netProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="glass-card p-3.5 mb-4">
          <h4 className="text-[0.85rem] font-bold text-[var(--color-text-secondary)] mb-2.5 flex items-center justify-between">
            <span>Phân Loại Chi Phí</span>
            <span className="text-[0.75rem] font-normal text-slate-400">
              Tổng: {formatMoney(report.totalExpense)}
            </span>
          </h4>
          <div className="space-y-2">
            {Object.entries(report.expensesByCategory).map(([cat, amt]) => {
              const percent = report.totalExpense > 0 ? Math.round((amt / report.totalExpense) * 100) : 0;
              return (
                <div key={cat} className="text-[0.8rem]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>{CATEGORY_ICONS[cat] || '📝'}</span>
                      <span>{cat}</span>
                    </span>
                    <span className="font-bold text-slate-200">
                      {formatMoney(amt)} <span className="text-[0.7rem] text-slate-400 font-normal">({percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-dark-600)] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button: Export CSV */}
        <button
          onClick={handleExportCsv}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[0.95rem] flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-lg shadow-emerald-950/40"
        >
          <span>📥</span>
          <span>Xuất File Excel (CSV) Báo Cáo Tháng {month + 1}</span>
        </button>
      </div>
    </div>
  );
}
