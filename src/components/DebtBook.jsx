import { useState, useMemo } from 'react';
import { getCustomers, getCustomerDebtHistory, payDebt, formatMoney, formatDate } from '../store';
import {
  IconUsers,
  IconSearch,
  IconX,
  IconPlus,
  IconEdit,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconCash,
} from './Icons';

export default function DebtBook({ onRefresh, showToast, onAddCustomer, onEditCustomer }) {
  const allCustomers = getCustomers();
  const [filter, setFilter] = useState('owing'); // 'owing' | 'settled' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [showPayForm, setShowPayForm] = useState(null);

  const filteredCustomers = useMemo(() => {
    return allCustomers.filter((c) => {
      // 1. Status Filter
      if (filter === 'owing' && c.total_debt <= 0) return false;
      if (filter === 'settled' && c.total_debt > 0) return false;

      // 2. Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.name || '').toLowerCase().includes(q);
        const matchPhone = (c.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }

      return true;
    });
  }, [allCustomers, filter, searchQuery]);

  const totalDebt = allCustomers.reduce((sum, c) => sum + (c.total_debt || 0), 0);
  const owingCount = allCustomers.filter((c) => c.total_debt > 0).length;
  const settledCount = allCustomers.filter((c) => c.total_debt <= 0).length;

  const handlePay = (customerId) => {
    const amount = parseInt(payAmount) || 0;
    if (amount <= 0) return;

    const res = payDebt(customerId, amount, payNote.trim());
    setPayAmount('');
    setPayNote('');
    setShowPayForm(null);
    if (res && res.last_change_amount > 0) {
      showToast(`✅ Đã thu nợ! Tiền thừa trả khách: ${formatMoney(res.last_change_amount)}`);
    } else {
      showToast('✅ Đã ghi thu nợ!');
    }
    onRefresh();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
    setShowPayForm(null);
    setPayAmount('');
    setPayNote('');
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3 pt-1">
        <div>
          <h1 className="text-[1.25rem] font-extrabold text-white flex items-center gap-2">
            <IconUsers className="w-5 h-5 text-rose-400" />
            <span>Sổ Nợ Khách Hàng</span>
          </h1>
          <p className="text-[0.72rem] text-slate-400 mt-0.5">
            {owingCount} người mua đang còn ghi nợ
          </p>
        </div>
        {onAddCustomer && (
          <button
            onClick={onAddCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-all"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Thêm Khách</span>
          </button>
        )}
      </div>

      {/* Total debt banner */}
      <div className="bg-gradient-to-r from-rose-950/40 to-slate-900/80 border border-rose-500/30 rounded-2xl p-3.5 mb-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[0.72rem] font-bold text-slate-300 uppercase tracking-wider block">
            Tổng nợ chưa thu
          </span>
          <p className="text-xs text-rose-300/80 mt-0.5">{owingCount} khách hàng đang nợ</p>
        </div>
        <span className="text-[1.4rem] font-black text-rose-400">
          {formatMoney(totalDebt)}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8 text-sm py-2"
          placeholder="Tìm tên khách hoặc số điện thoại..."
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
      <div className="flex gap-1.5 mb-3 text-xs">
        <button
          onClick={() => setFilter('owing')}
          className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
            filter === 'owing'
              ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-white/5'
          }`}
        >
          Đang nợ ({owingCount})
        </button>
        <button
          onClick={() => setFilter('settled')}
          className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
            filter === 'settled'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-white/5'
          }`}
        >
          Đã xong ({settledCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
            filter === 'all'
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-white/5'
          }`}
        >
          Tất cả ({allCustomers.length})
        </button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto mb-2.5 flex items-center justify-center">
            <IconUsers className="w-6 h-6" />
          </div>
          <p className="text-white font-bold text-sm">Không có khách hàng nào</p>
          <p className="text-slate-400 text-xs mt-1">
            {filter === 'owing' ? 'Tất cả khách đã thanh toán hết nợ!' : 'Thử thay đổi bộ lọc hoặc thêm khách mới.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedId === customer.id;
            const history = isExpanded ? getCustomerDebtHistory(customer.name) : [];

            return (
              <div key={customer.id}>
                {/* Customer Card */}
                <div
                  className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(customer.id)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-white truncate">{customer.name}</p>
                      {onEditCustomer && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCustomer(customer);
                          }}
                          title="Sửa thông tin khách"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                        >
                          <IconEdit className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {customer.phone && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {customer.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p
                        className="font-black text-sm"
                        style={{
                          color: customer.total_debt > 0 ? '#f87171' : '#34d399',
                        }}
                      >
                        {formatMoney(customer.total_debt)}
                      </p>
                      <span className="text-[10px] text-slate-500 block">
                        {customer.total_debt > 0 ? 'Còn nợ' : 'Đã trả hết'}
                      </span>
                    </div>
                    <div className="text-slate-500 pl-1">
                      {isExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="mt-1.5 rounded-2xl p-3 bg-slate-950/60 border border-white/5 animate-fadeIn">
                    <p className="text-[0.72rem] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Lịch sử mua nợ & thanh toán
                    </p>
                    {history.length > 0 ? (
                      <div className="flex flex-col gap-1.5 mb-3">
                        {history.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                            <div>
                              <span className={tx.type === 'DEBT_PAYMENT' ? 'text-emerald-400 font-bold' : 'text-slate-200'}>
                                {tx.type === 'DEBT_PAYMENT' ? 'Thu nợ' : tx.item_name}
                              </span>
                              <span className="text-[10px] text-slate-500 ml-1.5">
                                {formatDate(tx.created_at)}
                              </span>
                            </div>
                            <span
                              className="font-bold text-xs"
                              style={{
                                color: tx.type === 'DEBT_PAYMENT' ? '#34d399' : '#f87171'
                              }}
                            >
                              {tx.type === 'DEBT_PAYMENT' ? '-' : '+'}{formatMoney(tx.sale_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mb-3">
                        Chưa có lịch sử giao dịch
                      </p>
                    )}

                    {/* Pay debt button / form */}
                    {customer.total_debt > 0 && (
                      <>
                        {showPayForm === customer.id ? (
                          <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-white/10">
                            <input
                              className="input-field text-center font-extrabold text-base py-1.5 text-emerald-400"
                              type="number"
                              inputMode="numeric"
                              placeholder="Nhập số tiền trả..."
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              autoFocus
                            />
                            <input
                              className="input-field text-xs py-1.5"
                              placeholder="Ghi chú (chuyển khoản, tiền mặt...)"
                              value={payNote}
                              onChange={(e) => setPayNote(e.target.value)}
                            />
                            <div className="flex gap-1.5">
                              <button
                                className="flex-1 py-2 rounded-xl font-bold text-xs bg-emerald-500 text-slate-950 flex items-center justify-center gap-1 hover:bg-emerald-400 disabled:opacity-40 transition-all"
                                onClick={() => handlePay(customer.id)}
                                disabled={!(parseInt(payAmount) > 0)}
                              >
                                <IconCheck className="w-4 h-4" />
                                <span>Xác nhận thu</span>
                              </button>
                              <button
                                className="py-2 px-3 rounded-xl font-bold text-xs bg-slate-800 text-slate-400 hover:text-white"
                                onClick={() => {
                                  setShowPayForm(null);
                                  setPayAmount('');
                                  setPayNote('');
                                }}
                              >
                                Hủy
                              </button>
                            </div>
                            {/* Quick amount buttons */}
                            <div className="flex gap-1 flex-wrap pt-1">
                              {[50000, 100000, 200000, customer.total_debt].map((amt, i) => (
                                <button
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 border border-white/5 text-slate-300 hover:text-white"
                                  onClick={() => setPayAmount(amt.toString())}
                                >
                                  {i === 3 ? 'Trả hết toàn bộ' : formatMoney(amt)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <button
                            className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            onClick={() => setShowPayForm(customer.id)}
                          >
                            <IconCash className="w-4 h-4" />
                            <span>+ THU NỢ KHÁCH NÀY</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
