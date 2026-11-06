import { useState, useMemo } from 'react';
import {
  getTransactions,
  deleteTransaction,
  formatMoney,
  formatDate,
  VIETNAMESE_WEEKDAYS,
  getWeekdayInfo,
} from '../store';
import {
  IconReceipt,
  IconCart,
  IconWallet,
  IconCash,
  IconTruck,
  IconUsers,
  IconSearch,
  IconX,
  IconEdit,
  IconTrash,
  IconChart,
  IconCheck,
} from './Icons';

export default function History({ onRefresh, showToast, onEdit, onOpenReport }) {
  const allTransactions = getTransactions();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [weekdayFilter, setWeekdayFilter] = useState('ALL');

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchItem = (tx.item_name || '').toLowerCase().includes(q);
        const matchCustomer = (tx.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (tx.customer_phone || '').toLowerCase().includes(q);
        const matchTracking = (tx.tracking_code || '').toLowerCase().includes(q);
        if (!matchItem && !matchCustomer && !matchPhone && !matchTracking) return false;
      }

      if (typeFilter === 'SALE' && tx.type !== 'SALE') return false;
      if (typeFilter === 'EXPENSE' && tx.type !== 'EXPENSE') return false;
      if (typeFilter === 'DEBT_PAYMENT' && tx.type !== 'DEBT_PAYMENT') return false;
      if (typeFilter === 'COD' && (tx.payment_method !== 'COD' || tx.type !== 'SALE')) return false;
      if (typeFilter === 'DEBT' && (tx.payment_method !== 'DEBT' || tx.type !== 'SALE')) return false;

      if (weekdayFilter !== 'ALL') {
        const d = new Date(tx.created_at);
        if (isNaN(d.getTime()) || d.getDay() !== Number(weekdayFilter)) return false;
      }

      return true;
    });
  }, [allTransactions, searchQuery, typeFilter, weekdayFilter]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pendingDebt = 0;
    filteredTransactions.forEach((tx) => {
      const price = Number(tx.sale_price) || 0;
      if (tx.type === 'EXPENSE') {
        expense += price;
      } else if (tx.type === 'DEBT_PAYMENT') {
        income += price;
      } else if (tx.type === 'SALE') {
        if (tx.payment_method === 'CASH_TRANSFER') {
          income += price;
        } else if (tx.payment_method === 'COD') {
          if (tx.is_cod_received) {
            income += price;
          } else {
            pendingDebt += price;
          }
        } else if (tx.payment_method === 'DEBT') {
          pendingDebt += price;
        }
      }
    });
    return { count: filteredTransactions.length, income, expense, pendingDebt };
  }, [filteredTransactions]);

  const handleDelete = (id) => {
    deleteTransaction(id);
    setConfirmDelete(null);
    showToast('🗑️ Đã xóa giao dịch');
    onRefresh();
  };

  const getTypeInfo = (tx) => {
    if (tx.type === 'EXPENSE') {
      return { Icon: IconWallet, bg: 'rgba(234, 88, 12, 0.15)', color: '#fb923c', label: 'Chi tiền' };
    }
    if (tx.type === 'DEBT_PAYMENT') {
      return { Icon: IconCash, bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: 'Thu nợ' };
    }
    if (tx.payment_method === 'COD') {
      return { Icon: IconTruck, bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', label: 'COD' };
    }
    if (tx.payment_method === 'DEBT') {
      return { Icon: IconUsers, bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Ghi nợ' };
    }
    return { Icon: IconCart, bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', label: 'Bán hàng' };
  };

  const getPaymentBadge = (tx) => {
    if (tx.type === 'EXPENSE') return null;
    if (tx.type === 'DEBT_PAYMENT') return null;
    switch (tx.payment_method) {
      case 'COD':
        return (
          <span
            className="badge text-[10px]"
            style={{
              background: tx.is_cod_received ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: tx.is_cod_received ? '#34d399' : '#60a5fa'
            }}
          >
            {tx.is_cod_received ? 'Đã nhận COD' : 'Chờ ship COD'}
          </span>
        );
      case 'DEBT':
        return (
          <span className="badge text-[10px]" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
            Nợ
          </span>
        );
      default:
        return (
          <span className="badge text-[10px]" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
            Đã thu
          </span>
        );
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pt-1">
        <div>
          <h1 className="text-[1.25rem] font-extrabold text-white flex items-center gap-2">
            <IconReceipt className="w-5 h-5 text-emerald-400" />
            <span>Lịch Sử Đơn Hàng</span>
          </h1>
          <p className="text-[0.72rem] text-slate-400 mt-0.5">
            Tổng {summary.count} giao dịch đã ghi nhận
          </p>
        </div>
        {onOpenReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
          >
            <IconChart className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8 text-sm py-2"
          placeholder="Tìm sản phẩm, khách hàng, SĐT, mã vận đơn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <IconSearch className="w-4 h-4" />
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none text-xs">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'SALE', label: 'Bán hàng' },
          { id: 'EXPENSE', label: 'Chi tiền' },
          { id: 'DEBT_PAYMENT', label: 'Thu nợ' },
          { id: 'COD', label: 'Đơn Ship COD' },
          { id: 'DEBT', label: 'Ghi nợ' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
              typeFilter === tab.id
                ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 border-emerald-300 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Weekday Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none text-[0.72rem]">
        <button
          onClick={() => setWeekdayFilter('ALL')}
          className={`px-2.5 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all border ${
            weekdayFilter === 'ALL'
              ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white border-pink-400 shadow-sm'
              : 'bg-slate-900/60 text-slate-300 border-white/10'
          }`}
        >
          📅 Cả tuần
        </button>
        {[1, 2, 3, 4, 5, 6, 0].map((wdIdx) => {
          const wd = VIETNAMESE_WEEKDAYS[wdIdx];
          const isActive = weekdayFilter === wdIdx;
          return (
            <button
              key={wdIdx}
              onClick={() => setWeekdayFilter(isActive ? 'ALL' : wdIdx)}
              className={`px-2.5 py-1 rounded-xl font-extrabold whitespace-nowrap transition-all border ${
                isActive ? 'text-white scale-105 shadow-md' : 'text-slate-200'
              }`}
              style={{ background: isActive ? wd.color : wd.bg, borderColor: wd.border }}
            >
              {wd.label}
            </button>
          );
        })}
      </div>

      {/* Summary Box */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-gradient-to-r from-indigo-950/75 via-purple-950/75 to-pink-950/75 border border-purple-400/30 mb-3.5 text-center shadow-md">
        <div>
          <span className="text-[0.68rem] text-emerald-200 block font-semibold">Thu thực</span>
          <span className="font-extrabold text-xs text-emerald-300 block mt-0.5">{formatMoney(summary.income)}</span>
        </div>
        <div>
          <span className="text-[0.68rem] text-amber-200 block font-semibold">Nợ / Chờ thu</span>
          <span className="font-extrabold text-xs text-amber-300 block mt-0.5">{formatMoney(summary.pendingDebt)}</span>
        </div>
        <div>
          <span className="text-[0.68rem] text-rose-200 block font-semibold">Đã chi</span>
          <span className="font-extrabold text-xs text-rose-300 block mt-0.5">{formatMoney(summary.expense)}</span>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto mb-2.5 flex items-center justify-center">
            <IconReceipt className="w-6 h-6" />
          </div>
          <p className="text-white font-bold text-sm">Không có đơn hàng nào</p>
          <p className="text-slate-400 text-xs mt-1">Thử thay đổi bộ lọc thứ hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTransactions.map((tx) => {
            const info = getTypeInfo(tx);
            const TypeIcon = info.Icon;
            const wd = getWeekdayInfo(tx.created_at);
            return (
              <div key={tx.id} className="tx-card">
                <div className="tx-icon" style={{ background: info.bg, color: info.color }}>
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-white truncate">
                      {tx.item_name}
                      {tx.quantity && tx.quantity > 1 && (
                        <span className="text-emerald-400 font-bold ml-1.5 text-xs">
                          ×{tx.quantity}
                        </span>
                      )}
                    </span>
                    {getPaymentBadge(tx)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300 flex-wrap">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white"
                      style={{ background: wd.color }}
                    >
                      {wd.label}
                    </span>
                    <span>{formatDate(tx.created_at)}</span>
                    {tx.customer_name && tx.type !== 'EXPENSE' && (
                      <span className="text-amber-200 font-semibold">
                        • {tx.customer_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="font-extrabold text-sm block"
                    style={{ color: tx.type === 'EXPENSE' ? '#fb923c' : info.color }}
                  >
                    {tx.type === 'EXPENSE' ? '-' : '+'}{formatMoney(tx.sale_price)}
                  </span>
                  {/* Actions: Edit & Delete */}
                  {confirmDelete === tx.id ? (
                    <div className="flex gap-1 mt-1 justify-end">
                      <button
                        className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold"
                        onClick={() => handleDelete(tx.id)}
                      >
                        Xóa
                      </button>
                      <button
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {onEdit && tx.type === 'SALE' && (
                        <button
                          className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                          onClick={() => onEdit(tx)}
                          title="Sửa đơn hàng"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        className="p-1 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all"
                        onClick={() => setConfirmDelete(tx.id)}
                        title="Xóa giao dịch"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
