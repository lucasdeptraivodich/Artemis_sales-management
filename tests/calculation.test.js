// ============================================================
// Artemis QLBH - Test Suite Hệ Thống Tính Toán
// Chạy bằng Node.js Test Runner: node --test tests/calculation.test.js
// ============================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Giả lập localStorage trong môi trường Node.js
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

// Ẩn warning console trong test run
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('IndexedDB')) return;
  originalWarn(...args);
};

// Import các hàm từ store
import {
  formatMoney,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
  getCustomers,
  addCustomer,
  payDebt,
  getMonthlyStats,
  getDetailedCashFlowReport,
  getRevenueReportData,
  markCodReceived,
  deductStock,
  restoreStock,
  getItems,
} from '../src/store.js';

import {
  roundMoney,
  cleanQuantity,
  calculateLineTotal,
  calculateDiscount,
  calculateTax,
  calculateShippingFee,
  calculateOrderTotals,
  calculateProfit,
  calculateStockChange,
} from '../src/utils/pricing.js';

// Hàm mô phỏng làm tròn giá từ SaleForm.jsx
function calculateRoundPrice(currentVal) {
  const current = parseInt(currentVal, 10) || 0;
  if (current <= 0) {
    return '10000';
  }
  let rounded;
  if (current % 10000 !== 0) {
    rounded = Math.ceil(current / 10000) * 10000;
  } else if (current % 50000 !== 0) {
    rounded = Math.ceil(current / 50000) * 50000;
  } else {
    rounded = Math.ceil((current + 1) / 100000) * 100000;
  }
  return String(rounded);
}

// Reset sạch database bộ nhớ trước mỗi bài test
function resetStore() {
  mockStorage.clear();
  localStorage.setItem('sbh_transactions', JSON.stringify([]));
  localStorage.setItem('sbh_customers', JSON.stringify([]));
  localStorage.setItem('sbh_items', JSON.stringify([]));

  getTransactions().length = 0;
  getCustomers().length = 0;
}

// ============================================================
// SUITE 1: TÍNH TOÁN ĐƠN GIÁ, SỐ LƯỢNG & LÀM TRÒN
// ============================================================
describe('TC-MOD-01: Tính toán Đơn giá, Số lượng & Làm tròn giá', () => {
  beforeEach(() => resetStore());

  it('TC-01.01: Tính đúng thành tiền đơn hàng = Đơn giá * Số lượng', () => {
    const unitPrice = 120000;
    const quantity = 3;
    const totalSaleAmount = unitPrice * quantity;
    const unitCost = 60000;
    const totalCostAmount = unitCost * quantity;
    const orderProfit = totalSaleAmount - totalCostAmount;

    assert.equal(totalSaleAmount, 360000, 'Thành tiền phải bằng 360.000đ');
    assert.equal(totalCostAmount, 180000, 'Giá vốn phải bằng 180.000đ');
    assert.equal(orderProfit, 180000, 'Lợi nhuận phải bằng 180.000đ');
  });

  it('TC-01.02: Tự động chuẩn hóa số lượng tối thiểu là 1 khi số lượng <= 0 hoặc không hợp lệ', () => {
    const txZeroQty = addTransaction({
      item_name: 'Vòng tay',
      sale_price: 150000,
      cost_price: 80000,
      quantity: 0,
    });
    assert.equal(txZeroQty.quantity, 1, 'Số lượng 0 phải được chuẩn hóa về 1');

    const txNegativeQty = addTransaction({
      item_name: 'Vòng tay',
      sale_price: 150000,
      cost_price: 80000,
      quantity: -5,
    });
    assert.equal(txNegativeQty.quantity, 1, 'Số lượng âm phải được chuẩn hóa về 1');
  });

  it('TC-01.03: Tự động suy ra đơn giá (unit_price) khi mua nhiều sản phẩm', () => {
    const tx = addTransaction({
      item_name: 'Nhẫn bạc',
      sale_price: 300000,
      cost_price: 150000,
      quantity: 3,
    });

    assert.equal(tx.unit_price, 100000, 'Đơn giá bán phải là 100.000đ');
    assert.equal(tx.unit_cost, 50000, 'Đơn giá vốn phải là 50.000đ');
  });

  it('TC-01.04: Thuật toán làm tròn giá nhanh lên mốc 10k, 50k, 100k', () => {
    assert.equal(calculateRoundPrice(0), '10000', 'Giá 0đ làm tròn thành 10.000đ');
    assert.equal(calculateRoundPrice(12000), '20000', '12.000đ làm tròn lên 20.000đ');
    assert.equal(calculateRoundPrice(20000), '50000', '20.000đ làm tròn lên 50.000đ');
    assert.equal(calculateRoundPrice(50000), '100000', '50.000đ làm tròn lên 100.000đ');
    assert.equal(calculateRoundPrice(100000), '200000', '100.000đ làm tròn lên 200.000đ');
    assert.equal(calculateRoundPrice(150000), '200000', '150.000đ làm tròn lên 200.000đ');
  });
});


