import { useState, useMemo } from 'react';
import { getRevenueReportData, exportRevenueReportCsv, formatMoney, formatDate } from '../store';

const PERIODS = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: 'Tuần này' },
  { id: 'month', label: 'Tháng này' },
  { id: 'all', label: 'Tất cả' },
];

export default function ReportExportModal({ onClose, showToast, user }) {
  const [period, setPeriod] = useState('today');
  const [copied, setCopied] = useState(false);

  const shopName = user?.user_metadata?.shop_name || user?.email?.split('@')[0] || 'Cửa hàng';
  const report = useMemo(() => getRevenueReportData(period), [period]);
  const { transactions, totals } = report;

  const currentPeriodLabel = PERIODS.find((p) => p.id === period)?.label || 'Hôm nay';

  const formatZaloMessage = () => {
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    return `📊 BÁO CÁO DOANH THU (${currentPeriodLabel.toUpperCase()})
🏪 Cửa hàng: ${shopName}
⏰ Xuất lúc: ${timeStr}
─────────────────────────
💰 Tổng thu thực: ${formatMoney(totals.actualIncome)}
💸 Tổng chi phí: ${formatMoney(totals.costAndExpense)}
📝 Nợ chưa thu: ${formatMoney(totals.debt)}
📈 Lợi nhuận: ${totals.profit >= 0 ? '+' : ''}${formatMoney(totals.profit)}
📦 Tổng đơn hàng: ${totals.orderCount} đơn (${totals.totalQuantity} sản phẩm)
─────────────────────────
(Báo cáo xuất từ ứng dụng quản lý Artemis)`;
  };

  const handleShareZalo = async () => {
    const text = formatZaloMessage();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.warn('Lỗi copy clipboard:', err);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Báo cáo doanh thu - ${currentPeriodLabel}`,
          text: text,
        });
        showToast('✅ Đã chia sẻ báo cáo thành công!');
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share API error:', err);
        }
      }
    }
    showToast('📋 Đã sao chép báo cáo! Bạn hãy dán (Paste) vào Zalo ngay.');
  };

  const handleExportExcel = () => {
    try {
      const csvStr = exportRevenueReportCsv(period, shopName);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.setAttribute('download', `BaoCao_DoanhThu_${period}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('📊 Đã tải file Excel báo cáo doanh thu!');
    } catch (err) {
      showToast('Lỗi xuất Excel: ' + err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[520px] max-h-[92vh] flex flex-col p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-[1.4rem] shadow">
              📊
            </div>
            <div>
              <h2 className="text-[1.2rem] font-extrabold text-white leading-tight">
                Báo Cáo & Xuất Dữ Liệu
              </h2>
              <p className="text-[0.8rem] text-yellow-300 font-medium">
                Xuất file Excel & Gửi tóm tắt qua Zalo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] text-white hover:bg-[var(--color-dark-400)] active:scale-90 transition-transform font-bold"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Content scroll area */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">
          {/* Period selector */}
          <div>
            <label className="block text-[0.85rem] font-bold text-white mb-1.5">
              📅 Chọn khoảng thời gian:
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {PERIODS.map((p) => {
                const isActive = period === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`py-2.5 px-2 rounded-xl text-[0.88rem] font-extrabold transition-all border ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md scale-[1.02]'
                        : 'bg-[var(--color-dark-600)] text-white border-white/10 hover:bg-[var(--color-dark-500)]'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Revenue Statistics Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40">
              <span className="text-[0.78rem] text-emerald-300 font-bold block">
                💰 Thu thực tế
              </span>
              <span className="text-[1.25rem] font-extrabold text-emerald-400 block mt-0.5">
                {formatMoney(totals.actualIncome)}
              </span>
              <span className="text-[0.7rem] text-slate-200 block mt-0.5">
                (Tiền mặt + COD nhận)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-orange-950/50 border border-orange-500/40">
              <span className="text-[0.78rem] text-orange-300 font-bold block">
                💸 Tổng chi phí
              </span>
              <span className="text-[1.25rem] font-extrabold text-orange-400 block mt-0.5">
                {formatMoney(totals.costAndExpense)}
              </span>
              <span className="text-[0.7rem] text-slate-200 block mt-0.5">
                (Giá vốn + Chi ngoài)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40">
              <span className="text-[0.78rem] text-rose-300 font-bold block">
                📝 Nợ chưa thu
              </span>
              <span className="text-[1.25rem] font-extrabold text-rose-400 block mt-0.5">
                {formatMoney(totals.debt)}
              </span>
              <span className="text-[0.7rem] text-slate-200 block mt-0.5">
                (Khách nợ + Chờ COD)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-500/40">
              <span className="text-[0.78rem] text-blue-300 font-bold block">
                📈 Lợi nhuận
              </span>
              <span
                className={`text-[1.25rem] font-extrabold block mt-0.5 ${
                  totals.profit >= 0 ? 'text-blue-400' : 'text-red-400'
                }`}
              >
                {totals.profit >= 0 ? '+' : ''}
                {formatMoney(totals.profit)}
              </span>
              <span className="text-[0.7rem] text-slate-200 block mt-0.5">
                {totals.orderCount} đơn bán hàng
              </span>
            </div>
          </div>

          {/* Action Buttons: Excel & Zalo */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleShareZalo}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0068ff] hover:bg-[#0057d9] active:scale-[0.98] text-white font-extrabold text-[1rem] flex items-center justify-center gap-2.5 shadow-lg transition-transform"
            >
              <span className="text-[1.35rem]">💬</span>
              <span>Chia sẻ qua Zalo</span>
              {copied && (
                <span className="text-xs bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-bold ml-1">
                  Đã copy!
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-[1rem] flex items-center justify-center gap-2.5 shadow-lg transition-transform"
            >
              <span className="text-[1.35rem]">📥</span>
              <span>Xuất file Excel (.xlsx / .csv)</span>
            </button>
          </div>

          {/* Quick Zalo message preview card */}
          <div className="p-3 rounded-xl bg-[var(--color-dark-700)] border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.82rem] font-bold text-yellow-300">
                📝 Nội dung tóm tắt gửi Zalo:
              </span>
              <button
                type="button"
                onClick={handleShareZalo}
                className="text-[0.78rem] text-emerald-400 hover:underline font-bold"
              >
                {copied ? '✅ Đã copy' : '📋 Sao chép tin nhắn'}
              </button>
            </div>
            <pre className="text-[0.8rem] text-white bg-black/40 p-2.5 rounded-lg whitespace-pre-wrap font-sans leading-relaxed border border-white/5">
              {formatZaloMessage()}
            </pre>
          </div>

          {/* Preview Table of Orders */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.85rem] font-bold text-white">
                📋 Chi tiết đơn hàng ({transactions.length}):
              </span>
              <span className="text-[0.75rem] text-yellow-300 font-semibold">
                Đầy đủ cột xuất file
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="p-5 text-center rounded-xl bg-[var(--color-dark-700)] text-slate-200 text-sm">
                Không có đơn hàng nào trong {currentPeriodLabel.toLowerCase()}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[220px]">
                <table className="w-full text-left text-[0.78rem]">
                  <thead className="bg-[var(--color-dark-600)] text-yellow-300 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 whitespace-nowrap">Thời gian</th>
                      <th className="p-2 whitespace-nowrap">Tên món</th>
                      <th className="p-2 whitespace-nowrap text-center">SL</th>
                      <th className="p-2 whitespace-nowrap text-right">Thu thực</th>
                      <th className="p-2 whitespace-nowrap text-right">Chi phí</th>
                      <th className="p-2 whitespace-nowrap text-right">Nợ</th>
                      <th className="p-2 whitespace-nowrap text-right">Lợi nhuận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[var(--color-dark-700)]">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-white/5">
                        <td className="p-2 whitespace-nowrap text-slate-200">
                          {formatDate(t.created_at)}
                        </td>
                        <td className="p-2 font-semibold text-white whitespace-nowrap max-w-[140px] truncate">
                          {t.item_name}
                        </td>
                        <td className="p-2 text-center text-slate-200">
                          {t.computedQuantity}
                        </td>
                        <td className="p-2 text-right font-bold text-emerald-400 whitespace-nowrap">
                          {formatMoney(t.computedActualIncome)}
                        </td>
                        <td className="p-2 text-right text-orange-400 whitespace-nowrap">
                          {formatMoney(t.computedExpense)}
                        </td>
                        <td className="p-2 text-right text-rose-400 whitespace-nowrap">
                          {formatMoney(t.computedDebt)}
                        </td>
                        <td className="p-2 text-right font-bold text-blue-400 whitespace-nowrap">
                          {formatMoney(t.computedProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--color-dark-600)] font-extrabold text-white sticky bottom-0 border-t border-white/10">
                    <tr>
                      <td className="p-2 text-yellow-300" colSpan={2}>
                        TỔNG CỘNG
                      </td>
                      <td className="p-2 text-center text-yellow-300">
                        {totals.totalQuantity}
                      </td>
                      <td className="p-2 text-right text-emerald-400">
                        {formatMoney(totals.actualIncome)}
                      </td>
                      <td className="p-2 text-right text-orange-400">
                        {formatMoney(totals.costAndExpense)}
                      </td>
                      <td className="p-2 text-right text-rose-400">
                        {formatMoney(totals.debt)}
                      </td>
                      <td className="p-2 text-right text-blue-400">
                        {formatMoney(totals.profit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span>💡 Bấm nút để tải file hoặc gửi Zalo ngay</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] font-bold active:scale-95 transition-transform"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
