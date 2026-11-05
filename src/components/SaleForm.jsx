import { useState, useEffect, useRef } from 'react';
import { getItems, addTransaction, updateTransaction, getCustomers } from '../store';
import { calculateOrderTotals, cleanQuantity, roundMoney } from '../utils/pricing';

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

  // Discount & VAT state
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(Boolean(initialData?.discount_amount || initialData?.tax_amount));
  const [discountType, setDiscountType] = useState(initialData?.discount_type || 'PERCENT');
  const [discountValue, setDiscountValue] = useState(
    initialData?.discount_value !== undefined && initialData?.discount_value > 0
      ? String(initialData.discount_value)
      : (initialData?.discount_amount ? String(initialData.discount_amount) : '')
  );
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate !== undefined ? String(initialData.tax_rate) : '0');

  // Payment & Change state
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || 'CASH_TRANSFER');
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
      <div className="modal-content max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[1.4rem]">{isEditing ? '✏️' : '🛒'}</span>
            <h2 className="text-[1.3rem] font-extrabold text-[var(--color-text-primary)]">
              {isEditing ? 'Chỉnh Sửa Đơn Hàng' : 'Bán Hàng'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] text-slate-300 hover:text-white hover:bg-[var(--color-dark-400)] active:scale-90 transition-all font-bold"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Chọn món hàng (Tên món & Số lượng) */}
        <div className="mb-4">
          <p className="section-title">① Chọn món hàng</p>

          <div className="mb-3">
            <label className="text-[0.8rem] text-[var(--color-text-muted)] mb-1.5 block font-semibold">
              Tên món hàng / sản phẩm <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                ref={nameInputRef}
                type="text"
                list="item-suggestions"
                className="input-field pr-10"
                placeholder="Nhập tên sản phẩm (VD: Áo, Hoa tươi, Túi...)"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--color-dark-400)] text-slate-300 hover:text-white hover:bg-[var(--color-dark-300)] flex items-center justify-center text-xs active:scale-90 transition-all shadow-sm"
                  title="Xóa nhanh văn bản"
                >
                  ✕
                </button>
              )}
            </div>

            <datalist id="item-suggestions">
              {items
                .filter((i) => i.name !== 'Khác...')
                .map((i) => (
                  <option key={i.id} value={i.name} />
                ))}
            </datalist>
          </div>

          <div>
            <label className="text-[0.8rem] text-[var(--color-text-muted)] mb-1.5 block font-semibold">
              Số lượng
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrementQty}
                disabled={orderCalculations.quantity <= 1}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-extrabold transition-all border border-white/5 active:scale-95 ${
                  orderCalculations.quantity <= 1
                    ? 'bg-[var(--color-dark-600)] text-slate-600 cursor-not-allowed opacity-40'
                    : 'bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-slate-200 hover:text-white'
                }`}
                title="Giảm số lượng"
              >
                −
              </button>

              <input
                type="number"
                step="any"
                min="0.001"
                inputMode="decimal"
                className="input-field text-center font-extrabold text-lg flex-1 py-2.5"
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
                className="w-12 h-12 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-slate-200 hover:text-white flex items-center justify-center text-xl font-extrabold transition-all border border-white/5 active:scale-95"
                title="Tăng số lượng"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Giá tiền */}
        <div className="mb-4">
          <p className="section-title">② Đơn giá & Giá vốn</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[0.8rem] text-[var(--color-text-muted)] mb-1.5 block font-semibold">
                Đơn giá bán <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input-field text-emerald-400 font-bold"
                placeholder="0 đ"
                value={formatCurrencyDisplay(salePrice)}
                onChange={(e) => handleCurrencyChange(e, salePrice, setSalePrice)}
              />
            </div>
            <div className="flex-1">
              <label className="text-[0.8rem] text-[var(--color-text-muted)] mb-1.5 block font-semibold">
                Giá vốn (nếu có)
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input-field text-slate-300 font-medium"
                placeholder="0 đ"
                value={formatCurrencyDisplay(costPrice)}
                onChange={(e) => handleCurrencyChange(e, costPrice, setCostPrice)}
              />
            </div>
          </div>

          {/* Quick denomination chips & Rounding */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {QUICK_PRICE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleAddPrice(chip.add)}
                className="px-2.5 py-1.5 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] border border-emerald-500/20 text-emerald-400 font-extrabold text-xs active:scale-95 transition-all shadow-sm"
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRoundPrice}
              disabled={orderCalculations.unitPrice <= 0}
              className={`px-2.5 py-1.5 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] border border-white/10 text-amber-300 font-bold text-xs active:scale-95 transition-all shadow-sm ${
                orderCalculations.unitPrice <= 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              title="Làm tròn số tiền lẻ"
            >
              🎯 Làm tròn
            </button>
            {orderCalculations.unitPrice > 0 && (
              <button
                type="button"
                onClick={() => setSalePrice('')}
                className="px-2 py-1.5 rounded-xl bg-[var(--color-dark-600)] hover:bg-red-950/40 border border-red-500/20 text-red-400 font-semibold text-xs active:scale-95 transition-all"
                title="Xóa giá"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Step 3: Chiết khấu / Giảm giá & Thuế VAT */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
            className="flex items-center justify-between w-full p-2.5 rounded-xl bg-[var(--color-dark-700)] border border-white/10 hover:border-emerald-500/30 text-xs font-bold text-slate-300 transition-all"
          >
            <span className="flex items-center gap-1.5">
              <span>🎁</span>
              <span>Chiết khấu / Giảm giá & Thuế VAT</span>
              {(orderCalculations.discountAmount > 0 || orderCalculations.taxAmount > 0) && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[0.7rem]">
                  Đã áp dụng
                </span>
              )}
            </span>
            <span>{showAdvancedPricing ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
          </button>

          {showAdvancedPricing && (
            <div className="p-3.5 mt-2 rounded-xl bg-[var(--color-dark-700)] border border-white/10 space-y-3 animate-fadeIn text-xs">
              {/* Giảm giá */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Giảm giá / Voucher:
                </label>
                <div className="flex gap-2">
                  <div className="flex rounded-xl bg-[var(--color-dark-600)] p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENT')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        discountType === 'PERCENT'
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('FIXED')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        discountType === 'FIXED'
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
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
                    placeholder={discountType === 'PERCENT' ? 'Ví dụ: 10 (%)' : 'Số tiền giảm (đ)'}
                    className="input-field text-emerald-400 font-bold flex-1 py-1.5 text-sm"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {orderCalculations.discountAmount > 0 && (
                  <p className="text-emerald-400 mt-1 font-semibold text-[0.75rem]">
                    - Giảm: {formatCurrencyDisplay(orderCalculations.discountAmount)} (Sau giảm: {formatCurrencyDisplay(orderCalculations.effectiveSubtotal)})
                  </p>
                )}
              </div>

              {/* Thuế VAT */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Thuế giá trị gia tăng (VAT):
                </label>
                <div className="flex gap-1.5">
                  {['0', '5', '8', '10'].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setTaxRate(rate)}
                      className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all border ${
                        taxRate === rate
                          ? 'bg-blue-600 text-white border-blue-400 shadow'
                          : 'bg-[var(--color-dark-600)] text-slate-300 border-white/10 hover:bg-[var(--color-dark-500)]'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                {orderCalculations.taxAmount > 0 && (
                  <p className="text-blue-400 mt-1 font-semibold text-[0.75rem]">
                    + Tiền thuế ({taxRate}%): {formatCurrencyDisplay(orderCalculations.taxAmount)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Hình thức thanh toán */}
        <div className="mb-4">
          <p className="section-title">④ Hình thức thanh toán</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`radio-option ${paymentMethod === 'CASH_TRANSFER' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('CASH_TRANSFER')}
            >
              <div className="radio-dot">
                <div className="radio-dot-inner" />
              </div>
              <span>💵 Khách trả ngay (Tiền mặt / Chuyển khoản)</span>
            </button>

            <button
              type="button"
              className={`radio-option ${paymentMethod === 'DEBT' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('DEBT')}
            >
              <div className="radio-dot">
                <div className="radio-dot-inner" />
              </div>
              <span>📝 Ghi nợ (Chưa thanh toán)</span>
            </button>

            <button
              type="button"
              className={`radio-option ${paymentMethod === 'COD' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('COD')}
            >
              <div className="radio-dot">
                <div className="radio-dot-inner" />
              </div>
              <span>📦 Đơn Ship / COD</span>
            </button>
          </div>
        </div>

        {/* Tiền khách đưa & Tiền thừa trả khách khi trả ngay */}
        {paymentMethod === 'CASH_TRANSFER' && (
          <div className="mb-4 p-3.5 rounded-xl bg-[var(--color-dark-700)] border border-emerald-500/20 animate-fadeIn">
            <label className="text-[0.8rem] text-slate-300 font-semibold block mb-1.5">
              💵 Tiền khách đưa (Tính tiền thừa thối lại):
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                inputMode="numeric"
                className="input-field text-amber-300 font-bold text-base flex-1"
                placeholder="Nhập số tiền khách đưa..."
                value={formatCurrencyDisplay(customerPaid)}
                onChange={(e) => handleCurrencyChange(e, customerPaid, setCustomerPaid)}
              />
              <button
                type="button"
                onClick={() => setCustomerPaid(String(orderCalculations.totalAmount))}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30 hover:bg-emerald-500/30 active:scale-95"
              >
                Đưa đủ
              </button>
            </div>

            {/* Gợi ý mệnh giá nhanh */}
            <div className="flex gap-1.5 flex-wrap mb-2">
              {[50000, 100000, 200000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCustomerPaid(String(amt))}
                  className="item-chip text-[0.75rem] py-1 px-2.5"
                >
                  {formatCurrencyDisplay(amt)}
                </button>
              ))}
            </div>

            {/* Kết quả tiền thừa */}
            {customerPaid && orderCalculations.customerPaid >= orderCalculations.totalAmount ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">
                  🎉 Tiền thừa trả khách:
                </span>
                <span className="text-base font-extrabold text-emerald-400">
                  {formatCurrencyDisplay(orderCalculations.changeAmount)}
                </span>
              </div>
            ) : customerPaid && orderCalculations.customerPaid < orderCalculations.totalAmount ? (
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300">
                ⚠️ Khách đưa thiếu: {formatCurrencyDisplay(orderCalculations.remainingDebt)}
              </div>
            ) : null}
          </div>
        )}

        {/* DEBT: Customer info */}
        {paymentMethod === 'DEBT' && (
          <div className="mb-4 animate-fadeIn">
            <p className="section-title">Thông tin khách nợ</p>
            {customers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`item-chip text-[0.82rem] py-1.5 px-3 ${
                      customerName.trim().toLowerCase() === c.name.trim().toLowerCase() ? 'selected' : ''
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
            <div className="mb-2">
              <input
                className="input-field"
                placeholder="Tên khách hàng (* bắt buộc để ghi nợ)..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              {!customerName.trim() && (
                <p className="text-[0.75rem] text-amber-400 mt-1 pl-1">
                  ⚠️ Cần nhập tên khách hàng để lưu vào Sổ Nợ
                </p>
              )}
            </div>
            <input
              className="input-field"
              type="tel"
              inputMode="tel"
              placeholder="Số điện thoại (nếu có)..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        )}

        {/* COD: Shipping info */}
        {paymentMethod === 'COD' && (
          <div className="mb-4 animate-fadeIn">
            <p className="section-title">Thông tin gửi hàng</p>
            <input
              className="input-field mb-2"
              placeholder="Tên người nhận..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              className="input-field mb-2"
              type="tel"
              inputMode="tel"
              placeholder="Số điện thoại người nhận..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <textarea
              className="input-field mb-2"
              rows={2}
              placeholder="Địa chỉ giao hàng..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
            />
            <input
              className="input-field mb-2"
              placeholder="Mã vận đơn (nếu có)..."
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
            />
            <div>
              <label className="text-[0.8rem] text-[var(--color-text-muted)] mb-1 block font-semibold">
                Phí vận chuyển (thu hộ / cộng vào tổng tiền)
              </label>
              <input
                className="input-field text-blue-400 font-bold"
                type="text"
                inputMode="numeric"
                placeholder="0 đ"
                value={formatCurrencyDisplay(shippingFee)}
                onChange={(e) => handleCurrencyChange(e, shippingFee, setShippingFee)}
              />
            </div>
          </div>
        )}

        {/* Tổng kết phiếu thanh toán (Order Breakdown Banner) */}
        {orderCalculations.unitPrice > 0 && (
          <div className="mb-4 p-3 rounded-2xl bg-[var(--color-dark-700)] border border-emerald-500/30 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Tiền hàng ({formatCurrencyDisplay(orderCalculations.unitPrice)} × {orderCalculations.quantity}):</span>
              <span className="font-semibold">{formatCurrencyDisplay(orderCalculations.subtotal)}</span>
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
              <span className="font-extrabold text-white uppercase tracking-wider">
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
            className="btn-giant btn-sale py-3.5"
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            <span>{isEditing ? '💾 LƯU THAY ĐỔI' : '✅ HOÀN THÀNH'}</span>
            {isValid && (
              <span className="text-[1.1rem] opacity-90 font-extrabold ml-1">
                • {formatCurrencyDisplay(orderCalculations.totalAmount)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