// ============================================================
// SUITE 2: TÍNH TOÁN CÔNG NỢ & ĐỐI SOÁT NỢ (DEBT MANAGEMENT)
// ============================================================
describe('TC-MOD-02: Quản lý Công nợ & Đối soát Nợ', () => {
  beforeEach(() => resetStore());

  it('TC-02.01: Ghi nợ mới cho khách hàng chưa có trong sổ', () => {
    addTransaction({
      type: 'SALE',
      item_name: 'Dây chuyền',
      sale_price: 250000,
      cost_price: 120000,
      payment_method: 'DEBT',
      customer_name: 'Chị Lan',
      customer_phone: '0901234567',
    });

    const customers = getCustomers();
    const lan = customers.find((c) => c.name === 'Chị Lan');
    assert.ok(lan, 'Khách hàng Chị Lan phải được tạo mới');
    assert.equal(lan.total_debt, 250000, 'Số nợ ban đầu phải là 250.000đ');
  });

  it('TC-02.02: Cộng dồn công nợ khi khách tiếp tục mua nợ đơn mới', () => {
    addTransaction({
      type: 'SALE',
      item_name: 'Đơn 1',
      sale_price: 200000,
      payment_method: 'DEBT',
      customer_name: 'Anh Tuấn',
    });

    addTransaction({
      type: 'SALE',
      item_name: 'Đơn 2',
      sale_price: 150000,
      payment_method: 'DEBT',
      customer_name: 'Anh Tuấn',
    });

    const tuantx = getCustomers().find((c) => c.name === 'Anh Tuấn');
    assert.equal(tuantx.total_debt, 350000, 'Tổng nợ cộng dồn phải là 350.000đ');
  });

  it('TC-02.03: Khách trả nợ một phần - Dư nợ giảm chính xác & sinh giao dịch DEBT_PAYMENT', () => {
    const cust = addCustomer({ name: 'Chị Mai', phone: '0912345678', total_debt: 500000 });

    const updated = payDebt(cust.id, 200000, 'Chuyển khoản Vietcombank');
    assert.equal(updated.total_debt, 300000, 'Số nợ còn lại phải là 300.000đ');

    const txs = getTransactions();
    const payTx = txs.find((t) => t.type === 'DEBT_PAYMENT');
    assert.ok(payTx, 'Phải sinh giao dịch trả nợ DEBT_PAYMENT');
    assert.equal(payTx.sale_price, 200000, 'Giao dịch trả nợ có giá trị 200.000đ');
    assert.equal(payTx.cost_price, 0, 'Giao dịch trả nợ có giá vốn là 0đ');
  });

  it('TC-02.04: Khách trả nợ vượt quá số nợ hiện có - Chỉ thu tối đa bằng dư nợ, không bị âm', () => {
    const cust = addCustomer({ name: 'Cô Ba', phone: '0988776655', total_debt: 100000 });

    const updated = payDebt(cust.id, 500000);
    assert.equal(updated.total_debt, 0, 'Dư nợ phải về đúng 0đ, không được âm');

    const txs = getTransactions();
    const payTx = txs.find((t) => t.type === 'DEBT_PAYMENT');
    assert.equal(payTx.sale_price, 100000, 'Tiền thu thực tế chỉ bằng 100.000đ');
  });

  it('TC-02.05: Không cho phép trả nợ khi khách không còn nợ hoặc số tiền <= 0', () => {
    const cust = addCustomer({ name: 'Bác Hùng', total_debt: 0 });

    const res1 = payDebt(cust.id, 100000);
    assert.equal(res1, null, 'Không được trả nợ khi dư nợ = 0');

    cust.total_debt = 200000;
    const res2 = payDebt(cust.id, 0);
    assert.equal(res2, null, 'Không được trả nợ với số tiền 0đ');
  });

  it('TC-02.06: Sửa đơn nợ (tăng giá) -> Tăng công nợ theo mức chênh lệch', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Vòng phong thủy',
      sale_price: 200000,
      payment_method: 'DEBT',
      customer_name: 'Khách A',
    });

    updateTransaction(tx.id, { sale_price: 300000 });

    const cust = getCustomers().find((c) => c.name === 'Khách A');
    assert.equal(cust.total_debt, 300000, 'Dư nợ phải tăng thành 300.000đ');
  });

  it('TC-02.07: Sửa đơn nợ (giảm giá) -> Giảm công nợ theo mức chênh lệch', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Vòng phong thủy',
      sale_price: 300000,
      payment_method: 'DEBT',
      customer_name: 'Khách B',
    });

    updateTransaction(tx.id, { sale_price: 180000 });

    const cust = getCustomers().find((c) => c.name === 'Khách B');
    assert.equal(cust.total_debt, 180000, 'Dư nợ phải giảm xuống 180.000đ');
  });

  it('TC-02.08: Chuyển đổi hình thức thanh toán từ NỢ sang TIỀN MẶT -> Hoàn trả giảm nợ', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Lắc bạc',
      sale_price: 200000,
      payment_method: 'DEBT',
      customer_name: 'Khách C',
    });

    assert.equal(getCustomers().find((c) => c.name === 'Khách C').total_debt, 200000);

    updateTransaction(tx.id, { payment_method: 'CASH_TRANSFER' });
    assert.equal(getCustomers().find((c) => c.name === 'Khách C').total_debt, 0, 'Nợ phải giảm về 0');
  });

  it('TC-02.09: Xóa đơn nợ -> Tự động trừ nợ đã ghi nhận trước đó', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Đơn nợ cần xóa',
      sale_price: 150000,
      payment_method: 'DEBT',
      customer_name: 'Khách D',
    });

    assert.equal(getCustomers().find((c) => c.name === 'Khách D').total_debt, 150000);

    deleteTransaction(tx.id);
    assert.equal(getCustomers().find((c) => c.name === 'Khách D').total_debt, 0, 'Nợ phải bị trừ sau khi xóa đơn');
  });

  it('TC-02.10: Xóa giao dịch trả nợ -> Tự động khôi phục lại khoản nợ cho khách', () => {
    const cust = addCustomer({ name: 'Khách E', total_debt: 400000 });
    payDebt(cust.id, 150000);

    assert.equal(getCustomers().find((c) => c.name === 'Khách E').total_debt, 250000);

    const payTx = getTransactions().find((t) => t.type === 'DEBT_PAYMENT');
    deleteTransaction(payTx.id);

    assert.equal(getCustomers().find((c) => c.name === 'Khách E').total_debt, 400000, 'Nợ phải được phục hồi về 400.000đ');
  });
});

