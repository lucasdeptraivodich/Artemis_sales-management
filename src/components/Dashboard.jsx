import { useState, useEffect } from 'react';
import {
  getMonthlyStats,
  formatMoney,
  syncAllFromCloud,
  subscribeSyncStatus,
  getWeekdayActivitySummary,
  VIETNAMESE_WEEKDAYS,
} from '../store';
import { isSupabaseReady } from '../supabase';
import {
  IconCart,
  IconWallet,
  IconCash,
  IconRefresh,
  IconCloud,
  IconUser,
  IconChart,
  IconTrendingUp,
  IconTag,
  IconDatabase,
  IconChevronLeft,
  IconChevronRight,
} from './Icons';

export default function Dashboard({
  onSale,
  onExpense,
  user,
  onOpenAuth,
  onRefresh,
  onOpenCashFlow,
  onOpenReport,
  onOpenItemManager,
  onOpenBackup,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekday, setSelectedWeekday] = useState('ALL');
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const stats = getMonthlyStats(year, month);
  const weekdayGroups = getWeekdayActivitySummary({
    year,
    month,
    weekdayFilter: selectedWeekday,
  });
  const [syncing, setSyncing] = useState(false);
  const isReady = isSupabaseReady();

  useEffect(() => {
    const unsub = subscribeSyncStatus((status) => {
      setSyncing(Boolean(status?.syncing));
    });
    return unsub;
  }, []);

  const handleManualSync = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setSyncing(true);
    await syncAllFromCloud();
    setSyncing(false);
    if (onRefresh) onRefresh();
  };

  const prevMonth = () => {
    setSelectedDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(year, month + 1, 1));
  };

  const jumpToCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  const shopName = user?.user_metadata?.shop_name || user?.email?.split('@')[0] || 'Cửa hàng';

  // Collection progress calculation
  const collectionRate = stats.totalRevenue > 0
    ? Math.min(100, Math.round((stats.actualIncome / stats.totalRevenue) * 100))
    : 100;

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
            <IconCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[1.15rem] font-extrabold tracking-tight leading-tight text-white flex items-center gap-1.5">
              <span>{user ? shopName : 'Artemis POS'}</span>
            </h1>
            <p className="text-slate-400 text-[0.74rem] font-medium">
              Quản lý bán hàng & công nợ
            </p>
          </div>
        </div>

        {/* User Account Button */}
        <div className="flex items-center gap-1.5">
          {user ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleManualSync}
                title="Đồng bộ dữ liệu"
                className={`w-8 h-8 rounded-xl flex items-center justify-center bg-slate-800 text-slate-300 hover:text-emerald-400 transition-all ${
                  syncing ? 'animate-spin text-emerald-400' : ''
                }`}
              >
                <IconRefresh className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[0.78rem] font-bold hover:bg-emerald-500/20 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Đồng bộ</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/10 text-slate-300 text-[0.78rem] font-semibold hover:bg-slate-700 transition-all"
            >
              <IconCloud className="w-3.5 h-3.5 text-amber-400" />
              <span>Lưu đám mây</span>
            </button>
          )}
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-slate-900/70 px-3 py-2 rounded-2xl mb-3.5 border border-white/5 backdrop-blur-md">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
          title="Tháng trước"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <span className="font-extrabold text-[0.92rem] text-white">
            Tháng {month + 1} / {year}
          </span>
          {!isCurrentMonth && (
            <button
              onClick={jumpToCurrentMonth}
              className="block text-[0.68rem] text-emerald-400 hover:underline mx-auto mt-0.5 font-semibold"
            >
              Về tháng hiện tại
            </button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
          title="Tháng sau"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Warning banner if not logged in */}
      {!user && (
        <div
          onClick={onOpenAuth}
          className="mb-3.5 p-3 rounded-2xl cursor-pointer transition-transform active:scale-[0.99] flex items-center justify-between gap-3 shadow-md bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <IconCloud className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[0.82rem] text-amber-200 leading-snug">
                Chưa đồng bộ tài khoản đám mây
              </p>
              <p className="text-[0.72rem] text-slate-400 mt-0.5">
                Nhấn để lưu dữ liệu an toàn tránh mất mát
              </p>
            </div>
          </div>
          <span className="text-[0.75rem] px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold whitespace-nowrap shadow-sm">
            Kết nối
          </span>
        </div>
      )}

      {/* Hero Financial Card */}
      <div className="bg-gradient-to-br from-indigo-950/90 via-purple-950/85 to-teal-950/85 border border-purple-400/30 rounded-3xl p-4 mb-3.5 shadow-xl shadow-purple-950/50 backdrop-blur-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-fuchsia-500/25 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10" />

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.72rem] font-extrabold tracking-wider text-cyan-300 uppercase">
              ✨ Thu thực nhận (Tiền vào ví)
            </span>
            <span className="text-[0.72rem] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 text-emerald-300 font-bold border border-emerald-400/40 shadow-sm">
              {stats.transactionCount} đơn hàng
            </span>
          </div>

          <div className="text-[2.1rem] font-black tracking-tight bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent leading-none my-1.5 drop-shadow">
            {formatMoney(stats.actualIncome)}
          </div>

          {/* Progress bar: Collection rate */}
          <div className="mt-2.5 mb-3">
            <div className="flex justify-between text-[0.72rem] text-slate-300 mb-1">
              <span>Thu hồi: <strong className="text-amber-300">{collectionRate}%</strong></span>
              <span>Tổng doanh thu: <strong className="text-emerald-300">{formatMoney(stats.totalRevenue)}</strong></span>
            </div>
            <div className="w-full h-2 bg-slate-950/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, collectionRate)}%` }}
              />
            </div>
          </div>

          {/* Sub 3-stats inside Hero Card */}
          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/15 text-center">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-400/30">
              <span className="text-[0.68rem] text-rose-200 block font-semibold">Nợ chưa thu</span>
              <span className="text-[0.9rem] font-extrabold text-rose-300 block mt-0.5">
                {formatMoney(stats.totalDebt)}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30">
              <span className="text-[0.68rem] text-amber-200 block font-semibold">Chi phí & Vốn</span>
              <span className="text-[0.9rem] font-extrabold text-amber-300 block mt-0.5">
                {formatMoney(stats.totalCost + stats.totalExpense)}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30">
              <span className="text-[0.68rem] text-cyan-200 block font-semibold">Lợi nhuận</span>
              <span className={`text-[0.9rem] font-extrabold block mt-0.5 ${stats.profit >= 0 ? 'text-cyan-300' : 'text-rose-300'}`}>
                {stats.profit >= 0 ? '+' : ''}{formatMoney(stats.profit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <button
          className="btn-giant btn-sale py-3 px-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
          onClick={onSale}
        >
          <IconCart className="w-5 h-5 text-white" />
          <span className="font-extrabold text-[0.95rem] tracking-wide">+ BÁN HÀNG</span>
        </button>

        <button
          className="btn-giant btn-expense py-3 px-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-950/30"
          onClick={onExpense}
        >
          <IconWallet className="w-5 h-5 text-white" />
          <span className="font-extrabold text-[0.95rem] tracking-wide">+ GHI CHI</span>
        </button>
      </div>

      {/* Feature Tools Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[0.74rem] font-extrabold text-fuchsia-300 uppercase tracking-wider">
            🌈 Tiện ích & Báo cáo
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {onOpenReport && (
            <button
              type="button"
              onClick={onOpenReport}
              className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-600/25 to-teal-700/25 hover:from-emerald-600/40 hover:to-teal-700/40 border border-emerald-400/35 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-center shadow-md shadow-emerald-950/40"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/30 text-emerald-300 flex items-center justify-center shadow-inner">
                <IconChart className="w-4 h-4" />
              </div>
              <span className="text-[0.72rem] font-bold text-emerald-100 leading-tight">Báo Cáo</span>
            </button>
          )}

          {onOpenCashFlow && (
            <button
              type="button"
              onClick={onOpenCashFlow}
              className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-600/25 to-blue-700/25 hover:from-sky-600/40 hover:to-blue-700/40 border border-sky-400/35 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-center shadow-md shadow-sky-950/40"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500/30 text-sky-300 flex items-center justify-center shadow-inner">
                <IconTrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[0.72rem] font-bold text-sky-100 leading-tight">Dòng Tiền</span>
            </button>
          )}

          {onOpenItemManager && (
            <button
              type="button"
              onClick={onOpenItemManager}
              className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-600/25 hover:from-amber-500/40 hover:to-orange-600/40 border border-amber-400/35 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-center shadow-md shadow-amber-950/40"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center shadow-inner">
                <IconTag className="w-4 h-4" />
              </div>
              <span className="text-[0.72rem] font-bold text-amber-100 leading-tight">Món Hàng</span>
            </button>
          )}

          {onOpenBackup && (
            <button
              type="button"
              onClick={onOpenBackup}
              className="p-2.5 rounded-2xl bg-gradient-to-br from-fuchsia-600/25 to-purple-700/25 hover:from-fuchsia-600/40 hover:to-purple-700/40 border border-fuchsia-400/35 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-center shadow-md shadow-purple-950/40"
            >
              <div className="w-8 h-8 rounded-xl bg-fuchsia-500/30 text-fuchsia-300 flex items-center justify-center shadow-inner">
                <IconDatabase className="w-4 h-4" />
              </div>
              <span className="text-[0.72rem] font-bold text-fuchsia-100 leading-tight">Sao Lưu</span>
            </button>
          )}
        </div>
      </div>

      {/* Nhật Ký Theo Thứ: Thứ mấy bán được gì, chi tiêu gì */}
      <div className="mb-4 bg-gradient-to-br from-indigo-950/75 via-purple-950/65 to-slate-900/80 border border-purple-400/30 rounded-3xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h3 className="text-[0.85rem] font-extrabold text-white flex items-center gap-1.5">
              <span>📅</span>
              <span className="bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                Thứ Mấy Bán Gì & Chi Tiêu Gì
              </span>
            </h3>
            <p className="text-[0.68rem] text-slate-300">Chọn thứ để xem chi tiết món bán & khoản chi</p>
          </div>
          <span className="text-[0.68rem] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/30 font-bold">
            {weekdayGroups.length} ngày
          </span>
        </div>

        {/* 7 Weekday Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2.5">
          <button
            type="button"
            onClick={() => setSelectedWeekday('ALL')}
            className={`px-2.5 py-1 rounded-xl text-[0.72rem] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedWeekday === 'ALL'
                ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md scale-105'
                : 'bg-slate-800/70 text-slate-300 border border-white/10'
            }`}
          >
            Tất cả
          </button>
          {[1, 2, 3, 4, 5, 6, 0].map((wdIdx) => {
            const wd = VIETNAMESE_WEEKDAYS[wdIdx];
            const isActive = selectedWeekday === wdIdx;
            return (
              <button
                key={wdIdx}
                type="button"
                onClick={() => setSelectedWeekday(isActive ? 'ALL' : wdIdx)}
                className={`px-2.5 py-1 rounded-xl text-[0.72rem] font-extrabold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive ? 'text-white scale-105 shadow-md' : 'text-slate-200'
                }`}
                style={{ background: isActive ? wd.color : wd.bg, borderColor: wd.border }}
              >
                {wd.label}
              </button>
            );
          })}
        </div>

        {weekdayGroups.length === 0 ? (
          <div className="text-center py-5 bg-slate-950/40 rounded-2xl border border-white/5">
            <p className="text-xs text-slate-300 font-semibold">Chưa có giao dịch bán hàng hay chi tiêu vào thứ này</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
            {weekdayGroups.slice(0, 10).map((g) => (
              <div key={g.dateKey} className="p-3 rounded-2xl bg-slate-950/65 border" style={{ borderColor: g.border }}>
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[0.72rem] font-extrabold text-white" style={{ background: g.color }}>
                      {g.weekdayLabel}
                    </span>
                    <span className="text-xs font-bold text-slate-200">Ngày {g.displayDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[0.72rem] font-extrabold">
                    {g.totalSales > 0 && <span className="text-emerald-300">+{formatMoney(g.totalSales)}</span>}
                    {g.totalExpenses > 0 && <span className="text-orange-300">-{formatMoney(g.totalExpenses)}</span>}
                  </div>
                </div>

                <div className="mb-1.5">
                  <div className="text-[0.7rem] font-bold text-emerald-300 mb-1">🛒 Bán được ({g.salesList.length} đơn):</div>
                  {g.salesList.length === 0 ? (
                    <span className="text-[0.7rem] text-slate-400 italic pl-4">Không có đơn bán</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {g.salesList.map((s) => (
                        <span key={s.id} className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[0.7rem] text-emerald-100 font-semibold">
                          {s.item_name}{s.quantity > 1 ? ` ×${s.quantity}` : ''}: <strong className="text-amber-300">{formatMoney(s.amount)}</strong>
                          {s.customer_name && s.customer_name !== 'Khách lẻ' ? ` (${s.customer_name})` : ''}
                          {s.payment_method === 'DEBT' ? ' [Nợ]' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[0.7rem] font-bold text-pink-300 mb-1">💸 Chi tiêu ({g.expensesList.length} khoản):</div>
                  {g.expensesList.length === 0 ? (
                    <span className="text-[0.7rem] text-slate-400 italic pl-4">Không có khoản chi</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {g.expensesList.map((e) => (
                        <span key={e.id} className="px-2 py-0.5 rounded-lg bg-pink-500/15 border border-pink-400/30 text-[0.7rem] text-pink-100 font-semibold">
                          {e.item_name}: <strong className="text-orange-300">-{formatMoney(e.amount)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Quick Summary Card */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Số đơn tháng này:</span>
          <span className="font-bold text-white">{stats.transactionCount} đơn</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Doanh thu phát sinh:</span>
          <span className="font-bold text-emerald-400">{formatMoney(stats.totalRevenue)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Chi phí nhập hàng & phụ phí:</span>
          <span className="font-bold text-amber-400">{formatMoney(stats.totalCost + stats.totalExpense)}</span>
        </div>
      </div>
    </div>
  );
}
