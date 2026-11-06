import { useState, useEffect, useRef } from 'react';
import { getItems, addTransaction, updateTransaction, getCustomers } from '../store';
import { calculateOrderTotals, cleanQuantity, roundMoney } from '../utils/pricing';
import { IconCart, IconEdit, IconX, IconChevronDown, IconChevronUp, IconCheck, IconPlus, IconMinus } from './Icons';

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

const QUICK_PRICE_CHIPS = [
  { label: '+10k', add: 10000 },
  { label: '+50k', add: 50000 },
  { label: '+100k', add: 100000 },
  { label: '+500k', add: 500000 },
];

export default function SaleForm({ onClose, onComplete, initialData = null }) {
  const items = getItems();
  const customers = getCustomers();
  const nameInputRef = useRef(null);

  const isEditing = Boolean(initialData?.id);

  const initQty = initialData?.quantity ? cleanQuantity(initialData.quantity, 1) : 1;
  const initSalePrice = initialData?.unit_price !== undefined
    ? String(initialData.unit_price)
    : initialData?.sale_price !== undefined
    ? String(initQty > 1 ? Math.round(initialData.sale_price / initQty) : initialData.sale_price)
    : '';
  const initCostPrice = initialData?.unit_cost !== undefined
    ? String(initialData.unit_cost)
    : initialData?.cost_price !== undefined
    ? String(initQty > 1 ? Math.round(initialData.cost_price / initQty) : initialData.cost_price)
    : '';

  const [itemName, setItemName] = useState(initialData?.item_name || '');
  const [quantity, setQuantity] = useState(initQty);
  const [salePrice, setSalePrice] = useState(initSalePrice);
  const [costPrice, setCostPrice] = useState(initCostPrice);

  // Advanced options (Cost, Discount, VAT)
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initialData?.discount_amount || initialData?.tax_amount || initialData?.unit_cost || initialData?.cost_price)
  );
  const [discountType, setDiscountType] = useState(initialData?.discount_type || 'PERCENT');
  const [discountValue, setDiscountValue] = useState(
    initialData?.discount_value !== undefined && initialData?.discount_value > 0
      ? String(initialData.discount_value)
      : (initialData?.discount_amount ? String(initialData.discount_amount) : '')
  );
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate !== undefined ? String(initialData.tax_rate) : '0');

  // Payment & Change state
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || 'CASH_TRANSFER');
  const [showChangeCalc, setShowChangeCalc] = useState(Boolean(initialData?.customer_paid));
  const [customerPaid, setCustomerPaid] = useState(initialData?.customer_paid ? String(initialData.customer_paid) : '');
  const [customerName, setCustomerName] = useState(initialData?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(initialData?.customer_phone || '');
  const [shippingAddress, setShippingAddress] = useState(initialData?.shipping_address || '');
  const [trackingCode, setTrackingCode] = useState(initialData?.tracking_code || '');
  const [shippingFee, setShippingFee] = useState(initialData?.shipping_fee !== undefined ? String(initialData.shipping_fee) : '');

  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNameChange = (val) => {
    setItemName(val);
    const matched = items.find((i) => i.name.toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      if (!salePrice && matched.default_price > 0) {
        setSalePrice(String(matched.default_price));
      }
      if (!costPrice && matched.default_cost > 0) {
        setCostPrice(String(matched.default_cost));
      }
    }
  };

  const handleDecrementQty = () => {
    setQuantity((q) => Math.max(1, (Number(q) || 1) - 1));
  };

  const handleIncrementQty = () => {
    setQuantity((q) => (Number(q) || 1) + 1);
  };

  const handleAddPrice = (addVal) => {
    const current = parseInt(salePrice, 10) || 0;
    setSalePrice(String(current + addVal));
  };

  // Làm tròn giá thông minh không đội gấp đôi giá
  const handleRoundPrice = () => {
    const current = parseInt(salePrice, 10) || 0;
    if (current <= 0) {
      setSalePrice('10000');
      return;
    }
    if (current % 10000 !== 0) {
      setSalePrice(String(Math.ceil(current / 10000) * 10000));
      return;
    }
    if (current % 50000 !== 0) {
      setSalePrice(String(Math.ceil(current / 50000) * 50000));
      return;
    }
    if (current % 100000 !== 0) {
      setSalePrice(String(Math.ceil(current / 100000) * 100000));
      return;
    }
  };

  // Tính toán chỉ số tài chính chuẩn xác
  const orderCalculations = calculateOrderTotals({
    unitPrice: salePrice,
    quantity,
    unitCost: costPrice,
    discountType,
    discountValue,
    taxRate,
    shippingFee: paymentMethod === 'COD' || shippingFee ? shippingFee : 0,
    customerPaid: paymentMethod === 'CASH_TRANSFER' ? customerPaid : undefined,
  });

  const isValid =
    itemName.trim().length > 0 &&
    orderCalculations.unitPrice > 0 &&
    orderCalculations.quantity > 0 &&
    (paymentMethod !== 'DEBT' || customerName.trim().length > 0);

  const handleSubmit = () => {
    if (!isValid) return;

    const tx = {
      type: 'SALE',
      item_name: itemName.trim(),
      quantity: orderCalculations.quantity,
      unit_price: orderCalculations.unitPrice,
      unit_cost: orderCalculations.unitCost,
      subtotal: orderCalculations.subtotal,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,
      discount_amount: orderCalculations.discountAmount,
      tax_rate: Number(taxRate) || 0,
      tax_amount: orderCalculations.taxAmount,
      shipping_fee: orderCalculations.shippingFee,
      sale_price: orderCalculations.totalAmount, // Tổng thanh toán
      cost_price: orderCalculations.totalCost,
      customer_paid: orderCalculations.customerPaid,
      change_amount: orderCalculations.changeAmount,
      payment_method: paymentMethod,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      shipping_address: shippingAddress.trim(),
      tracking_code: trackingCode.trim(),
    };

    if (isEditing) {
      updateTransaction(initialData.id, tx);
    } else {
      addTransaction(tx);
    }

    onComplete();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-[520px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              {isEditing ? <IconEdit className="w-5 h-5" /> : <IconCart className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-[1.15rem] font-extrabold text-white leading-tight">
                {isEditing ? 'Chỉnh Sửa Đơn Hàng' : 'Bán Hàng Nhanh'}
              </h2>
              <p className="text-[0.72rem] text-slate-400">Ghi nhận đơn và dòng tiền tức thì</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-90 transition-all"
            title="Đóng"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Chọn món hàng & Số lượng */}
        <div className="mb-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[0.78rem] font-semibold text-slate-300">
              Món hàng / Sản phẩm <span className="text-rose-400">*</span>
            </label>
            <span className="text-[0.72rem] text-slate-400">Số lượng</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={nameInputRef}
                type="text"
                list="item-suggestions"
                className="input-field pr-8 text-sm py-2"
                placeholder="Nhập hoặc chọn món..."
                value={itemName}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              {itemName && (
                <button
                  type="button"
                  onClick={() => {
                    setItemName('');
                    nameInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-[10px]"
                  title="Xóa nhanh văn bản"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-800/80 rounded-xl border border-white/10 p-0.5">
              <button
                type="button"
                onClick={handleDecrementQty}
                disabled={orderCalculations.quantity <= 1}
                className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center active:scale-90 transition-all"
                title="Giảm số lượng"
              >
                <IconMinus className="w-3.5 h-3.5" />
              </button>

              <input
                type="number"
                step="any"
                min="0.001"
                inputMode="decimal"
                className="w-12 text-center bg-transparent font-extrabold text-sm text-white focus:outline-none"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => {
                  if (!quantity || Number(quantity) <= 0) {
                    setQuantity(1);
                  }
                }}
              />

              <button
                type="button"
                onClick={handleIncrementQty}
                className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-600 flex items-center justify-center active:scale-90 transition-all"
                title="Tăng số lượng"
              >
                <IconPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <datalist id="item-suggestions">
            {items
              .filter((i) => i.name !== 'Khác...')
              .map((i) => (
                <option key={i.id} value={i.name} />
              ))}
          </datalist>

          {/* Quick item chips */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-white/5">
              {items.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setItemName(item.name);
                    if (item.default_price > 0) setSalePrice(String(item.default_price));
                    if (item.default_cost > 0) setCostPrice(String(item.default_cost));
                  }}
                  className={`text-[0.72rem] px-2 py-0.5 rounded-lg border transition-all ${
                    itemName.trim().toLowerCase() === item.name.toLowerCase()
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-800/70 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Đơn giá bán */}
        <div className="mb-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[0.78rem] font-semibold text-slate-300">
              Đơn giá bán <span className="text-rose-400">*</span>
            </label>
            {orderCalculations.unitPrice > 0 && orderCalculations.quantity > 1 && (
              <span className="text-[0.72rem] text-emerald-400 font-bold">
                Thành tiền: {formatCurrencyDisplay(orderCalculations.subtotal)}
              </span>
            )}
          </div>

          <input
            type="text"
            inputMode="numeric"
            className="input-field text-emerald-400 font-extrabold text-xl py-2 tracking-tight"
            placeholder="0 đ"
            value={formatCurrencyDisplay(salePrice)}
            onChange={(e) => handleCurrencyChange(e, salePrice, setSalePrice)}
          />

          {/* Quick denomination chips & Rounding */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {QUICK_PRICE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleAddPrice(chip.add)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-emerald-400 font-bold text-xs active:scale-95 transition-all shadow-sm"
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRoundPrice}
              disabled={orderCalculations.unitPrice <= 0}
              className={`px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-amber-300 font-bold text-xs active:scale-95 transition-all shadow-sm ${
                orderCalculations.unitPrice <= 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              title="Làm tròn số tiền lẻ"
            >
              🎯 Tròn giá
            </button>
            {orderCalculations.unitPrice > 0 && (
              <button
                type="button"
                onClick={() => setSalePrice('')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/40 border border-rose-500/20 text-rose-400 font-semibold text-xs active:scale-95 transition-all ml-auto"
                title="Xóa giá"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Step 3: Hình thức thanh toán */}
        <div className="mb-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5">
          <label className="text-[0.78rem] font-semibold text-slate-300 mb-2 block">
            Hình thức thanh toán
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                paymentMethod === 'CASH_TRANSFER'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
              }`}
              onClick={() => setPaymentMethod('CASH_TRANSFER')}
            >
              <span className="text-base">💵</span>
              <span>Trả ngay</span>
            </button>

            <button
              type="button"
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                paymentMethod === 'DEBT'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
              }`}
              onClick={() => setPaymentMethod('DEBT')}
            >
              <span className="text-base">📝</span>
              <span>Ghi nợ</span>
            </button>

            <button
              type="button"
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 border ${
                paymentMethod === 'COD'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/60 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
              }`}
              onClick={() => setPaymentMethod('COD')}
            >
              <span className="text-base">📦</span>
              <span>Ship COD</span>
            </button>
          </div>

          {/* Sub-block for CASH_TRANSFER: Tính tiền thối */}
          {paymentMethod === 'CASH_TRANSFER' && (
            <div className="mt-2.5 pt-2 border-t border-white/5">
              {!showChangeCalc && !customerPaid ? (
                <button
                  type="button"
                  onClick={() => setShowChangeCalc(true)}
                  className="text-[0.75rem] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <span>💰</span>
                  <span>Tính tiền thừa thối lại cho khách?</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.75rem] font-semibold text-slate-300">Tiền khách đưa:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeCalc(false);
                        setCustomerPaid('');
                      }}
                      className="text-[0.7rem] text-slate-500 hover:text-slate-300"
                    >
                      Ẩn
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input-field text-amber-300 font-bold text-sm py-1.5 flex-1"
                      placeholder="Số tiền khách đưa..."
                      value={formatCurrencyDisplay(customerPaid)}
                      onChange={(e) => handleCurrencyChange(e, customerPaid, setCustomerPaid)}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomerPaid(String(orderCalculations.totalAmount))}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30 hover:bg-emerald-500/30 active:scale-95"
                    >
                      Đưa đủ
                    </button>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCustomerPaid(String(amt))}
                        className="text-[0.72rem] px-2 py-0.5 rounded-lg bg-slate-800 border border-white/5 text-slate-300 hover:text-white"
                      >
                        {formatCurrencyDisplay(amt)}
                      </button>
                    ))}
                  </div>
                  {customerPaid && orderCalculations.customerPaid >= orderCalculations.totalAmount ? (
                    <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold">🎉 Tiền thừa trả khách:</span>
                      <span className="text-emerald-400 font-extrabold text-sm">
                        {formatCurrencyDisplay(orderCalculations.changeAmount)}
                      </span>
                    </div>
                  ) : customerPaid && orderCalculations.customerPaid < orderCalculations.totalAmount ? (
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
                      ⚠️ Khách đưa thiếu: {formatCurrencyDisplay(orderCalculations.remainingDebt)}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>



        {/* DEBT: Customer info */}
        {paymentMethod === 'DEBT' && (
          <div className="mb-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5 animate-fadeIn">
            <label className="text-[0.78rem] font-semibold text-slate-300 mb-1.5 block">
              Thông tin khách nợ <span className="text-rose-400">*</span>
            </label>
            {customers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {customers.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`text-[0.72rem] px-2 py-0.5 rounded-lg border transition-all ${
                      customerName.trim().toLowerCase() === c.name.trim().toLowerCase()
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold'
                        : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
                    }`}
                    onClick={() => {
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone || '');
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <input
                className="input-field text-sm py-2"
                placeholder="Tên khách hàng (* bắt buộc để ghi nợ)..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="input-field text-sm py-2"
                type="tel"
                inputMode="tel"
                placeholder="Số điện thoại (tùy chọn)..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            {!customerName.trim() && (
              <p className="text-[0.72rem] text-amber-400 mt-1 pl-1">
                ⚠️ Cần nhập tên khách hàng để lưu vào Sổ Nợ
              </p>
            )}
          </div>
        )}

        {/* COD: Shipping info */}
        {paymentMethod === 'COD' && (
          <div className="mb-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5 animate-fadeIn space-y-2">
            <label className="text-[0.78rem] font-semibold text-slate-300 block">
              Thông tin giao hàng COD
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input-field text-sm py-1.5"
                placeholder="Tên người nhận..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                className="input-field text-sm py-1.5"
                type="tel"
                inputMode="tel"
                placeholder="Số điện thoại..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <textarea
              className="input-field text-sm py-1.5"
              rows={2}
              placeholder="Địa chỉ giao hàng chi tiết..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input-field text-sm py-1.5"
                placeholder="Mã vận đơn..."
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
              />
              <input
                className="input-field text-blue-400 font-bold text-sm py-1.5"
                type="text"
                inputMode="numeric"
                placeholder="Phí ship (0 đ)..."
                value={formatCurrencyDisplay(shippingFee)}
                onChange={(e) => handleCurrencyChange(e, shippingFee, setShippingFee)}
              />
            </div>
          </div>
        )}

        {/* Accordion: Tùy chọn nâng cao (Giá vốn, Chiết khấu, Thuế VAT) */}
        <div className="mb-3 bg-slate-900/60 rounded-2xl border border-white/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-all"
          >
            <span className="flex items-center gap-1.5">
              <span>⚙️</span>
              <span>Tùy chọn nâng cao (Vốn, Giảm giá, Thuế)</span>
              {(orderCalculations.discountAmount > 0 || orderCalculations.taxAmount > 0 || costPrice) && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                  Đã áp dụng
                </span>
              )}
            </span>
            {showAdvanced ? <IconChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <IconChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {showAdvanced && (
            <div className="p-3 border-t border-white/5 space-y-2.5 text-xs animate-fadeIn">
              {/* Giá vốn */}
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">
                  Giá vốn đơn vị (để tính lợi nhuận):
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field text-slate-200 font-bold text-sm py-1.5"
                  placeholder="0 đ (bỏ qua nếu không tính)"
                  value={formatCurrencyDisplay(costPrice)}
                  onChange={(e) => handleCurrencyChange(e, costPrice, setCostPrice)}
                />
              </div>

              {/* Giảm giá */}
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">
                  Giảm giá / Voucher:
                </label>
                <div className="flex gap-1.5">
                  <div className="flex rounded-lg bg-slate-800 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENT')}
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        discountType === 'PERCENT' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('FIXED')}
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        discountType === 'FIXED' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      đ
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'PERCENT' ? '100' : undefined}
                    inputMode="numeric"
                    placeholder={discountType === 'PERCENT' ? '10 (%)' : 'Số tiền giảm (đ)'}
                    className="input-field text-emerald-400 font-bold flex-1 py-1 text-sm"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {orderCalculations.discountAmount > 0 && (
                  <p className="text-emerald-400 mt-1 font-semibold text-[0.72rem]">
                    - Giảm: {formatCurrencyDisplay(orderCalculations.discountAmount)} (Sau giảm: {formatCurrencyDisplay(orderCalculations.effectiveSubtotal)})
                  </p>
                )}
              </div>

              {/* Thuế VAT */}
              <div>
                <label className="text-slate-400 font-semibold mb-1 block">
                  Thuế VAT:
                </label>
                <div className="flex gap-1">
                  {['0', '5', '8', '10'].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setTaxRate(rate)}
                      className={`flex-1 py-1 rounded-lg font-bold text-xs border ${
                        taxRate === rate
                          ? 'bg-blue-600 text-white border-blue-400 shadow'
                          : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                {orderCalculations.taxAmount > 0 && (
                  <p className="text-blue-400 mt-1 font-semibold text-[0.72rem]">
                    + Tiền thuế ({taxRate}%): {formatCurrencyDisplay(orderCalculations.taxAmount)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tổng kết phiếu thanh toán (Order Breakdown Banner) */}
        {orderCalculations.unitPrice > 0 && (
          <div className="mb-3.5 p-3 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Tiền hàng ({formatCurrencyDisplay(orderCalculations.unitPrice)} × {orderCalculations.quantity}):</span>
              <span className="font-semibold text-white">{formatCurrencyDisplay(orderCalculations.subtotal)}</span>
            </div>
            {orderCalculations.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Chiết khấu ({orderCalculations.discountPercent}%):</span>
                <span className="font-semibold">-{formatCurrencyDisplay(orderCalculations.discountAmount)}</span>
              </div>
            )}
            {orderCalculations.taxAmount > 0 && (
              <div className="flex justify-between text-blue-400">
                <span>Thuế VAT ({orderCalculations.taxRate}%):</span>
                <span className="font-semibold">+{formatCurrencyDisplay(orderCalculations.taxAmount)}</span>
              </div>
            )}
            {orderCalculations.shippingFee > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold">+{formatCurrencyDisplay(orderCalculations.shippingFee)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-white/10 flex justify-between items-center text-sm">
              <span className="font-bold text-white uppercase tracking-wider text-xs">
                Tổng thanh toán:
              </span>
              <span className="font-extrabold text-emerald-400 text-base">
                {formatCurrencyDisplay(orderCalculations.totalAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="button"
            className="btn-giant btn-sale py-3"
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              opacity: isValid ? 1 : 0.45,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            <IconCheck className="w-5 h-5" />
            <span>{isEditing ? 'LƯU THAY ĐỔI' : 'HOÀN THÀNH'}</span>
            {isValid && (
              <span className="text-sm font-extrabold ml-1 opacity-95">
                • {formatCurrencyDisplay(orderCalculations.totalAmount)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