// ============================================================
// SUITE 3: THỐNG KÊ & BÁO CÁO DÒNG TIỀN (MONTHLY STATS & CASH FLOW)
// ============================================================
describe('TC-MOD-03: Thống kê Tài chính & Báo cáo Dòng tiền tháng', () => {
  const currentYear = 2026;
  const currentMonth = 10; // Tháng 11 (0-indexed: 10 là tháng 11)

  beforeEach(() => {
    resetStore();

    // 1. Đơn bán hàng thu tiền ngay: Giá bán 200k, giá vốn 100k
    addTransaction({
      type: 'SALE',
      sale_price: 200000,
      cost_price: 100000,
      payment_method: 'CASH_TRANSFER',
      created_at: new Date(currentYear, currentMonth, 5).toISOString(),
    });

    // 2. Đơn COD đã nhận tiền: Giá bán 300k, giá vốn 150k
    addTransaction({
      type: 'SALE',
      sale_price: 300000,
      cost_price: 150000,
      payment_method: 'COD',
      is_cod_received: true,
      created_at: new Date(currentYear, currentMonth, 10).toISOString(),
    });

    // 3. Đơn COD đang chờ bưu điện giao: Giá bán 150k, giá vốn 80k
    addTransaction({
      type: 'SALE',
      sale_price: 150000,
      cost_price: 80000,
      payment_method: 'COD',
      is_cod_received: false,
      created_at: new Date(currentYear, currentMonth, 12).toISOString(),
    });

    // 4. Đơn bán ghi nợ: Giá bán 250k, giá vốn 120k
    addTransaction({
      type: 'SALE',
      sale_price: 250000,
      cost_price: 120000,
      payment_method: 'DEBT',
      customer_name: 'Khách Mua Nợ',
      created_at: new Date(currentYear, currentMonth, 15).toISOString(),
    });

    // 5. Giao dịch khách trả nợ cũ: Thu 100k
    addTransaction({
      type: 'DEBT_PAYMENT',
      sale_price: 100000,
      cost_price: 0,
      created_at: new Date(currentYear, currentMonth, 18).toISOString(),
    });

    // 6. Chi phí tiền bao bì: 50k
    addTransaction({
      type: 'EXPENSE',
      item_name: 'Bao bì/Đóng gói',
      sale_price: 50000,
      cost_price: 0,
      created_at: new Date(currentYear, currentMonth, 20).toISOString(),
    });

    // 7. Giao dịch thuộc tháng trước (loại trừ khỏi thống kê tháng này)
    addTransaction({
      type: 'SALE',
      sale_price: 500000,
      cost_price: 250000,
      payment_method: 'CASH_TRANSFER',
      created_at: new Date(currentYear, currentMonth - 1, 20).toISOString(),
    });
  });

  it('TC-03.01: Tính chính xác Doanh thu phát sinh (Total Revenue)', () => {
    const stats = getMonthlyStats(currentYear, currentMonth);
    // Tổng đơn bán trong tháng: 200k + 300k + 150k + 250k = 900.000đ
    assert.equal(stats.totalRevenue, 900000, 'Doanh thu phát sinh phải là 900.000đ');
  });

  it('TC-03.02: Tính chính xác Tổng giá vốn hàng bán (COGS)', () => {
    const stats = getMonthlyStats(currentYear, currentMonth);
    // Giá vốn đơn bán: 100k + 150k + 80k + 120k = 450.000đ
    assert.equal(stats.totalCost, 450000, 'Tổng giá vốn phải là 450.000đ');
  });

  it('TC-03.03: Tính chính xác Tổng chi phí phát sinh (Total Expense)', () => {
    const stats = getMonthlyStats(currentYear, currentMonth);
    assert.equal(stats.totalExpense, 50000, 'Tổng chi phí hoạt động là 50.000đ');
  });

  it('TC-03.04: Tính chính xác Lợi nhuận thuần (Net Profit = Doanh thu - Giá vốn - Chi phí)', () => {
    const stats = getMonthlyStats(currentYear, currentMonth);
    // Lợi nhuận = 900k - 450k - 50k = 400.000đ
    assert.equal(stats.profit, 400000, 'Lợi nhuận thuần kinh doanh là 400.000đ');
  });

  it('TC-03.05: Tính chính xác Dòng tiền vào thực tế (Actual Cash Inflow)', () => {
    const report = getDetailedCashFlowReport(currentYear, currentMonth);
    // Tiền mặt: 200k (bán ngay) + 300k (COD nhận) + 100k (thu nợ) = 600.000đ
    // Nợ 250k và COD chưa thu 150k KHÔNG được tính vào dòng tiền thực thu
    assert.equal(report.cashSaleIncome, 200000, 'Thu tiền bán ngay: 200.000đ');
    assert.equal(report.codReceivedIncome, 300000, 'Thu COD đã nhận: 300.000đ');
    assert.equal(report.debtPaymentIncome, 100000, 'Thu khách trả nợ: 100.000đ');
    assert.equal(report.actualCashInflow, 600000, 'Dòng tiền vào thực tế: 600.000đ');
  });

  it('TC-03.06: Tính chính xác Dòng tiền ròng thực tế (Net Cash Flow = Tiền vào - Chi phí)', () => {
    const report = getDetailedCashFlowReport(currentYear, currentMonth);
    // Dòng tiền ròng = 600k (thực thu) - 50k (chi phí) = 550.000đ
    assert.equal(report.netCashFlow, 550000, 'Dòng tiền ròng thực tế là 550.000đ');
  });

  it('TC-03.07: Thống kê chính xác các khoản tiền Chờ thu (Pending Receivables)', () => {
    const report = getDetailedCashFlowReport(currentYear, currentMonth);
    assert.equal(report.pendingDebtCreated, 250000, 'Nợ mới phát sinh: 250.000đ');
    assert.equal(report.pendingCodAmount, 150000, 'COD bưu điện đang giữ: 150.000đ');
  });

  it('TC-03.08: Phân loại chi phí đúng theo danh mục', () => {
    const report = getDetailedCashFlowReport(currentYear, currentMonth);
    assert.equal(report.expensesByCategory['Bao bì/Đóng gói'], 50000, 'Chi phí bao bì là 50.000đ');
    assert.equal(report.expensesByCategory['Nhập hàng'], 0, 'Chi phí nhập hàng là 0đ');
  });
});


