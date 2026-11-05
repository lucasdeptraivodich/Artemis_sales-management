/**
 * ===================================================================
 * Artemis / Flowers_QLBH - Core Pricing & Calculation Engine
 * ===================================================================
 * Xử lý toàn bộ logic tính toán tài chính chuẩn xác:
 * 1. Thành tiền (Đơn giá x Số lượng)
 * 2. Chiết khấu / Giảm giá (% hoặc số tiền VNĐ cố định)
 * 3. Thuế VAT (Tính trên giá trị sau giảm giá, trước phí ship)
 * 4. Phí vận chuyển (Shipping fee)
 * 5. Tổng thanh toán (Grand Total)
 * 6. Tiền khách đưa & Tiền thừa thối lại (Customer Change / Debt)
 * 7. Doanh thu, Lợi nhuận gộp & Lợi nhuận ròng
 * 8. Trừ / Hoàn tồn kho (Stock reduction & restoration)
 *
 * Chống triệt để:
 * - Sai số số thực IEEE-754 (0.1 + 0.2 = 0.30000000000000004)
 * - Lỗi làm tròn phân tán (Rounding drift)
 * - Giá trị biên (Số lượng <= 0, giảm giá > 100%, tiền âm)
 * - Thứ tự ưu tiên tính toán sai (Order of operations)
 */

/**
 * Làm tròn số tiền về số nguyên an toàn, khử sai số số thực và khử -0
 * @param {number|string} amount
 * @returns {number}
 */
export function roundMoney(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) return 0;
  const rounded = Math.round(num);
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Làm tròn giá trị số lượng (cho phép số lượng thập phân như 0.5 kg, 1.2 mét)
 * Khử sai số số thực tối đa 3 chữ số thập phân
 * @param {number|string} qty
 * @param {number} defaultVal
 * @returns {number}
 */
export function cleanQuantity(qty, defaultVal = 1) {
  if (qty === null || qty === undefined || qty === '') return defaultVal;
  const num = Number(qty);
  if (isNaN(num) || !isFinite(num) || num <= 0) return defaultVal;
  return Math.round(num * 1000) / 1000;
}

/**
 * 1. Tính thành tiền từng món hàng (Line Total)
 * @param {number|string} unitPrice - Đơn giá (>= 0)
 * @param {number|string} quantity - Số lượng (> 0)
 * @returns {number}
 */
export function calculateLineTotal(unitPrice, quantity) {
  const cleanPrice = Math.max(0, Number(unitPrice) || 0);
  const cleanQty = cleanQuantity(quantity, 1);
  return roundMoney(cleanPrice * cleanQty);
}

/**
 * 2. Tính chiết khấu / voucher
 * @param {number} subtotal - Tổng tiền hàng trước giảm giá
 * @param {Object} options
 * @param {'PERCENT'|'FIXED'} options.discountType - '% ' hoặc số tiền cố định
 * @param {number|string} options.discountValue - Giá trị giảm giá
 * @returns {{ discountAmount: number, discountPercent: number, effectiveSubtotal: number }}
 */
export function calculateDiscount(subtotal, { discountType = 'PERCENT', discountValue = 0 } = {}) {
  const cleanSubtotal = Math.max(0, roundMoney(subtotal));
  if (cleanSubtotal === 0) {
    return { discountAmount: 0, discountPercent: 0, effectiveSubtotal: 0 };
  }

  const rawVal = Number(discountValue) || 0;

  if (discountType === 'PERCENT') {
    // Clamping phần trăm giảm giá: [0%, 100%]
    const cleanPercent = Math.min(100, Math.max(0, rawVal));
    // Dùng Math.round để tránh số thực lẻ thập phân
    const discountAmount = roundMoney((cleanSubtotal * cleanPercent) / 100);
    const effectiveSubtotal = Math.max(0, cleanSubtotal - discountAmount);
    return {
      discountAmount,
      discountPercent: cleanPercent,
      effectiveSubtotal,
    };
  } else {
    // Chiết khấu theo tiền mặt cố định: không được âm và không được vượt quá subtotal
    const cleanAmount = Math.min(cleanSubtotal, Math.max(0, roundMoney(rawVal)));
    const discountPercent = cleanSubtotal > 0 ? (cleanAmount / cleanSubtotal) * 100 : 0;
    const effectiveSubtotal = Math.max(0, cleanSubtotal - cleanAmount);
    return {
      discountAmount: cleanAmount,
      discountPercent: Math.round(discountPercent * 100) / 100,
      effectiveSubtotal,
    };
  }
}

