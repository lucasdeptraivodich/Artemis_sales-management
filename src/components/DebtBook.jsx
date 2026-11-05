import { useState, useMemo } from 'react';
import { getCustomers, getCustomerDebtHistory, payDebt, formatMoney, formatDate } from '../store';

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
      <div className="flex items-center justify-between mb-3 pt-2">
        <h1 className="text-[1.3rem] font-extrabold">👥 Sổ Nợ</h1>
        {onAddCustomer && (
          <button
            onClick={onAddCustomer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[0.82rem] shadow active:scale-95 transition-transform"
          >
            <span>+</span>
            <span>Thêm Khách Nợ</span>
          </button>
        )}
      </div>

      {/* Total debt banner */}
      <div
        className="glass-card p-3.5 mb-3 flex items-center justify-between"
        style={{ borderLeft: '4px solid var(--color-red-500)' }}
      >
        <div>
          <span className="text-[0.9rem] font-bold text-white">Tổng nợ chưa thu</span>
          <p className="text-[0.8rem] text-yellow-300 font-semibold">{owingCount} khách hàng đang nợ</p>
        </div>
        <span className="text-[1.35rem] font-extrabold" style={{ color: 'var(--color-red-400)' }}>
          {formatMoney(totalDebt)}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8"
          placeholder="Tìm tên khách hoặc số điện thoại..."
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
      <div className="flex gap-2 mb-3 text-[0.88rem]">
        <button
          onClick={() => setFilter('owing')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold transition-all border ${
            filter === 'owing'
              ? 'bg-red-500 text-white border-red-400 shadow-md'
              : 'bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] border-white/10'
          }`}
        >
          Đang nợ ({owingCount})
        </button>
        <button
          onClick={() => setFilter('settled')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold transition-all border ${
            filter === 'settled'
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
              : 'bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] border-white/10'
          }`}
        >
          Đã xong ({settledCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2.5 rounded-xl font-extrabold transition-all border ${
            filter === 'all'
              ? 'bg-blue-600 text-white border-blue-400 shadow-md'
              : 'bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] border-white/10'
          }`}
        >
          Tất cả ({allCustomers.length})
        </button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-[2.5rem] mb-3">🎉</p>
          <p className="text-[var(--color-text-muted)] text-[1.05rem]">Không có khách hàng nào</p>
          <p className="text-[var(--color-text-muted)] text-[0.85rem] mt-1">
            {filter === 'owing' ? 'Tất cả khách đã thanh toán hết nợ!' : 'Thử thay đổi bộ lọc hoặc thêm khách mới.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedId === customer.id;
            const history = isExpanded ? getCustomerDebtHistory(customer.name) : [];

            return (
              <div key={customer.id}>
                {/* Customer Card */}
                <div className="debt-card" onClick={() => toggleExpand(customer.id)}>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[1.05rem] truncate">{customer.name}</p>
                      {onEditCustomer && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCustomer(customer);
                          }}
                          title="Sửa thông tin khách"
                          className="w-6 h-6 rounded bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] flex items-center justify-center text-[0.72rem] text-slate-300"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                    {customer.phone && (
                      <p className="text-[0.8rem] text-[var(--color-text-muted)] mt-0.5">
                        📱 {customer.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className="font-extrabold text-[1.15rem]"
                      style={{
                        color: customer.total_debt > 0 ? 'var(--color-red-400)' : 'var(--color-green-400)',
                      }}
                    >
                      {formatMoney(customer.total_debt)}
                    </p>
                    <p className="text-[0.7rem] text-[var(--color-text-muted)]">
                      {isExpanded ? '▲ Thu gọn' : '▼ Chi tiết'}
                    </p>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div
                    className="mt-2 rounded-xl p-4"
                    style={{
                      background: 'rgba(35, 35, 64, 0.5)',
                      border: '1px solid rgba(255,255,255,0.04)'
                    }}
                  >
                    {/* Debt history */}
                    <p className="text-[0.8rem] font-bold text-[var(--color-text-muted)] mb-2">
                      Lịch sử mua nợ
                    </p>
                    {history.length > 0 ? (
                      <div className="flex flex-col gap-2 mb-4">
                        {history.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between text-[0.85rem]">
                            <div>
                              <span className="text-[var(--color-text-secondary)]">
                                {tx.type === 'DEBT_PAYMENT' ? '✅ Thu nợ' : tx.item_name}
                              </span>
                              <span className="text-[0.72rem] text-[var(--color-text-muted)] ml-2">
                                {formatDate(tx.created_at)}
                              </span>
                            </div>
                            <span
                              className="font-bold"
                              style={{
                                color: tx.type === 'DEBT_PAYMENT'
                                  ? 'var(--color-green-400)'
                                  : 'var(--color-red-400)'
                              }}
                            >
                              {tx.type === 'DEBT_PAYMENT' ? '-' : '+'}{formatMoney(tx.sale_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.8rem] text-[var(--color-text-muted)] mb-4">
                        Chưa có lịch sử
                      </p>
                    )}

                    {/* Pay debt button / form */}
                    {customer.total_debt > 0 && (
                      <>
                        {showPayForm === customer.id ? (
                          <div className="flex flex-col gap-3">
                            <input
                              className="input-field text-center font-bold text-[1.1rem]"
                              type="number"
                              inputMode="numeric"
                              placeholder="Nhập số tiền trả..."
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              autoFocus
                            />
                            <input
                              className="input-field"
                              placeholder="Ghi chú (chuyển khoản, tiền mặt...)"
                              value={payNote}
                              onChange={(e) => setPayNote(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                className="flex-1 py-3 rounded-xl font-bold text-[1rem]"
                                style={{
                                  background: 'linear-gradient(135deg, var(--color-green-600), var(--color-green-500))',
                                  color: 'white',
                                  opacity: !(parseInt(payAmount) > 0) ? 0.5 : 1,
                                }}
                                onClick={() => handlePay(customer.id)}
                                disabled={!(parseInt(payAmount) > 0)}
                              >
                                ✅ Xác nhận thu
                              </button>
                              <button
                                className="py-3 px-5 rounded-xl font-bold text-[0.9rem]"
                                style={{ background: 'var(--color-dark-500)' }}
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
                            <div className="flex gap-2 flex-wrap">
                              {[50000, 100000, 200000, customer.total_debt].map((amt, i) => (
                                <button
                                  key={i}
                                  className="item-chip text-[0.8rem] flex-1"
                                  onClick={() => setPayAmount(amt.toString())}
                                >
                                  {i === 3 ? 'Trả hết' : formatMoney(amt)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <button
                            className="w-full py-3.5 rounded-xl font-bold text-[1.05rem]"
                            style={{
                              background: 'linear-gradient(135deg, var(--color-green-600), var(--color-green-500))',
                              color: 'white',
                              boxShadow: '0 4px 16px var(--color-green-glow)',
                            }}
                            onClick={() => setShowPayForm(customer.id)}
                          >
                            💰 + THU NỢ
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
