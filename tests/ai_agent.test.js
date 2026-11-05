/**
 * TEST SUITE: AI FUNCTION CALLING AGENT & BUSINESS RULES ENGINE
 */
import test, { describe, beforeEach } from 'node:test';
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

import { ecommerceDb, ORDER_STATUS, STATUS_LABELS } from '../src/agent/ecommerceDb.js';
import { executeToolCall, processAgentMessage } from '../src/agent/aiAgentEngine.js';
import { addCustomer, getDebtSummary } from '../src/store.js';

describe('🏹 AI AGENT E-COMMERCE CORE & SAFETY RULES', () => {
  beforeEach(() => {
    ecommerceDb.reset();
  });

  describe('1. Tra cứu đơn hàng (get_order_status)', () => {
    test('Tra cứu đơn hàng hợp lệ ORD-1001 trả về thông tin chi tiết', async () => {
      const result = await executeToolCall('get_order_status', { order_id: 'ORD-1001' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.order.order_id, 'ORD-1001');
      assert.strictEqual(result.order.status, ORDER_STATUS.PENDING);
      assert.strictEqual(result.order.customer_name, 'Nguyễn Văn An');
      assert.strictEqual(result.cardType, 'ORDER_STATUS_CARD');
    });

    test('Tra cứu đơn hàng không tồn tại ORD-9999 trả về thông báo lỗi thân thiện', async () => {
      const result = await executeToolCall('get_order_status', { order_id: 'ORD-9999' });
      assert.strictEqual(result.success, false);
      assert.match(result.error, /Không tìm thấy đơn hàng/);
    });
  });

  describe('2. Ràng buộc an toàn & Human-In-The-Loop khi Tạo đơn (create_order)', () => {
    test('Từ chối khi số lượng sản phẩm <= 0', () => {
      assert.throws(() => {
        ecommerceDb.stageOrderCreation({
          customer_name: 'Nguyễn Văn A',
          phone: '0901234567',
          delivery_address: '123 Đường ABC, Quận 1',
          items: [{ product_id: 'PROD-01', quantity: 0 }]
        });
      }, /phải là số nguyên dương/);
    });

    test('Từ chối số điện thoại không đúng chuẩn di động Việt Nam', () => {
      assert.throws(() => {
        ecommerceDb.stageOrderCreation({
          customer_name: 'Nguyễn Văn A',
          phone: '123456',
          delivery_address: '123 Đường ABC, Quận 1',
          items: [{ product_id: 'PROD-01', quantity: 1 }]
        });
      }, /Số điện thoại "123456" không hợp lệ/);
    });

    test('Tạo đơn hợp lệ sinh Bản nháp (Draft Preview) và KHÔNG ghi ngay vào DB', () => {
      const initialOrdersCount = ecommerceDb.getAllOrders().length;
      const initialStock = ecommerceDb.findProduct('PROD-01').stock;

      const stageRes = ecommerceDb.stageOrderCreation({
        customer_name: 'Hoàng Yến',
        phone: '0935112233',
        delivery_address: '45 Võ Văn Tần, Quận 3, TP.HCM',
        items: [{ product_id: 'PROD-01', quantity: 2 }]
      });

      assert.strictEqual(ecommerceDb.getAllOrders().length, initialOrdersCount);
      assert.strictEqual(ecommerceDb.findProduct('PROD-01').stock, initialStock);
      assert.strictEqual(stageRes.requiresConfirmation, true);
      assert.ok(stageRes.actionId);
      assert.strictEqual(stageRes.preview.customer_name, 'Hoàng Yến');
    });

    test('Xác nhận (Commit Action) bản nháp tạo đơn thành công và trừ kho', () => {
      const initialOrdersCount = ecommerceDb.getAllOrders().length;
      const product = ecommerceDb.findProduct('PROD-01');
      const initialStock = product.stock;

      const stageRes = ecommerceDb.stageOrderCreation({
        customer_name: 'Hoàng Yến',
        phone: '0935112233',
        delivery_address: '45 Võ Văn Tần, Quận 3, TP.HCM',
        items: [{ product_id: 'PROD-01', quantity: 2 }]
      });

      const commitRes = ecommerceDb.commitAction(stageRes.actionId);
      assert.strictEqual(commitRes.success, true);
      assert.strictEqual(ecommerceDb.getAllOrders().length, initialOrdersCount + 1);
      assert.strictEqual(product.stock, initialStock - 2);
    });
  });
  describe('3. Ràng buộc trạng thái đơn hàng khi Chỉnh sửa / Hủy (update_order)', () => {
    test('⛔ Từ chối hủy đơn khi đơn ở trạng thái SHIPPING (Đang vận chuyển)', () => {
      assert.throws(() => {
        ecommerceDb.stageOrderUpdate({
          order_id: 'ORD-1003',
          action: 'cancel_order',
          payload: { reason: 'Tôi đổi ý' }
        });
      }, /TỪ CHỐI HỦY ĐƠN.*Đang vận chuyển/);
    });

    test('⛔ Từ chối đổi số lượng khi đơn ở trạng thái SHIPPING (Đang vận chuyển)', () => {
      assert.throws(() => {
        ecommerceDb.stageOrderUpdate({
          order_id: 'ORD-1003',
          action: 'change_quantity',
          payload: { product_id: 'PROD-03', new_quantity: 3 }
        });
      }, /TỪ CHỐI CHỈNH SỬA.*Đang vận chuyển/);
    });

    test('⛔ Từ chối sửa hoặc hủy đơn khi đơn ở trạng thái DELIVERED (Đã hoàn thành)', () => {
      assert.throws(() => {
        ecommerceDb.stageOrderUpdate({
          order_id: 'ORD-1004',
          action: 'cancel_order',
          payload: {}
        });
      }, /TỪ CHỐI THAO TÁC.*Đã hoàn thành/);
    });

    test('Cho phép đổi địa chỉ trên đơn PENDING -> Sinh bản nháp và commit thành công', () => {
      const order = ecommerceDb.getOrderById('ORD-1001');
      assert.strictEqual(order.status, ORDER_STATUS.PENDING);

      const stageRes = ecommerceDb.stageOrderUpdate({
        order_id: 'ORD-1001',
        action: 'change_address',
        payload: { new_address: '99 Bạch Đằng, Hải Châu, Đà Nẵng' }
      });

      assert.strictEqual(stageRes.requiresConfirmation, true);
      assert.strictEqual(stageRes.diff.newAddress, '99 Bạch Đằng, Hải Châu, Đà Nẵng');

      // Địa chỉ trên đơn gốc chưa thay đổi trước khi commit
      assert.strictEqual(order.delivery_address, '123 Lê Duẩn, Hải Châu, Đà Nẵng');

      // Thực hiện commit
      ecommerceDb.commitAction(stageRes.actionId);
      assert.strictEqual(order.delivery_address, '99 Bạch Đằng, Hải Châu, Đà Nẵng');
    });
  });

  describe('4. Luồng Hội thoại AI Agent & Human-In-The-Loop tương tác tự nhiên', () => {
    test('Khách chat tra cứu đơn ORD-1001 -> AI trả lời và trả card thông tin', async () => {
      const res = await processAgentMessage({
        messages: [{ role: 'user', content: 'Kiểm tra giúp mình đơn hàng ORD-1001 nhé' }]
      });

      assert.match(res.reply, /ORD-1001/);
      assert.strictEqual(res.card.type, 'ORDER_STATUS_CARD');
      assert.strictEqual(res.actionRequired, false);
    });

    test('Khách chat hủy đơn ORD-1003 (đang ship) -> AI từ chối an toàn và giải thích', async () => {
      const res = await processAgentMessage({
        messages: [{ role: 'user', content: 'Hủy đơn ORD-1003 giúp tôi ngay' }]
      });

      assert.match(res.reply, /TỪ CHỐI HỦY ĐƠN/);
      assert.strictEqual(res.card.type, 'ERROR_CARD');
    });
    test('Khách chat yêu cầu xóa sạch / hủy hàng loạt -> AI sinh Preview xác nhận -> Khách bấm Xác nhận -> Cho phép hủy', async () => {
      let sessionState = {};

      const res = await processAgentMessage({
        messages: [{ role: 'user', content: 'hủy hết xóa sạch đơn ở tháng 11/2026' }],
        sessionState
      });

      assert.strictEqual(res.actionRequired, true);
      assert.strictEqual(res.card.type, 'BULK_CANCEL_PREVIEW');
      assert.ok(res.sessionState.pendingActionId);
      sessionState = res.sessionState;

      const confirmRes = await processAgentMessage({
        messages: [
          { role: 'user', content: 'hủy hết xóa sạch đơn ở tháng 11/2026' },
          { role: 'assistant', content: res.reply },
          { role: 'user', content: 'Xác nhận hủy' }
        ],
        sessionState
      });

      assert.match(confirmRes.reply, /Đã hủy\/xóa thành công|Đã hủy thành công/);
      assert.strictEqual(confirmRes.card.type, 'ACTION_CONFIRMED_CARD');
      assert.strictEqual(confirmRes.card.actionType, 'BULK_CANCEL');
      assert.strictEqual(confirmRes.sessionState.pendingActionId, null);
    });

    test('Khách chat "xóa hàng loạt đơn của tháng 11/2026" -> AI sinh Preview BULK_CANCEL_PREVIEW và không lặp lại câu chào', async () => {
      const res = await processAgentMessage({
        messages: [{ role: 'user', content: 'xóa hàng loạt đơn của tháng 11/2026' }],
        sessionState: {}
      });

      assert.strictEqual(res.actionRequired, true);
      assert.strictEqual(res.card.type, 'BULK_CANCEL_PREVIEW');
      assert.strictEqual(res.card.preview.timePeriod, 'tháng 11/2026');
      assert.ok(res.sessionState.pendingActionId);
    });

    test('Khách chat "xóa hết nợ của tháng 11" -> AI nhận diện đúng công cụ clear_debts (không nhầm sang xóa đơn) và xóa sạch nợ về 0đ sau khi Xác nhận', async () => {
      // Giả lập khách đang nợ 123.600.000đ trong Sổ Nợ
      addCustomer({ name: 'Khách Nợ Tháng 11', phone: '0909123456', total_debt: 123600000 });
      assert.ok(getDebtSummary().totalDebt >= 123600000);

      let sessionState = {};
      const res = await processAgentMessage({
        messages: [{ role: 'user', content: 'xóa hết nợ của tháng 11' }],
        sessionState
      });

      assert.strictEqual(res.actionRequired, true);
      assert.strictEqual(res.card.type, 'CLEAR_DEBT_PREVIEW');
      assert.ok(res.sessionState.pendingActionId);
      sessionState = res.sessionState;

      const confirmRes = await processAgentMessage({
        messages: [
          { role: 'user', content: 'xóa hết nợ của tháng 11' },
          { role: 'assistant', content: res.reply },
          { role: 'user', content: 'Xác nhận' }
        ],
        sessionState
      });

      assert.strictEqual(confirmRes.card.type, 'ACTION_CONFIRMED_CARD');
      assert.strictEqual(confirmRes.card.actionType, 'CLEAR_DEBTS');
      assert.strictEqual(getDebtSummary().totalDebt, 0);
    });

    test('Khách điều khiển giao diện web ("mở sổ nợ") và ghi chi phí ("ghi chi 300k tiền điện")', async () => {
      const navRes = await processAgentMessage({
        messages: [{ role: 'user', content: 'mở sổ nợ' }],
        sessionState: {}
      });
      assert.strictEqual(navRes.uiAction?.target, 'debt');

      const expRes = await processAgentMessage({
        messages: [{ role: 'user', content: 'ghi chi 300k tiền điện' }],
        sessionState: {}
      });
      assert.match(expRes.reply, /Đã ghi nhận khoản chi/);
    });


    test('Khách yêu cầu đặt hàng -> AI tạo bản nháp -> Khách gõ "Xác nhận" -> Đơn được tạo', async () => {
      let sessionState = {};

      // Turn 1: Khách đặt hàng
      const turn1 = await processAgentMessage({
        messages: [{ role: 'user', content: 'Tôi muốn mua 2 thỏi son dưỡng cho Nam 0912345678 giao đến 12 Cầu Giấy' }],
        sessionState
      });

      assert.strictEqual(turn1.actionRequired, true);
      assert.strictEqual(turn1.card.type, 'CREATE_ORDER_PREVIEW');
      assert.ok(turn1.sessionState.pendingActionId);
      sessionState = turn1.sessionState;

      // Turn 2: Khách gõ "Xác nhận"
      const turn2 = await processAgentMessage({
        messages: [
          { role: 'user', content: 'Tôi muốn mua 2 thỏi son dưỡng cho Nam 0912345678 giao đến 12 Cầu Giấy' },
          { role: 'assistant', content: turn1.reply },
          { role: 'user', content: 'Xác nhận nhé shop' }
        ],
        sessionState
      });

      assert.match(turn2.reply, /thành công/);
      assert.strictEqual(turn2.card.type, 'ACTION_CONFIRMED_CARD');
      assert.strictEqual(turn2.sessionState.pendingActionId, null);
    });
  });

});
