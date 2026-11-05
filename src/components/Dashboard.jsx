import { useState, useEffect } from 'react';
import { getMonthlyStats, formatMoney, syncAllFromCloud, subscribeSyncStatus } from '../store';
import { isSupabaseReady } from '../supabase';

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
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const stats = getMonthlyStats(year, month);
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

  return (
    <div className="page-container">
      {/* Top Bar with Account & Cloud Status */}
      <div className="flex items-center justify-between mb-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg shadow-md">
            📒
          </div>
          <div>
            <h1 className="text-[1.2rem] font-extrabold tracking-tight leading-tight text-white">
              {user ? shopName : 'Artemis'}
            </h1>
            <p className="text-yellow-300 text-[0.8rem] font-medium">
              Quản Lý Bán Hàng & Dòng Tiền
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
                className={`w-9 h-9 rounded-full flex items-center justify-center bg-[var(--color-dark-600)] text-sm transition-transform ${
                  syncing ? 'animate-spin text-green-400' : 'text-white hover:text-emerald-300'
                }`}
              >
                🔄
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-[0.82rem] font-bold hover:bg-emerald-900/60 transition-all shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Online</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-300 text-[0.82rem] font-bold hover:bg-amber-500/30 transition-all shadow-sm"
            >
              <span>🔐</span>
              <span>Lưu lên mạng</span>
            </button>
          )}
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-[var(--color-dark-700)] p-2 rounded-xl mb-3 border border-[var(--color-dark-500)]">
        <button
          onClick={prevMonth}
          className="px-2.5 py-1 rounded-lg bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-xs font-bold active:scale-95 transition-transform"
        >
          ◀ Tháng {month === 0 ? 12 : month}
        </button>
        <div className="text-center">
          <span className="font-extrabold text-[0.95rem] text-amber-300">
            Tháng {month + 1} / {year}
          </span>
          {!isCurrentMonth && (
            <button
              onClick={jumpToCurrentMonth}
              className="block text-[0.68rem] text-slate-400 hover:text-emerald-400 underline mx-auto mt-0.5"
            >
              Về tháng hiện tại
            </button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="px-2.5 py-1 rounded-lg bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-xs font-bold active:scale-95 transition-transform"
        >
          Tháng {month === 11 ? 1 : month + 2} ▶
        </button>
      </div>

      {/* Warning banner if not logged in */}
      {!user && (
        <div
          onClick={onOpenAuth}
          className="mb-5 p-3 rounded-2xl cursor-pointer transition-transform active:scale-[0.99] flex items-center justify-between gap-3 shadow-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.22) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[1.4rem]">☁️</span>
            <div>
              <p className="font-extrabold text-[0.88rem] text-amber-200 leading-snug">
                Đăng nhập để tránh thất lạc dữ liệu
              </p>
              <p className="text-[0.78rem] text-yellow-300 font-semibold mt-0.5">
                Dữ liệu được tự động lưu an toàn online
              </p>
            </div>
          </div>
          <span className="text-[0.78rem] px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold whitespace-nowrap shadow">
            Đăng ký
          </span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="glass-card p-3 mb-3">
        <div className="flex gap-2">
          {/* Thu nhập thực nhận */}
          <div className="stat-card" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
            <div className="stat-value" style={{ color: 'var(--color-green-400)' }}>
              {formatMoney(stats.actualIncome)}
            </div>
            <div className="stat-label" style={{ color: 'var(--color-green-400)' }}>
              💰 Thu thực
            </div>
          </div>

          {/* Tổng nợ */}
          <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <div className="stat-value" style={{ color: 'var(--color-red-400)' }}>
              {formatMoney(stats.totalDebt)}
            </div>
            <div className="stat-label" style={{ color: 'var(--color-red-400)' }}>
              📝 Nợ chưa thu
            </div>
          </div>

          {/* Lợi nhuận */}
          <div className="stat-card" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <div
              className="stat-value"
              style={{ color: stats.profit >= 0 ? 'var(--color-blue-400)' : 'var(--color-red-400)' }}
            >
              {stats.profit >= 0 ? '+' : ''}
              {formatMoney(stats.profit)}
            </div>
            <div className="stat-label" style={{ color: 'var(--color-blue-400)' }}>
              📊 Lợi nhuận
            </div>
          </div>
        </div>
      </div>

      {/* Feature Tools Bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {onOpenCashFlow && (
          <button
            type="button"
            onClick={onOpenCashFlow}
            className="p-2.5 rounded-xl bg-[var(--color-dark-700)] hover:bg-[var(--color-dark-600)] border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center shadow-sm"
          >
            <span className="text-[1.3rem]">📈</span>
            <span className="text-[0.78rem] font-extrabold text-white leading-tight">Dòng Tiền</span>
          </button>
        )}

        {onOpenReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="p-2.5 rounded-xl bg-[var(--color-dark-700)] hover:bg-[var(--color-dark-600)] border border-emerald-500/30 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center shadow-sm"
          >
            <span className="text-[1.3rem]">📊</span>
            <span className="text-[0.78rem] font-extrabold text-emerald-300 leading-tight">Báo Cáo</span>
          </button>
        )}

        {onOpenItemManager && (
          <button
            type="button"
            onClick={onOpenItemManager}
            className="p-2.5 rounded-xl bg-[var(--color-dark-700)] hover:bg-[var(--color-dark-600)] border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center shadow-sm"
          >
            <span className="text-[1.3rem]">🏷️</span>
            <span className="text-[0.78rem] font-extrabold text-white leading-tight">Món Hàng</span>
          </button>
        )}

        {onOpenBackup && (
          <button
            type="button"
            onClick={onOpenBackup}
            className="p-2.5 rounded-xl bg-[var(--color-dark-700)] hover:bg-[var(--color-dark-600)] border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center shadow-sm"
          >
            <span className="text-[1.3rem]">💾</span>
            <span className="text-[0.78rem] font-extrabold text-white leading-tight">Sao Lưu</span>
          </button>
        )}
      </div>

      {/* Big Action Buttons */}
      <div className="flex flex-col gap-3">
        <button className="btn-giant btn-sale" onClick={onSale}>
          <span className="text-[1.8rem]">🛒</span>
          <span>+ BÁN HÀNG</span>
        </button>

        <button className="btn-giant btn-expense" onClick={onExpense}>
          <span className="text-[1.8rem]">💸</span>
          <span>+ GHI CHI TIỀN</span>
        </button>
      </div>

      {/* Quick Summary */}
      <div className="glass-card p-4 mt-5">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-secondary)] text-[0.88rem]">
            📦 Đơn tháng này
          </span>
          <span className="font-bold text-[1.05rem]">
            {stats.transactionCount} đơn
          </span>
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[var(--color-text-secondary)] text-[0.88rem]">
            💵 Doanh thu
          </span>
          <span className="font-bold text-[1.05rem] text-[var(--color-green-400)]">
            {formatMoney(stats.totalRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[var(--color-text-secondary)] text-[0.88rem]">
            📤 Chi phí
          </span>
          <span className="font-bold text-[1.05rem] text-[var(--color-orange-400)]">
            {formatMoney(stats.totalCost + stats.totalExpense)}
          </span>
        </div>
      </div>
    </div>
  );
}
