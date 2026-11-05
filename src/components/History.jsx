import { useState, useMemo } from 'react';
import { getTransactions, deleteTransaction, formatMoney, formatDate } from '../store';

export default function History({ onRefresh, showToast, onEdit, onOpenReport }) {
  const allTransactions = getTransactions();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

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

      return true;
    });
  }, [allTransactions, searchQuery, typeFilter]);

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
    if (tx.type === 'EXPENSE') return { icon: '💸', bg: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-orange-400)', label: 'Chi tiền' };
    if (tx.type === 'DEBT_PAYMENT') return { icon: '💰', bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-green-400)', label: 'Thu nợ' };
    if (tx.payment_method === 'COD') return { icon: '📦', bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-blue-400)', label: 'COD' };
    if (tx.payment_method === 'DEBT') return { icon: '📝', bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-red-400)', label: 'Ghi nợ' };
    return { icon: '🛒', bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--color-green-400)', label: 'Thu ngay' };
  };

  const getPaymentBadge = (tx) => {
    if (tx.type === 'EXPENSE') return null;
    if (tx.type === 'DEBT_PAYMENT') return null;
    switch (tx.payment_method) {
      case 'COD':
        return (
          <span
            className="badge"
            style={{
              background: tx.is_cod_received ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: tx.is_cod_received ? 'var(--color-green-400)' : 'var(--color-blue-400)'
            }}
          >
            {tx.is_cod_received ? '✅ Đã nhận' : '⏳ Chờ COD'}
          </span>
        );
      case 'DEBT':
        return (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-red-400)' }}>
            📝 Nợ
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--color-green-400)' }}>
            ✅ Đã thu
          </span>
        );
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-3 pt-2">
        <div>
          <h1 className="text-[1.35rem] font-extrabold text-white">📋 Lịch Sử Đơn</h1>
          <span className="text-[0.82rem] text-yellow-300 font-bold">
            {summary.count} giao dịch
          </span>
        </div>
        {onOpenReport && (
          <button
            type="button"
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[0.88rem] shadow-md active:scale-95 transition-all"
          >
            <span>📊</span>
            <span>Báo Cáo & Xuất File</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8"
          placeholder="Tìm món, khách, SĐT, mã vận đơn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs - Tăng font-size thêm 1-2px cho người lớn tuổi */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none text-[0.88rem]">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'SALE', label: '🛒 Bán hàng' },
          { id: 'EXPENSE', label: '💸 Chi tiền' },
          { id: 'DEBT_PAYMENT', label: '💰 Thu nợ' },
          { id: 'COD', label: '📦 Đơn Ship / COD' },
          { id: 'DEBT', label: '📝 Ghi nợ' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-colors text-[0.88rem] ${
              typeFilter === tab.id
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] border border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Box */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-dark-700)] border border-white/10 mb-3 text-[0.85rem] flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold">Thu thực:</span>
          <span className="font-extrabold text-emerald-400">{formatMoney(summary.income)}</span>
        </div>
        {summary.pendingDebt > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold">Nợ/Chờ:</span>
            <span className="font-extrabold text-amber-300">{formatMoney(summary.pendingDebt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold">Chi:</span>
          <span className="font-extrabold text-orange-400">{formatMoney(summary.expense)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold">SL:</span>
          <span className="font-extrabold text-yellow-300">{summary.count}</span>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-[2.5rem] mb-3">📭</p>
          <p className="text-[var(--color-text-muted)] text-[1.05rem]">Không có đơn hàng nào</p>
          <p className="text-[var(--color-text-muted)] text-[0.85rem] mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTransactions.map((tx) => {
            const info = getTypeInfo(tx);
            return (
              <div key={tx.id} className="tx-card">
                <div className="tx-icon" style={{ background: info.bg }}>
                  {info.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[0.95rem] truncate">
                      {tx.item_name}
                      {tx.quantity && tx.quantity > 1 && (
                        <span className="text-amber-300 font-bold ml-1.5 text-xs">
                          ×{tx.quantity}
                        </span>
                      )}
                    </span>
                    {getPaymentBadge(tx)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[0.78rem] text-slate-200 font-medium">
                      {formatDate(tx.created_at)}
                    </span>
                    {tx.customer_name && tx.type !== 'EXPENSE' && (
                      <span className="text-[0.78rem] text-yellow-300 font-semibold">
                        • {tx.customer_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="font-extrabold text-[1.05rem]"
                    style={{ color: tx.type === 'EXPENSE' ? 'var(--color-orange-400)' : info.color }}
                  >
                    {tx.type === 'EXPENSE' ? '-' : '+'}{formatMoney(tx.sale_price)}
                  </span>
                  {/* Actions: Edit & Delete */}
                  {confirmDelete === tx.id ? (
                    <div className="flex gap-1 mt-1 justify-end">
                      <button
                        className="text-[0.7rem] px-2 py-1 rounded-lg font-bold"
                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-red-400)' }}
                        onClick={() => handleDelete(tx.id)}
                      >
                        Xóa
                      </button>
                      <button
                        className="text-[0.7rem] px-2 py-1 rounded-lg font-bold"
                        style={{ background: 'var(--color-dark-500)' }}
                        onClick={() => setConfirmDelete(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {onEdit && tx.type === 'SALE' && (
                        <button
                          className="text-[0.72rem] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-[var(--color-dark-600)]"
                          onClick={() => onEdit(tx)}
                          title="Sửa đơn hàng"
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        className="text-[0.72rem] text-slate-400 hover:text-red-400 px-1.5 py-0.5 rounded bg-[var(--color-dark-600)]"
                        onClick={() => setConfirmDelete(tx.id)}
                        title="Xóa giao dịch"
                      >
                        🗑️
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
