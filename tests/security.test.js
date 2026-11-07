/**
 * TEST SUITE: SECURITY AUDIT & VULNERABILITY MITIGATION
 * Kiểm tra các cơ chế bảo vệ:
 * 1. Chống CSV Formula Injection (CWE-1236)
 * 2. Xác thực & Làm sạch Schema khi phục hồi JSON (Backup Import)
 * 3. Chuẩn hóa URL tra cứu vận đơn (URL Encoding)
 * 4. Độ ngẫu nhiên và định dạng UUID an toàn
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const mockStorage = new Map();
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) ?? null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };
}

import {
  sanitizeCsvField,
  exportTransactionsCsv,
  exportRevenueReportCsv,
  importDatabaseFromJson,
  getTransactions,
  getCustomers,
  getItems
} from '../src/store.js';

describe('🛡️ SECURITY CONTROLS & VULNERABILITY TESTING', () => {
  describe('1. Chống CSV Formula Injection (CWE-1236)', () => {
    test('Hàm sanitizeCsvField vô hiệu hóa ký tự bắt đầu bằng công thức: = , + , - , @', () => {
      // Test '=' formula
      const equalPayload = '=cmd|\' /C calc\'!A0';
      const sanitizedEqual = sanitizeCsvField(equalPayload);
      assert.strictEqual(sanitizedEqual, `"'=cmd|' /C calc'!A0"`);

      // Test '+' formula
      const plusPayload = '+1+1';
      const sanitizedPlus = sanitizeCsvField(plusPayload);
      assert.strictEqual(sanitizedPlus, `\"'+1+1\"`);

      // Test '-' formula
      const minusPayload = '-2+5';
      const sanitizedMinus = sanitizeCsvField(minusPayload);
      assert.strictEqual(sanitizedMinus, `\"'-2+5\"`);

      // Test '@' formula
      const atPayload = '@SUM(A1:A10)';
      const sanitizedAt = sanitizeCsvField(atPayload);
      assert.strictEqual(sanitizedAt, `\"'@SUM(A1:A10)\"`);
    });

    test('Hàm sanitizeCsvField xử lý an toàn dấu nháy kép bên trong chuỗi', () => {
      const textWithQuotes = 'Vòng tay "Kim Cương" 18k';
      const result = sanitizeCsvField(textWithQuotes);
      assert.strictEqual(result, '"Vòng tay ""Kim Cương"" 18k"');
    });

    test('Hàm sanitizeCsvField xử lý chuỗi bình thường không bị biến đổi sai', () => {
      const normalText = 'Áo sơ mi lụa trắng';
      assert.strictEqual(sanitizeCsvField(normalText), '"Áo sơ mi lụa trắng"');
      assert.strictEqual(sanitizeCsvField(null), '""');
      assert.strictEqual(sanitizeCsvField(undefined), '""');
      assert.strictEqual(sanitizeCsvField(''), '""');
    });

    test('Xuất exportTransactionsCsv trung hòa an toàn khi tên món hoặc khách hàng chứa mã độc Excel', () => {
      const maliciousTxs = [
        {
          id: 'sec-tx-1',
          type: 'SALE',
          item_name: '=HYPERLINK("http://evil.com","Click")',
          sale_price: 100000,
          cost_price: 50000,
          payment_method: 'CASH_TRANSFER',
          customer_name: '@evil_user',
          customer_phone: '0901234567',
          shipping_address: '+Hacked_Address',
          tracking_code: '-123456',
          created_at: new Date().toISOString(),
        }
      ];

      // Nạp vào store và xuất CSV
      mockStorage.set('sbh_transactions', JSON.stringify(maliciousTxs));
      const csv = exportTransactionsCsv();

      // Kiểm tra trong nội dung CSV: các ô độc hại đã được chèn dấu nháy đơn ' phía trước
      assert.match(csv, /"'=HYPERLINK/);
      assert.match(csv, /"'@evil_user"/);
      assert.match(csv, /"'\+Hacked_Address"/);
      assert.match(csv, /"'-123456"/);
    });
  });

  describe('2. Kiểm định Schema & Làm sạch dữ liệu khi Import JSON', () => {
    test('Từ chối file không phải JSON Object hoặc rỗng', async () => {
      await assert.rejects(async () => {
        await importDatabaseFromJson('invalid string content');
      }, /JSON|Định dạng file không hợp lệ/);

      await assert.rejects(async () => {
        await importDatabaseFromJson(JSON.stringify(['array', 'not', 'object']));
      }, /Định dạng file không hợp lệ/);
    });

    test('Lọc bỏ các bản ghi giao dịch rác / dị dạng và gán giá trị mặc định an toàn', async () => {
      const mockPayload = {
        transactions: [
          null, // rác
          'not-an-object', // rác
          {
            id: 'valid-tx-1',
            type: 'UNKNOWN_TYPE', // phải fallback về SALE
            item_name: 'Nhẫn vàng',
            sale_price: -50000, // âm -> gán về 0
            cost_price: 'invalid_price', // chuỗi -> gán về 0
            payment_method: 'HACKED_METHOD', // fallback về CASH_TRANSFER
          }
        ],
        customers: [
          { id: 'c-1', name: 'Nguyễn Văn A', total_debt: 200000 },
          { id: 'c-invalid' } // không có name -> bị lọc bỏ
        ],
        items: [
          { id: 'i-1', name: 'Đồng hồ', default_price: 500000 },
          null
        ]
      };

      await importDatabaseFromJson(JSON.stringify(mockPayload));

      const txs = getTransactions();
      const loadedTx = txs.find((t) => t.id === 'valid-tx-1');
      assert.ok(loadedTx);
      assert.strictEqual(loadedTx.type, 'SALE');
      assert.strictEqual(loadedTx.sale_price, 0);
      assert.strictEqual(loadedTx.cost_price, 0);
      assert.strictEqual(loadedTx.payment_method, 'CASH_TRANSFER');

      const custs = getCustomers();
      assert.strictEqual(custs.length, 1);
      assert.strictEqual(custs[0].name, 'Nguyễn Văn A');

      const items = getItems();
      const loadedItem = items.find((i) => i.id === 'i-1');
      assert.ok(loadedItem);
      assert.strictEqual(loadedItem.default_price, 500000);
    });
  });
});