// ============================================================
// SUITE 4: TÍNH TOÁN ĐỐI SOÁT COD (GIAO HÀNG BƯU ĐIỆN)
// ============================================================
describe('TC-MOD-04: Đối soát Giao hàng COD', () => {
  beforeEach(() => resetStore());

  it('TC-04.01: Đánh dấu đã nhận COD -> Tăng tiền thực thu, giảm tiền chờ thu', () => {
    const codTx = addTransaction({
      type: 'SALE',
      sale_price: 220000,
      cost_price: 110000,
      payment_method: 'COD',
      is_cod_received: false,
      created_at: new Date(2026, 10, 1).toISOString(),
    });

    let report = getDetailedCashFlowReport(2026, 10);
    assert.equal(report.pendingCodAmount, 220000, 'Ban đầu COD nằm ở chờ thu');
    assert.equal(report.codReceivedIncome, 0, 'Chưa có tiền COD thực thu');

    markCodReceived(codTx.id, true);

    report = getDetailedCashFlowReport(2026, 10);
    assert.equal(report.pendingCodAmount, 0, 'COD chờ thu đã chuyển về 0');
    assert.equal(report.codReceivedIncome, 220000, 'COD thực thu tăng lên 220.000đ');
    assert.equal(report.actualCashInflow, 220000, 'Dòng tiền vào thực tế tăng lên');
  });
});

