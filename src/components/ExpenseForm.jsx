import { useState } from 'react';
import { addTransaction } from '../store';

const EXPENSE_CATEGORIES = [
  { name: 'Nhập hàng', icon: '📦' },
  { name: 'Phí ship', icon: '🚚' },
  { name: 'Bao bì/Đóng gói', icon: '🎁' },
  { name: 'Tiền điện/Nước', icon: '💡' },
  { name: 'Ăn uống', icon: '🍜' },
  { name: 'Khác...', icon: '📝' },
];

export default function ExpenseForm({ onClose, onComplete }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const name = selectedCategory?.name === 'Khác...' ? customName : selectedCategory?.name || '';
    const price = parseInt(amount) || 0;

    if (!name || price <= 0) return;

    addTransaction({
      type: 'EXPENSE',
      item_name: name,
      sale_price: price,
      cost_price: 0,
      payment_method: 'CASH_TRANSFER',
      customer_name: note,
    });

    onComplete();
  };

  const isCustom = selectedCategory?.name === 'Khác...';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.3rem] font-extrabold">💸 Ghi Chi Tiền</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[1.3rem] bg-[var(--color-dark-500)] active:scale-90 transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Category Selection */}
        <div className="mb-5">
          <p className="section-title">① Chi tiền cho việc gì?</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_CATEGORIES.map(cat => (
              <button
                key={cat.name}
                className={`item-chip flex items-center gap-2 justify-center ${
                  selectedCategory?.name === cat.name ? 'selected' : ''
                }`}
                onClick={() => setSelectedCategory(cat)}
                style={selectedCategory?.name === cat.name ? {
                  borderColor: 'var(--color-orange-400)',
                  background: 'rgba(249, 115, 22, 0.15)',
                  color: 'var(--color-orange-400)'
                } : {}}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom name */}
        {isCustom && (
          <div className="mb-4">
            <input
              className="input-field"
              placeholder="Chi tiền cho..."
              value={customName}
              onChange={e => setCustomName(e.target.value)}
            />
          </div>
        )}

        {/* Amount */}
        {selectedCategory && (
          <div className="mb-5">
            <p className="section-title">② Số tiền</p>
            <input
              className="input-field text-[1.2rem] font-bold"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ textAlign: 'center' }}
            />
          </div>
        )}

        {/* Note */}
        {selectedCategory && (
          <div className="mb-5">
            <input
              className="input-field"
              placeholder="Ghi chú thêm (nếu có)..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        )}

        {/* Submit */}
        {selectedCategory && (
          <button
            className="btn-giant btn-expense mt-2"
            onClick={handleSubmit}
            disabled={!(parseInt(amount) > 0) || (isCustom && !customName)}
            style={{
              opacity: (!(parseInt(amount) > 0) || (isCustom && !customName)) ? 0.5 : 1
            }}
          >
            ✅ GHI CHI TIỀN
          </button>
        )}
      </div>
    </div>
  );
}
