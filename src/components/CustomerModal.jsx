import { useState } from 'react';
import { addCustomer, updateCustomer, deleteCustomer } from '../store';

export default function CustomerModal({ customer, onClose, onSaved, showToast }) {
  const isEditing = Boolean(customer?.id);

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [debt, setDebt] = useState(customer?.total_debt !== undefined ? customer.total_debt.toString() : '');

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Vui lòng nhập tên khách hàng', 'error');
      return;
    }

    const totalDebt = Math.max(0, parseInt(debt) || 0);

    if (isEditing) {
      updateCustomer(customer.id, {
        name: name.trim(),
        phone: phone.trim(),
        total_debt: totalDebt,
      });
      showToast('✅ Đã cập nhật khách hàng!');
    } else {
      addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        total_debt: totalDebt,
      });
      showToast('✅ Đã thêm khách nợ mới!');
    }

    if (onSaved) onSaved();
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Bạn có chắc muốn xóa khách hàng "${customer.name}" khỏi sổ nợ không?`)) {
      deleteCustomer(customer.id);
      showToast('🗑️ Đã xóa khách hàng');
      if (onSaved) onSaved();
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[1.25rem] font-extrabold">
            {isEditing ? '✏️ Sửa Thông Tin Khách Nợ' : '👤 Thêm Khách Nợ Mới'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] active:scale-90 transition-transform"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[0.78rem] text-slate-400 block mb-1 font-semibold">
              Tên khách hàng (*)
            </label>
            <input
              className="input-field"
              placeholder="Nhập họ tên khách..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[0.78rem] text-slate-400 block mb-1 font-semibold">
              Số điện thoại
            </label>
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              placeholder="0901234567..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[0.78rem] text-slate-400 block mb-1 font-semibold">
              {isEditing ? 'Số tiền nợ hiện tại (đ)' : 'Số tiền nợ ban đầu (đ)'}
            </label>
            <input
              className="input-field text-red-400 font-bold text-[1.1rem]"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-[1rem] active:scale-98 transition-transform disabled:opacity-50"
          >
            {isEditing ? 'Cập Nhật Thông Tin' : 'Lưu Khách Nợ'}
          </button>

          {isEditing && (
            <button
              onClick={handleDelete}
              className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold text-[0.88rem] border border-red-500/30 transition-colors"
            >
              🗑️ Xóa Khách Hàng Này
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
