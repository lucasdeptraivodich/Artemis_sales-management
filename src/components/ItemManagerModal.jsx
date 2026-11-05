import { useState } from 'react';
import { getItems, addItem, updateItem, deleteItem, resetItemsToDefault, formatMoney } from '../store';

export default function ItemManagerModal({ onClose, onItemsChanged, showToast }) {
  const [items, setItems] = useState(getItems());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');

  const refreshList = () => {
    setItems(getItems());
    if (onItemsChanged) onItemsChanged();
  };

  const handleStartAdd = () => {
    setName('');
    setPrice('');
    setCost('');
    setStock('');
    setShowAddForm(true);
    setEditingItemId(null);
  };

  const handleStartEdit = (item) => {
    setName(item.name);
    setPrice(item.default_price ? item.default_price.toString() : '');
    setCost(item.default_cost ? item.default_cost.toString() : '');
    setStock(item.stock !== undefined && item.stock !== null ? item.stock.toString() : '');
    setEditingItemId(item.id);
    setShowAddForm(false);
  };

  const handleSaveAdd = () => {
    if (!name.trim()) {
      showToast('Vui lòng nhập tên món hàng', 'error');
      return;
    }
    addItem({
      name: name.trim(),
      default_price: parseInt(price) || 0,
      default_cost: parseInt(cost) || 0,
      stock: stock.trim() !== '' ? Number(stock) : null,
    });
    showToast('✅ Đã thêm món mới!');
    setShowAddForm(false);
    refreshList();
  };

  const handleSaveEdit = (id) => {
    if (!name.trim()) {
      showToast('Vui lòng nhập tên món hàng', 'error');
      return;
    }
    updateItem(id, {
      name: name.trim(),
      default_price: parseInt(price) || 0,
      default_cost: parseInt(cost) || 0,
      stock: stock.trim() !== '' ? Number(stock) : null,
    });
    showToast('✅ Đã cập nhật món!');
    setEditingItemId(null);
    refreshList();
  };

  const handleDelete = (id, itemName) => {
    if (confirm(`Bạn có chắc chắn muốn xóa món "${itemName}" không?`)) {
      deleteItem(id);
      showToast('🗑️ Đã xóa món hàng');
      refreshList();
    }
  };

  const handleReset = () => {
    if (confirm('Khôi phục danh sách món hàng mẫu ban đầu?')) {
      resetItemsToDefault();
      showToast('🔄 Đã khôi phục món mẫu');
      refreshList();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[1.4rem]">🏷️</span>
            <div>
              <h2 className="text-[1.25rem] font-extrabold leading-tight">Quản Lý Món Hàng</h2>
              <p className="text-[0.75rem] text-[var(--color-text-muted)]">Danh mục món, giá vốn & tồn kho</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] active:scale-90 transition-transform font-bold"
          >
            ✕
          </button>
        </div>

        {/* Action Top Bar */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleStartAdd}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-[0.88rem] flex items-center justify-center gap-1.5 shadow"
          >
            <span>+</span>
            <span>Thêm Món Mới</span>
          </button>
          <button
            onClick={handleReset}
            title="Khôi phục mặc định"
            className="px-3 py-2.5 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-slate-300 text-[0.82rem] font-semibold"
          >
            🔄 Mẫu
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="p-4 rounded-xl bg-[var(--color-dark-700)] border border-emerald-500/40 mb-4 animate-fadeIn">
            <h4 className="text-[0.95rem] font-bold text-emerald-300 mb-3">➕ Thêm món hàng quen thuộc</h4>
            <input
              className="input-field mb-2"
              placeholder="Tên món (vd: Hoa hồng bó lớn)..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-[0.75rem] text-yellow-300 block mb-1 font-bold">Giá bán</label>
                <input
                  className="input-field"
                  type="number"
                  inputMode="numeric"
                  placeholder="0đ"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-yellow-300 block mb-1 font-bold">Giá vốn</label>
                <input
                  className="input-field"
                  type="number"
                  inputMode="numeric"
                  placeholder="0đ"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[0.75rem] text-yellow-300 block mb-1 font-bold">Tồn kho</label>
                <input
                  className="input-field"
                  type="number"
                  inputMode="numeric"
                  placeholder="Không giới hạn"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAdd}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow"
              >
                Lưu món
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 rounded-lg bg-[var(--color-dark-500)] text-sm text-slate-300 font-semibold"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Item List */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((item) => {
            const isEditing = editingItemId === item.id;
            const isKhac = item.name === 'Khác...';

            if (isEditing) {
              return (
                <div key={item.id} className="p-3 rounded-xl bg-[var(--color-dark-700)] border border-blue-500/40">
                  <input
                    className="input-field mb-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      className="input-field"
                      type="number"
                      placeholder="Giá bán"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <input
                      className="input-field"
                      type="number"
                      placeholder="Giá vốn"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                    <input
                      className="input-field"
                      type="number"
                      placeholder="Tồn kho"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow"
                    >
                      Cập nhật
                    </button>
                    <button
                      onClick={() => setEditingItemId(null)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--color-dark-500)] text-xs text-slate-300 font-semibold"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-dark-700)]/70 border border-white/5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[0.92rem] text-slate-100">{item.name}</p>
                    {item.stock !== undefined && item.stock !== null && (
                      <span className={`text-[0.72rem] px-2 py-0.5 rounded-full font-bold ${
                        item.stock > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        📦 Tồn: {item.stock}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-[var(--color-text-muted)] mt-0.5">
                    Giá bán: <span className="text-emerald-400 font-semibold">{formatMoney(item.default_price)}</span>
                    {item.default_cost > 0 && (
                      <span className="ml-2 opacity-75">
                        (Vốn: {formatMoney(item.default_cost)})
                      </span>
                    )}
                  </p>
                </div>

                {!isKhac && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(item)}
                      title="Sửa"
                      className="w-8 h-8 rounded-lg bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] flex items-center justify-center text-xs text-slate-300"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      title="Xóa"
                      className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