// ============================================================
// SUITE 5: BÁO CÁO DOANH THU THEO KỲ (REVENUE REPORT BY PERIOD)
// ============================================================
describe('TC-MOD-05: Báo cáo Doanh thu theo kỳ (Today / Month / All)', () => {
  beforeEach(() => {
    resetStore();
    const today = new Date();

    addTransaction({
      type: 'SALE',
      sale_price: 100000,
      cost_price: 40000,
      quantity: 2,
      payment_method: 'CASH_TRANSFER',
      created_at: today.toISOString(),
    });

    addTransaction({
      type: 'SALE',
      sale_price: 300000,
      cost_price: 150000,
      quantity: 1,
      payment_method: 'DEBT',
      created_at: today.toISOString(),
    });

    addTransaction({
      type: 'EXPENSE',
      sale_price: 20000,
      created_at: today.toISOString(),
    });
  });

  it('TC-05.01: Tổng hợp chính xác báo cáo trong ngày hôm nay', () => {
    const report = getRevenueReportData('today');
    const { totals } = report;

    assert.equal(totals.orderCount, 2, 'Số đơn bán: 2');
    assert.equal(totals.totalQuantity, 3, 'Tổng số sản phẩm bán: 3 (2 + 1)');
    assert.equal(totals.revenue, 400000, 'Tổng doanh thu: 400.000đ (100k + 300k)');
    assert.equal(totals.actualIncome, 100000, 'Thực thu: 100.000đ (chỉ tính tiền mặt)');
    assert.equal(totals.debt, 300000, 'Nợ phát sinh: 300.000đ');
    assert.equal(totals.expense, 20000, 'Chi phí: 20.000đ');
    assert.equal(totals.profit, 400000 - 190000 - 20000, 'Lợi nhuận ròng = 400k - 190k - 20k = 190.000đ');
  });
});