/**
 * 3. Tính thuế giá trị gia tăng (VAT)
 * Chuẩn kế toán Việt Nam: VAT tính trên giá trị sau giảm giá, trước phí ship
 * @param {number} amountAfterDiscount - Giá trị tiền hàng sau chiết khấu
 * @param {number|string} taxRate - % thuế suất (0 - 100)
 * @returns {number}
 */
export function calculateTax(amountAfterDiscount, taxRate = 0) {
  const cleanBase = Math.max(0, roundMoney(amountAfterDiscount));
  const rawRate = Number(taxRate) || 0;
  const cleanRate = Math.min(100, Math.max(0, rawRate));
  if (cleanBase === 0 || cleanRate === 0) return 0;
  return roundMoney((cleanBase * cleanRate) / 100);
}

/**
 * 4. Chuẩn hóa phí vận chuyển (Shipping fee)
 * @param {number|string} fee
 * @returns {number}
 */
export function calculateShippingFee(fee = 0) {
  return Math.max(0, roundMoney(fee));
}

/**
 * 5. Tính toàn bộ các chỉ số của một đơn hàng (Order Totals Calculation)
 * Tuân thủ đúng thứ tự ưu tiên:
 * Subtotal -> Chiết khấu -> VAT (trên giá sau chiết khấu) -> Phí ship -> Tổng thanh toán
 * -> Tiền thừa trả khách / Tiền nợ còn lại
 *
 * @param {Object} params
 * @param {number|string} params.unitPrice - Đơn giá bán
 * @param {number|string} params.quantity - Số lượng
 * @param {number|string} [params.unitCost] - Giá vốn đơn vị
 * @param {'PERCENT'|'FIXED'} [params.discountType='PERCENT'] - Loại chiết khấu
 * @param {number|string} [params.discountValue=0] - Giá trị chiết khấu
 * @param {number|string} [params.taxRate=0] - Thuế suất VAT (%)
 * @param {number|string} [params.shippingFee=0] - Phí vận chuyển
 * @param {number|string} [params.customerPaid] - Số tiền khách thực đưa
 * @returns {Object}
 */
