/**
 * ===================================================================
 * Artemis / Flowers_QLBH - Unit Test Suite for Calculation Engine
 * ===================================================================
 * Chạy bằng Node test runner: `node --test test_calculations.test.js`
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
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
} from './src/utils/pricing.js';

describe('1. Kiểm thử Thành tiền (Line Total & Floating-point)', () => {
  test('Tính đúng phép nhân cơ bản: 50.000 x 3 = 150.000', () => {
    const total = calculateLineTotal(50000, 3);
    assert.equal(total, 150000);
  });

  test('Khử sai số số thực IEEE-754: 0.1 x 3 = 0', () => {
    // 0.1 * 3 = 0.30000000000000004 -> round to 0
    const total = calculateLineTotal(0.1, 3);
    assert.equal(total, 0);
  });

  test('Số lượng lẻ thập phân (ví dụ 0.5 kg hoa với giá 150.000/kg): 150.000 x 0.5 = 75.000', () => {
    const total = calculateLineTotal(150000, 0.5);
    assert.equal(total, 75000);
  });

  test('Số lượng lẻ 1.3 mét x 33.333đ = 43.333đ (Làm tròn chuẩn)', () => {
    const total = calculateLineTotal(33333, 1.3);
    assert.equal(total, Math.round(33333 * 1.3));
  });

  test('Giá trị biên: Số lượng <= 0 thì tự động fallback về 1 hoặc clamp an toàn', () => {
    assert.equal(calculateLineTotal(50000, 0), 50000);
    assert.equal(calculateLineTotal(50000, -5), 50000);
    assert.equal(calculateLineTotal(-20000, 2), 0);
  });
});

describe('2. Kiểm thử Chiết khấu & Voucher (Discount)', () => {
  test('Chiết khấu % chuẩn: Đơn 200.000đ giảm 10% = 20.000đ, còn 180.000đ', () => {
    const res = calculateDiscount(200000, { discountType: 'PERCENT', discountValue: 10 });
    assert.equal(res.discountAmount, 200000 * 0.1);
    assert.equal(res.effectiveSubtotal, 180000);
  });

  test('Khử sai số làm tròn khi % lẻ: Đơn 155.555đ giảm 15%', () => {
    // 155555 * 0.15 = 23333.25 -> round to 23333
    const res = calculateDiscount(155555, { discountType: 'PERCENT', discountValue: 15 });
    assert.equal(res.discountAmount, 23333);
    assert.equal(res.effectiveSubtotal, 132222);
  });

  test('Giá trị biên: Giảm giá > 100% phải bị clamp chặn ở 100%, không bị âm tiền', () => {
    const res = calculateDiscount(100000, { discountType: 'PERCENT', discountValue: 150 });
    assert.equal(res.discountPercent, 100);
    assert.equal(res.discountAmount, 100000);
    assert.equal(res.effectiveSubtotal, 0);
  });

  test('Giá trị biên: Giảm giá âm (< 0%) phải bị clamp chặn ở 0%', () => {
    const res = calculateDiscount(100000, { discountType: 'PERCENT', discountValue: -20 });
    assert.equal(res.discountPercent, 0);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.effectiveSubtotal, 100000);
  });

  test('Chiết khấu tiền mặt (FIXED): Giảm 50.000đ trên đơn 200.000đ', () => {
    const res = calculateDiscount(200000, { discountType: 'FIXED', discountValue: 50000 });
    assert.equal(res.discountAmount, 50000);
    assert.equal(res.effectiveSubtotal, 150000);
  });

  test('Chiết khấu tiền mặt vượt quá tổng tiền: Giảm 300.000đ trên đơn 200.000đ chỉ giảm tối đa 200.000đ', () => {
    const res = calculateDiscount(200000, { discountType: 'FIXED', discountValue: 300000 });
    assert.equal(res.discountAmount, 200000);
    assert.equal(res.effectiveSubtotal, 0);
  });
});

describe('3. Kiểm thử Thuế VAT & Thứ tự ưu tiên tính toán', () => {
  test('VAT tính trên giá trị SAU giảm giá (không tính trên giá gốc)', () => {
    // Đơn 200.000đ, giảm 50.000đ -> Còn 150.000đ.
    // VAT 10% = 15.000đ (KHÔNG PHẢI 20.000đ)
    const effectiveSubtotal = 150000;
    const vat = calculateTax(effectiveSubtotal, 10);
    assert.equal(vat, 15000);
  });

  test('VAT không được âm và không được vượt quá 100%', () => {
    assert.equal(calculateTax(100000, -10), 0);
    assert.equal(calculateTax(100000, 150), 100000);
  });
});

describe('4. Kiểm thử Phí ship & Tổng thanh toán (Grand Total)', () => {
  test('Thứ tự ưu tiên chuẩn: (Thành tiền - Giảm giá) + VAT + Phí ship', () => {
    // Đơn: Đơn giá 100.000 x 2 = 200.000đ
    // Giảm giá 20.000đ -> Sau giảm 180.000đ
    // VAT 8% -> 180.000 x 8% = 14.400đ
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

  test('Tổng thanh toán không bao giờ âm kể cả khi giảm giá 100%', () => {
    const result = calculateOrderTotals({
      unitPrice: 100000,
      quantity: 1,
      discountType: 'PERCENT',
      discountValue: 100,
      taxRate: 10,
      shippingFee: 25000,
    });
    // Tiền hàng = 0, VAT = 0, Phí ship = 25.000
    assert.equal(result.totalAmount, 25000);
  });
});

describe('5. Kiểm thử Tiền thừa trả khách & Công nợ', () => {
  test('Khách đưa dư tiền: Tổng 120.000đ, khách đưa 200.000đ -> Tiền thừa 80.000đ', () => {
    const result = calculateOrderTotals({
      unitPrice: 120000,
      quantity: 1,
      customerPaid: 200000,
    });
    assert.equal(result.totalAmount, 120000);
    assert.equal(result.customerPaid, 200000);
    assert.equal(result.changeAmount, 80000);
    assert.equal(result.remainingDebt, 0);
  });

  test('Khách đưa thiếu tiền: Tổng 150.000đ, khách đưa 100.000đ -> Tiền thừa 0đ, Còn nợ 50.000đ', () => {
    const result = calculateOrderTotals({
      unitPrice: 150000,
      quantity: 1,
      customerPaid: 100000,
    });
    assert.equal(result.totalAmount, 150000);
    assert.equal(result.customerPaid, 100000);
    assert.equal(result.changeAmount, 0);
    assert.equal(result.remainingDebt, 50000);
  });

  test('Khách đưa đúng tiền: Tổng 100.000đ, khách đưa 100.000đ -> Tiền thừa 0đ, nợ 0đ', () => {
    const result = calculateOrderTotals({
      unitPrice: 100000,
      quantity: 1,
      customerPaid: 100000,
    });
    assert.equal(result.changeAmount, 0);
    assert.equal(result.remainingDebt, 0);
  });
});

describe('6. Kiểm thử Doanh thu, Lợi nhuận gộp & Lợi nhuận ròng', () => {
  test('Tính đúng Lợi nhuận gộp = Doanh thu thuần - Giá vốn', () => {
    // Bán 10 cái áo giá 200.000đ (Vốn 120.000đ), giảm giá 10%
    // Doanh thu = 200.000 x 10 - 200.000 = 1.800.000đ
    // Giá vốn = 120.000 x 10 = 1.200.000đ
    // Lợi nhuận gộp = 1.800.000 - 1.200.000 = 600.000đ
    const result = calculateOrderTotals({
      unitPrice: 200000,
      quantity: 10,
      unitCost: 120000,
      discountType: 'PERCENT',
      discountValue: 10,
    });
    assert.equal(result.grossProfit, 600000);
  });

  test('Tính Lợi nhuận ròng không bị trừ đúp chi phí', () => {
    // Doanh thu: 10.000.000đ
    // Giá vốn hàng bán: 6.000.000đ
    // Chi phí hoạt động (mặt bằng, điện nước): 1.500.000đ
    // Lợi nhuận gộp = 4.000.000đ
    // Lợi nhuận ròng = 4.000.000 - 1.500.000 = 2.500.000đ
    const profit = calculateProfit({
      revenue: 10000000,
      costOfGoods: 6000000,
      operatingExpenses: 1500000,
    });
    assert.equal(profit.grossProfit, 4000000);
    assert.equal(profit.netProfit, 2500000);
    assert.equal(profit.profitMargin, 25);
  });
});

describe('7. Kiểm thử Trừ / Hoàn tồn kho (Inventory)', () => {
  test('Trừ tồn kho khi bán hàng: Ban đầu 10, bán 3 -> Còn 7', () => {
    const res = calculateStockChange(10, 3, 'DEDUCT');
    assert.equal(res.newStock, 7);
    assert.equal(res.isOutOfStock, false);
  });

  test('Bán vượt tồn kho: Ban đầu 2, bán 5 -> Còn -3, đánh dấu out of stock', () => {
    const res = calculateStockChange(2, 5, 'DEDUCT');
    assert.equal(res.newStock, -3);
    assert.equal(res.isOutOfStock, true);
  });

  test('Hoàn tồn kho khi hủy/xóa đơn: Ban đầu 7, hủy đơn 3 -> Phục hồi lên 10', () => {
    const res = calculateStockChange(7, 3, 'RESTORE');
    assert.equal(res.newStock, 10);
    assert.equal(res.isOutOfStock, false);
  });

  test('Món không theo dõi kho (stock = null) thì không thay đổi', () => {
    const res = calculateStockChange(null, 5, 'DEDUCT');
    assert.equal(res.newStock, null);
  });
});