// ============================================================
// SUITE 6: ĐỊNH DẠNG TIỀN TỆ (CURRENCY FORMATTING)
// ============================================================
describe('TC-MOD-06: Định dạng Tiền tệ formatMoney', () => {
  it('TC-06.01: Định dạng rút gọn "...tr" cho số tiền >= 1.000.000đ', () => {
    assert.equal(formatMoney(1000000), '1tr', '1 triệu rút gọn thành 1tr');
    assert.equal(formatMoney(1500000), '1.5tr', '1.5 triệu rút gọn thành 1.5tr');
    assert.equal(formatMoney(2000000), '2tr', '2 triệu rút gọn thành 2tr');
    assert.equal(formatMoney(10500000), '10.5tr', '10.5 triệu');
  });

  it('TC-06.02: Định dạng rút gọn cho số âm >= 1.000.000đ', () => {
    assert.equal(formatMoney(-1500000), '-1.5tr', '-1.5 triệu');
    assert.equal(formatMoney(-2000000), '-2tr', '-2 triệu');
  });

  it('TC-06.03: Định dạng phân tách hàng nghìn vi-VN cho số tiền < 1.000.000đ', () => {
    assert.equal(formatMoney(150000), '150.000đ');
    assert.equal(formatMoney(50000), '50.000đ');
    assert.equal(formatMoney(999000), '999.000đ');
  });

  it('TC-06.04: Xử lý an toàn các giá trị 0, rỗng, null, undefined, NaN', () => {
    assert.equal(formatMoney(0), '0đ');
    assert.equal(formatMoney(null), '0đ');
    assert.equal(formatMoney(undefined), '0đ');
    assert.equal(formatMoney(''), '0đ');
    assert.equal(formatMoney('abc'), '0đ');
  });
});

// ============================================================
// SUITE 7: KIỂM THỬ BIÊN & DỮ LIỆU ĐẶC BIỆT (BOUNDARY & EDGE CASES)
// ============================================================
describe('TC-MOD-07: Kiểm thử Biên & Dữ liệu đặc biệt', () => {
  beforeEach(() => resetStore());

  it('TC-07.01: Đơn hàng 0đ (Khuyến mãi / Tặng quà) - Hệ thống xử lý không lỗi', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Quà tặng tri ân',
      sale_price: 0,
      cost_price: 15000,
      payment_method: 'CASH_TRANSFER',
      created_at: new Date(2026, 10, 5).toISOString(),
    });

    assert.equal(tx.sale_price, 0);
    const stats = getMonthlyStats(2026, 10);
    assert.equal(stats.totalRevenue, 0);
    assert.equal(stats.profit, -15000, 'Lợi nhuận âm đúng bằng giá vốn quà tặng');
  });

  it('TC-07.02: Giá vốn 0đ (Hàng tự làm, quà không tốn vốn)', () => {
    const tx = addTransaction({
      type: 'SALE',
      item_name: 'Hàng thủ công',
      sale_price: 100000,
      cost_price: 0,
      payment_method: 'CASH_TRANSFER',
      created_at: new Date(2026, 10, 5).toISOString(),
    });

    assert.equal(tx.cost_price, 0);
    const stats = getMonthlyStats(2026, 10);
    assert.equal(stats.profit, 100000, 'Lợi nhuận bằng 100% doanh thu');
  });

  it('TC-07.03: Khách hàng thanh toán trả nợ nhiều lần liên tiếp', () => {
    const cust = addCustomer({ name: 'Khách VIP', total_debt: 1000000 });

    payDebt(cust.id, 300000);
    assert.equal(getCustomers().find((c) => c.name === 'Khách VIP').total_debt, 700000);

    payDebt(cust.id, 400000);
    assert.equal(getCustomers().find((c) => c.name === 'Khách VIP').total_debt, 300000);

    payDebt(cust.id, 300000);
    assert.equal(getCustomers().find((c) => c.name === 'Khách VIP').total_debt, 0);
  });
});