export function calculateOrderTotals({
  unitPrice = 0,
  quantity = 1,
  unitCost = 0,
  discountType = 'PERCENT',
  discountValue = 0,
  taxRate = 0,
  shippingFee = 0,
  customerPaid = undefined,
} = {}) {
  const cleanPrice = Math.max(0, roundMoney(unitPrice));
  const cleanQty = cleanQuantity(quantity, 1);
  const cleanCost = Math.max(0, roundMoney(unitCost));

  // 1. Tiền hàng trước giảm giá
  const subtotal = roundMoney(cleanPrice * cleanQty);
  const totalCost = roundMoney(cleanCost * cleanQty);

  // 2. Chiết khấu
  const { discountAmount, discountPercent, effectiveSubtotal } = calculateDiscount(subtotal, {
    discountType,
    discountValue,
  });

  // 3. Thuế VAT (tính trên giá sau chiết khấu)
  const taxAmount = calculateTax(effectiveSubtotal, taxRate);

  // 4. Phí ship
  const cleanShipFee = calculateShippingFee(shippingFee);

  // 5. Tổng thanh toán
  const totalAmount = effectiveSubtotal + taxAmount + cleanShipFee;

  // 6. Tiền khách đưa & tiền thừa / nợ
  let customerPaidAmount = 0;
  let changeAmount = 0;
  let remainingDebt = 0;

  if (customerPaid !== undefined && customerPaid !== null && customerPaid !== '') {
    customerPaidAmount = Math.max(0, roundMoney(customerPaid));
    changeAmount = Math.max(0, customerPaidAmount - totalAmount);
    remainingDebt = Math.max(0, totalAmount - customerPaidAmount);
  } else {
    customerPaidAmount = totalAmount;
    changeAmount = 0;
    remainingDebt = 0;
  }

  // 7. Lợi nhuận gộp đơn hàng = Doanh thu hàng sau giảm giá - Giá vốn
  const grossProfit = effectiveSubtotal - totalCost;

  return {
    unitPrice: cleanPrice,
    quantity: cleanQty,
    unitCost: cleanCost,
    subtotal,
    totalCost,
    discountType,
    discountValue: Number(discountValue) || 0,
    discountAmount,
    discountPercent,
    effectiveSubtotal,
    taxRate: Math.min(100, Math.max(0, Number(taxRate) || 0)),
    taxAmount,
    shippingFee: cleanShipFee,
    totalAmount,
    customerPaid: customerPaidAmount,
    changeAmount,
    remainingDebt,
    grossProfit,
  };
}

/**
 * 6. Tính Lợi nhuận gộp & Lợi nhuận ròng
 * @param {Object} params
 * @param {number} params.revenue - Doanh thu thuần (đã trừ chiết khấu)
 * @param {number} params.costOfGoods - Tổng giá vốn hàng bán (COGS)
 * @param {number} [params.operatingExpenses=0] - Tổng chi phí vận hành (đã lọc trừ chi phí nhập hàng trùng)
 * @returns {{ grossProfit: number, netProfit: number, profitMargin: number }}
 */
export function calculateProfit({ revenue = 0, costOfGoods = 0, operatingExpenses = 0 } = {}) {
  const cleanRevenue = roundMoney(revenue);
  const cleanCOGS = roundMoney(costOfGoods);
  const cleanExpenses = roundMoney(operatingExpenses);

  const grossProfit = cleanRevenue - cleanCOGS;
  const netProfit = grossProfit - cleanExpenses;
  const profitMargin = cleanRevenue > 0 ? Math.round((netProfit / cleanRevenue) * 10000) / 100 : 0;

  return {
    revenue: cleanRevenue,
    costOfGoods: cleanCOGS,
    operatingExpenses: cleanExpenses,
    grossProfit,
    netProfit,
    profitMargin,
  };
}

/**
 * 7. Quản lý Tồn kho (Trừ / Hoàn tồn kho)
 * @param {number|null} currentStock - Tồn kho hiện tại (null nếu không theo dõi kho)
 * @param {number} quantity - Số lượng thay đổi
 * @param {'DEDUCT'|'RESTORE'} [operation='DEDUCT'] - Trừ hoặc Hoàn
 * @returns {{ newStock: number|null, changedAmount: number, isOutOfStock: boolean }}
 */
export function calculateStockChange(currentStock, quantity, operation = 'DEDUCT') {
  if (currentStock === null || currentStock === undefined) {
    return { newStock: null, changedAmount: 0, isOutOfStock: false };
  }

  const cleanCurrent = Number(currentStock) || 0;
  const cleanQty = cleanQuantity(quantity, 0);

  let newStock;
  if (operation === 'DEDUCT') {
    newStock = cleanCurrent - cleanQty;
  } else {
    newStock = cleanCurrent + cleanQty;
  }

  return {
    newStock: Math.round(newStock * 1000) / 1000,
    changedAmount: cleanQty,
    isOutOfStock: newStock < 0,
  };
}

