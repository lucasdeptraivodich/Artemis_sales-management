import { useState } from 'react';
import { addTransaction } from '../store';
import { IconWallet, IconX, IconCheck } from './Icons';

function formatCurrencyDisplay(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
}

function handleCurrencyChange(e, currentDigits, setter) {
  const inputVal = e.target.value;
  if (!inputVal.trim()) {
    setter('');
    return;
  }
  const currentFormatted = formatCurrencyDisplay(currentDigits);
  const newDigits = inputVal.replace(/\D/g, '');

  if (inputVal.length < currentFormatted.length && newDigits === currentDigits) {
    setter(currentDigits.slice(0, -1));
    return;
  }

  setter(newDigits);
}

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
  const numericAmount = parseInt(amount) || 0;
  const isValid = selectedCategory && numericAmount > 0 && (!isCustom || customName.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <IconWallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[1.15rem] font-extrabold text-white leading-tight">Ghi Nhận Khoản Chi</h2>
              <p className="text-[0.72rem] text-slate-400">Trừ trực tiếp vào dòng tiền kinh doanh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-90 transition-all"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Category Selection */}
        <div className="mb-3.5 bg-slate-900/60 p-3 rounded-2xl border border-white/5">
          <label className="text-[0.78rem] font-semibold text-slate-300 mb-2 block">
            ① Chi cho mục đích gì?
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                  selectedCategory?.name === cat.name
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/60 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-white/5 hover:text-white hover:bg-slate-700'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Custom name if 'Khác...' */}
          {isCustom && (
            <div className="mt-2.5">
              <input
                className="input-field text-sm py-1.5"
                placeholder="Nhập tên khoản chi..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Amount */}
        {selectedCategory && (
          <div className="mb-3.5 bg-slate-900/60 p-3 rounded-2xl border border-white/5 animate-fadeIn">
            <label className="text-[0.78rem] font-semibold text-slate-300 mb-1.5 block">
              ② Số tiền chi
            </label>
            <input
              className="input-field text-orange-400 font-extrabold text-xl py-2 tracking-tight text-center"
              type="text"
              inputMode="numeric"
              placeholder="0 đ"
              value={formatCurrencyDisplay(amount)}
              onChange={(e) => handleCurrencyChange(e, amount, setAmount)}
            />
            {/* Quick chips */}
            <div className="flex gap-1.5 flex-wrap mt-2 justify-center">
              {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className="text-[0.72rem] px-2 py-0.5 rounded-lg bg-slate-800 border border-white/5 text-slate-300 hover:text-white"
                >
                  {formatCurrencyDisplay(amt)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        {selectedCategory && (
          <div className="mb-4 bg-slate-900/60 p-3 rounded-2xl border border-white/5 animate-fadeIn">
            <label className="text-[0.78rem] font-semibold text-slate-300 mb-1.5 block">
              Ghi chú thêm (tùy chọn)
            </label>
            <input
              className="input-field text-sm py-1.5"
              placeholder="Ví dụ: Mua sỉ đợt 1, tiền điện tháng này..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        {/* Submit */}
        {selectedCategory && (
          <button
            className="btn-giant btn-expense py-3 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              opacity: isValid ? 1 : 0.45,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            <IconCheck className="w-5 h-5" />
            <span>XÁC NHẬN CHI TIỀN</span>
            {isValid && (
              <span className="text-sm font-extrabold ml-1 opacity-90">
                • {formatCurrencyDisplay(amount)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