// ============================================================
// SUITE 8: KIỂM THỬ ENGINE PRICING (CHIẾT KHẤU, VAT, PHÍ SHIP, TIỀN THỪA)
// ============================================================
describe('TC-MOD-08: Core Pricing Engine (Chiết khấu, VAT, Phí Ship, Tiền Thừa)', () => {
  it('TC-08.01: Khử sai số số thực và làm tròn thành tiền chuẩn xác', () => {
    assert.equal(calculateLineTotal(0.1, 3), 0);
    assert.equal(calculateLineTotal(150000, 0.5), 75000);
    assert.equal(calculateLineTotal(33333, 1.3), 43333);
    assert.equal(calculateLineTotal(100000, 0), 100000, 'Số lượng 0 chuẩn hóa thành 1');
    assert.equal(calculateLineTotal(100000, -2), 100000, 'Số lượng âm chuẩn hóa thành 1');
  });

  it('TC-08.02: Chiết khấu % chuẩn và chặn các giá trị biên (> 100%, < 0%)', () => {
    // 200k giảm 10% = 20k -> còn 180k
    const normal = calculateDiscount(200000, { discountType: 'PERCENT', discountValue: 10 });
    assert.equal(normal.discountAmount, 20000);
    assert.equal(normal.effectiveSubtotal, 180000);

    // % lẻ: 155.555đ giảm 15% -> 23.333,25 -> 23.333đ
    const odd = calculateDiscount(155555, { discountType: 'PERCENT', discountValue: 15 });
    assert.equal(odd.discountAmount, 23333);
    assert.equal(odd.effectiveSubtotal, 132222);

    // Vượt 100%: giảm 150% -> clamp về 100%, không bị âm tiền
    const over100 = calculateDiscount(100000, { discountType: 'PERCENT', discountValue: 150 });
    assert.equal(over100.discountPercent, 100);
    assert.equal(over100.discountAmount, 100000);
    assert.equal(over100.effectiveSubtotal, 0);

    // Giảm âm: -20% -> clamp về 0%
    const negative = calculateDiscount(100000, { discountType: 'PERCENT', discountValue: -20 });
    assert.equal(negative.discountPercent, 0);
    assert.equal(negative.discountAmount, 0);
  });

  it('TC-08.03: Chiết khấu tiền mặt (FIXED) và không vượt quá tổng tiền', () => {
    const fixed = calculateDiscount(200000, { discountType: 'FIXED', discountValue: 50000 });
    assert.equal(fixed.discountAmount, 50000);
    assert.equal(fixed.effectiveSubtotal, 150000);

    // Vượt tổng tiền: giảm 300k trên đơn 200k
    const overFixed = calculateDiscount(200000, { discountType: 'FIXED', discountValue: 300000 });
    assert.equal(overFixed.discountAmount, 200000);
    assert.equal(overFixed.effectiveSubtotal, 0);
  });

  it('TC-08.04: Thứ tự ưu tiên tính toán chuẩn: Tiền hàng -> Trừ giảm giá -> Tính VAT -> Cộng Phí Ship', () => {
    // Đơn: 100.000đ x 2 = 200.000đ
    // Giảm giá cố định: 20.000đ -> Sau giảm 180.000đ
    // VAT 8%: 180.000 x 8% = 14.400đ (VAT tính trên giá SAU giảm giá)
    // Phí ship: 30.000đ
    // Tổng thanh toán = 180.000 + 14.400 + 30.000 = 224.400đ
    const result = calculateOrderTotals({
      unitPrice: 100000,
      quantity: 2,
      discountType: 'FIXED',
      discountValue: 20000,
      taxRate: 8,
      shippingFee: 30000,
    });

    assert.equal(result.subtotal, 200000);
    assert.equal(result.discountAmount, 20000);
    assert.equal(result.effectiveSubtotal, 180000);
    assert.equal(result.taxAmount, 14400);
    assert.equal(result.shippingFee, 30000);
    assert.equal(result.totalAmount, 224400);
  });

  it('TC-08.05: Tính chính xác Tiền thừa trả khách & Tiền nợ còn lại', () => {
    // Khách đưa dư
    const over = calculateOrderTotals({
      unitPrice: 120000,
      quantity: 1,
      customerPaid: 200000,
    });
    assert.equal(over.changeAmount, 80000);
    assert.equal(over.remainingDebt, 0);

    // Khách đưa thiếu
    const under = calculateOrderTotals({
      unitPrice: 150000,
      quantity: 1,
      customerPaid: 100000,
    });
    assert.equal(under.changeAmount, 0);
    assert.equal(under.remainingDebt, 50000);
  });
});

// ============================================================
// SUITE 9: KIỂM THỬ TRỪ / HOÀN TỒN KHO & LỢI NHUẬN GỘP
// ============================================================
describe('TC-MOD-09: Quản lý Trừ / Hoàn tồn kho (Inventory)', () => {
  beforeEach(() => resetStore());

  it('TC-09.01: Tự động trừ tồn kho khi tạo đơn bán hàng mới', () => {
    // Lấy món có tồn kho
    const items = getItems();
    const item = items[0]; // Vòng tay đá
    item.stock = 50;

    addTransaction({
      type: 'SALE',
      item_name: item.name,
      sale_price: 150000,
      cost_price: 80000,
      quantity: 5,
    });

    const currentItem = getItems().find((i) => i.name === item.name);
    assert.equal(currentItem.stock, 45, 'Tồn kho ban đầu 50 bán 5 phải còn 45');
  });

  it('TC-09.02: Tự động hoàn lại tồn kho khi xóa đơn bán hàng', () => {
    const items = getItems();
    const item = items[0];
    item.stock = 45;

    const tx = addTransaction({
      type: 'SALE',
      item_name: item.name,
      sale_price: 150000,
      cost_price: 80000,
      quantity: 5,
    });
    const afterSale = getItems().find((i) => i.name === item.name);
    assert.equal(afterSale.stock, 40);

    // Xóa đơn
    deleteTransaction(tx.id);
    const afterDelete = getItems().find((i) => i.name === item.name);
    assert.equal(afterDelete.stock, 45, 'Sau khi xóa đơn bán, tồn kho phải được hoàn lại 45');
  });

  it('TC-09.03: Điều chỉnh tồn kho khi cập nhật số lượng đơn bán hàng', () => {
    const items = getItems();
    const item = items[0];
    item.stock = 50;

    const tx = addTransaction({
      type: 'SALE',
      item_name: item.name,
      sale_price: 150000,
      cost_price: 80000,
      quantity: 2,
    });
    const afterSale = getItems().find((i) => i.name === item.name);
    assert.equal(afterSale.stock, 48);

    // Sửa tăng từ 2 lên 5 -> trừ thêm 3
    updateTransaction(tx.id, { quantity: 5 });
    const afterIncrease = getItems().find((i) => i.name === item.name);
    assert.equal(afterIncrease.stock, 45);

    // Sửa giảm từ 5 xuống 1 -> hoàn lại 4
    updateTransaction(tx.id, { quantity: 1 });
    const afterDecrease = getItems().find((i) => i.name === item.name);
    assert.equal(afterDecrease.stock, 49);
  });
});


