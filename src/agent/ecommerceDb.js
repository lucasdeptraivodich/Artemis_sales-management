/**
 * ============================================================================
 * E-COMMERCE DATABASE & BUSINESS ENGINE
 * ============================================================================
 */
import { isValidVietnamPhone, isValidQuantity } from './schemas.js';
import { ORDER_STATUS, STATUS_LABELS, INITIAL_PRODUCTS, INITIAL_ORDERS } from './mockData.js';
import {
  getTransactions,
  updateTransaction,
  getTransactionsByMonth,
  deleteTransactionsByIds,
  getDebtSummary,
  clearCustomerDebts,
  addTransaction,
  addItem,
  updateItem,
  getItems,
  settleAllPendingCodOrders,
  getWeekdayActivitySummary,
  VIETNAMESE_WEEKDAYS
} from '../store.js';

export { ORDER_STATUS, STATUS_LABELS };

function parseMonthYearFromPeriod(timePeriod) {
  if (!timePeriod) return null;
  const text = String(timePeriod).toLowerCase().normalize('NFC');
  const fullMatch =
    text.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/) ||
    text.match(/tháng\s*(\d{1,2})\s*năm\s*(\d{4})/);
  if (fullMatch) {
    const m = parseInt(fullMatch[1], 10);
    const y = parseInt(fullMatch[2], 10);
    if (m >= 1 && m <= 12) return { month: m - 1, year: y };
  }
  const monthOnly = text.match(/tháng\s*(\d{1,2})\b/);
  if (monthOnly) {
    const m = parseInt(monthOnly[1], 10);
    const y = new Date().getFullYear();
    if (m >= 1 && m <= 12) return { month: m - 1, year: y };
  }
  return null;
}

export class EcommerceDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
    this.pendingActions = new Map();
    this.nextOrderIndex = 1005;
  }

  getAllProducts() {
    return this.products;
  }

  getAllOrders() {
    return this.orders;
  }

  findProduct(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim().toLowerCase();
    return this.products.find(
      (p) => p.id.toLowerCase() === cleanId || p.name.toLowerCase().includes(cleanId)
    ) || null;
  }

  getOrderById(orderId) {
    if (!orderId) return null;
    const cleanId = String(orderId).trim().toUpperCase();
    return this.orders.find((o) => o.order_id.toUpperCase() === cleanId) || null;
  }

  stageOrderCreation({ customer_name, phone, items, delivery_address, note }) {
    if (!customer_name || customer_name.trim().length < 2) {
      throw new Error('Họ tên khách hàng không hợp lệ (tối thiểu 2 ký tự).');
    }

    if (!isValidVietnamPhone(phone)) {
      throw new Error(`Số điện thoại "${phone}" không hợp lệ. Vui lòng nhập số di động Việt Nam 10 chữ số (ví dụ: 0901234567).`);
    }

    if (!delivery_address || delivery_address.trim().length < 5) {
      throw new Error('Địa chỉ giao hàng quá ngắn (tối thiểu 5 ký tự).');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Đơn hàng phải có ít nhất 1 sản phẩm.');
    }

    let calculatedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      if (!isValidQuantity(item.quantity)) {
        throw new Error(`Số lượng cho sản phẩm "${item.product_id}" phải là số nguyên dương > 0.`);
      }

      const product = this.findProduct(item.product_id);
      if (!product) {
        throw new Error(`Không tìm thấy sản phẩm "${item.product_id}" trong danh mục.`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Sản phẩm "${product.name}" chỉ còn ${product.stock} trong kho, không đủ số lượng ${item.quantity}.`);
      }

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;

      calculatedItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        line_total: lineTotal
      });
    }

    const shippingFee = 25000;
    const grandTotal = totalAmount + shippingFee;
    const proposedOrderId = `ORD-${this.nextOrderIndex}`;

    const draftOrder = {
      order_id: proposedOrderId,
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      delivery_address: delivery_address.trim(),
      note: note ? note.trim() : '',
      items: calculatedItems,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      grand_total: grandTotal,
      status: ORDER_STATUS.PENDING,
      status_label: STATUS_LABELS.PENDING
    };

    const actionId = `draft_create_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const pendingRecord = {
      actionId,
      type: 'CREATE_ORDER',
      status: 'AWAITING_CONFIRMATION',
      draftData: draftOrder,
      expiresAt
    };

    this.pendingActions.set(actionId, pendingRecord);

    return {
      actionId,
      type: 'CREATE_ORDER_PREVIEW',
      preview: draftOrder,
      expiresInSeconds: 600,
      requiresConfirmation: true,
      prompt: `Tôi đã lập bản nháp đơn hàng ${proposedOrderId} cho ${customer_name.trim()}. Vui lòng kiểm tra lại thông tin và xác nhận để tiến hành tạo đơn!`
    };
  }

  stageOrderUpdate({ order_id, action, payload }) {
    const existingOrder = this.getOrderById(order_id);
    if (!existingOrder) {
      throw new Error(`Không tìm thấy đơn hàng "${order_id}" trong hệ thống.`);
    }

    if (existingOrder.status === ORDER_STATUS.SHIPPING) {
      if (action === 'cancel_order') {
        throw new Error(
          `⛔ TỪ CHỐI HỦY ĐƠN: Đơn hàng "${order_id}" đang ở trạng thái "${STATUS_LABELS.SHIPPING}" ` +
          `(Mã vận đơn: ${existingOrder.tracking_code || 'Chưa cập nhật'}, đơn vị: ${existingOrder.carrier || 'Đang vận chuyển'}). ` +
          `Kiện hàng đã rời kho và đang trên đường giao tới bạn, do đó không thể hủy tự động trên hệ thống.`
        );
      }
      if (action === 'change_quantity') {
        throw new Error(
          `⛔ TỪ CHỐI CHỈNH SỬA: Đơn hàng "${order_id}" đang ở trạng thái "${STATUS_LABELS.SHIPPING}". ` +
          `Kiện hàng đã niêm phong và bàn giao cho đơn vị vận chuyển nên không thể thay đổi số lượng sản phẩm.`
        );
      }
    }

    if (existingOrder.status === ORDER_STATUS.DELIVERED) {
      throw new Error(
        `⛔ TỪ CHỐI THAO TÁC: Đơn hàng "${order_id}" đã ở trạng thái "${STATUS_LABELS.DELIVERED}". ` +
        `Đơn hàng đã hoàn thành, không thể sửa đổi hoặc hủy. Nếu cần hỗ trợ đổi trả, vui lòng liên hệ bộ phận CSKH.`
      );
    }

    if (existingOrder.status === ORDER_STATUS.CANCELLED) {
      throw new Error(`Đơn hàng "${order_id}" đã bị hủy trước đó.`);
    }

    let previewDiff = {};
    let proposedUpdatedOrder = JSON.parse(JSON.stringify(existingOrder));

    if (action === 'cancel_order') {
      proposedUpdatedOrder.status = ORDER_STATUS.CANCELLED;
      proposedUpdatedOrder.status_label = STATUS_LABELS.CANCELLED;
      previewDiff = {
        action: 'cancel_order',
        currentStatus: existingOrder.status_label,
        proposedStatus: STATUS_LABELS.CANCELLED,
        reason: payload?.reason || 'Khách hàng yêu cầu hủy đơn qua trợ lý AI.'
      };
    } else if (action === 'change_address') {
      if (!payload?.new_address || payload.new_address.trim().length < 5) {
        throw new Error('Địa chỉ mới không hợp lệ (tối thiểu 5 ký tự).');
      }
      const newAddress = payload.new_address.trim();
      proposedUpdatedOrder.delivery_address = newAddress;
      previewDiff = {
        action: 'change_address',
        oldAddress: existingOrder.delivery_address,
        newAddress: newAddress
      };
    } else if (action === 'change_quantity') {
      const { product_id, new_quantity } = payload || {};
      if (!product_id) {
        throw new Error('Vui lòng chỉ định mã hoặc tên sản phẩm cần thay đổi số lượng.');
      }
      if (!isValidQuantity(new_quantity)) {
        throw new Error(`Số lượng mới phải là số nguyên dương lớn hơn 0 (nhận được: ${new_quantity}).`);
      }

      const itemIndex = proposedUpdatedOrder.items.findIndex(
        (it) => it.product_id.toLowerCase() === product_id.toLowerCase() || it.name.toLowerCase().includes(product_id.toLowerCase())
      );
      if (itemIndex === -1) {
        throw new Error(`Sản phẩm "${product_id}" không có trong đơn hàng "${order_id}".`);
      }

      const currentItem = proposedUpdatedOrder.items[itemIndex];
      const oldQty = currentItem.quantity;
      currentItem.quantity = new_quantity;
      currentItem.line_total = currentItem.price * new_quantity;

      const newTotal = proposedUpdatedOrder.items.reduce((sum, it) => sum + it.line_total, 0);
      proposedUpdatedOrder.total_amount = newTotal;
      proposedUpdatedOrder.grand_total = newTotal + (proposedUpdatedOrder.shipping_fee || 0);

      previewDiff = {
        action: 'change_quantity',
        productName: currentItem.name,
        oldQuantity: oldQty,
        newQuantity: new_quantity,
        oldGrandTotal: existingOrder.grand_total,
        newGrandTotal: proposedUpdatedOrder.grand_total
      };
    } else {
      throw new Error(`Hành động "${action}" không hợp lệ. Chọn change_quantity, change_address hoặc cancel_order.`);
    }

    const actionId = `draft_update_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const pendingRecord = {
      actionId,
      type: 'UPDATE_ORDER',
      status: 'AWAITING_CONFIRMATION',
      targetOrderId: order_id,
      actionType: action,
      diff: previewDiff,
      draftData: proposedUpdatedOrder,
      expiresAt
    };

    this.pendingActions.set(actionId, pendingRecord);

    return {
      actionId,
      type: 'UPDATE_ORDER_PREVIEW',
      orderId: order_id,
      action,
      diff: previewDiff,
      preview: proposedUpdatedOrder,
      expiresInSeconds: 600,
      requiresConfirmation: true,
      prompt: `Tôi đã tạo bản xem trước thay đổi cho đơn hàng ${order_id}. Vui lòng kiểm tra và xác nhận để áp dụng!`
    };
  }
  stageBulkCancellation({ time_period = 'tháng 11/2026', reason }) {
    const cancellableOrders = [];
    const skippedOrders = [];
    const storeTxIds = [];

    // 1. Kiểm tra các đơn hàng trên hệ thống giao diện chính (store.js) nếu có
    const parsedPeriod = parseMonthYearFromPeriod(time_period);
    if (parsedPeriod && typeof window !== 'undefined') {
      try {
        const monthTxs = getTransactionsByMonth(parsedPeriod.year, parsedPeriod.month);
        for (const tx of monthTxs) {
          storeTxIds.push(tx.id);
          cancellableOrders.push({
            order_id: tx.tracking_code || tx.item_name || `GD-${String(tx.id).slice(-4).toUpperCase()}`,
            customer_name: tx.customer_name || 'Khách lẻ',
            grand_total: Number(tx.sale_price) || 0,
            itemsCount: Number(tx.quantity) || 1,
            isStoreTx: true,
            txId: tx.id
          });
        }
      } catch (e) {
        // Ignore if store is not initialized in test environment
      }
    }

    // 2. Kiểm tra các đơn hàng trong E-commerce DB
    for (const order of this.orders) {
      if (order.status === ORDER_STATUS.CANCELLED) continue;
      if (order.status === ORDER_STATUS.SHIPPING || order.status === ORDER_STATUS.DELIVERED) {
        skippedOrders.push({
          order_id: order.order_id,
          status_label: order.status_label,
          reason: order.status === ORDER_STATUS.SHIPPING ? 'Đang vận chuyển' : 'Đã hoàn thành'
        });
      } else {
        cancellableOrders.push({
          order_id: order.order_id,
          customer_name: order.customer_name,
          grand_total: order.grand_total || order.total_amount,
          itemsCount: order.items?.length || 0
        });
      }
    }

    if (cancellableOrders.length === 0) {
      throw new Error(`Không có đơn hàng nào có thể hủy/xóa trong ${time_period}. Các đơn hiện tại đều đã xử lý, đang vận chuyển hoặc đã hoàn thành.`);
    }

    const actionId = `draft_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const pendingRecord = {
      actionId,
      type: 'BULK_CANCEL',
      status: 'AWAITING_CONFIRMATION',
      timePeriod: time_period,
      reason: reason || 'Yêu cầu hủy hàng loạt từ người dùng',
      cancellableOrderIds: cancellableOrders.filter((o) => !o.isStoreTx).map((o) => o.order_id),
      storeTxIds,
      skippedOrders,
      expiresAt
    };

    this.pendingActions.set(actionId, pendingRecord);

    return {
      actionId,
      type: 'BULK_CANCEL_PREVIEW',
      timePeriod: time_period,
      cancellableOrders,
      skippedOrders,
      totalCount: cancellableOrders.length,
      expiresInSeconds: 600,
      requiresConfirmation: true,
      prompt: `Em đã lập danh sách ${cancellableOrders.length} đơn hàng trong ${time_period} có thể xóa/hủy. Vui lòng kiểm tra và bấm nút "Xác nhận" để thực thi nhé!`
    };
  }

  stageDebtClearance({ scope = 'all', customer_name = null, time_period = null, record_as_payment = false }) {
    const filterName = scope === 'customer' && customer_name ? customer_name : null;
    const summary = getDebtSummary(filterName);

    const actionId = `draft_debt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const owingList = summary.owingCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      total_debt: Number(c.total_debt) || 0
    }));

    if (owingList.length === 0) {
      throw new Error(
        filterName
          ? `Hiện tại khách hàng "${filterName}" không còn khoản nợ nào chưa thu trên hệ thống (0đ).`
          : `Hiện tại Sổ Nợ đã sạch (Tổng nợ chưa thu = 0đ), không có khoản nợ nào cần xóa.`
      );
    }

    const periodLabel = time_period ? ` (${time_period})` : '';
    const actionLabel = record_as_payment ? 'Tất toán thu nợ' : 'Xóa sạch công nợ';

    const pendingRecord = {
      actionId,
      type: 'CLEAR_DEBTS',
      status: 'AWAITING_CONFIRMATION',
      scope,
      customerName: filterName,
      timePeriod: time_period,
      recordAsPayment: Boolean(record_as_payment),
      totalDebt: summary.totalDebt,
      owingCount: owingList.length,
      owingCustomers: owingList,
      expiresAt
    };

    this.pendingActions.set(actionId, pendingRecord);

    return {
      actionId,
      type: 'CLEAR_DEBT_PREVIEW',
      scope,
      customerName: filterName,
      timePeriod: time_period,
      recordAsPayment: Boolean(record_as_payment),
      totalDebt: summary.totalDebt,
      owingCount: owingList.length,
      owingCustomers: owingList,
      expiresInSeconds: 600,
      requiresConfirmation: true,
      prompt: `⚠️ ${actionLabel}${periodLabel}: Tìm thấy ${owingList.length} khách đang nợ với tổng số tiền ${new Intl.NumberFormat('vi-VN').format(summary.totalDebt)}đ. Vui lòng bấm "Xác nhận" để đưa toàn bộ số nợ này về 0đ!`
    };
  }

  executeOrStageWebAction(args = {}) {
    const {
      operation,
      item_name,
      amount = 0,
      cost_price = 0,
      quantity = 1,
      customer_name = '',
      payment_method = 'CASH_TRANSFER',
      ui_target = 'home',
      created_at = null,
      weekday_index = null
    } = args;

    if (operation === 'query_weekday_report') {
      const hasSpecificWeekday = weekday_index !== undefined && weekday_index !== null && weekday_index >= 0 && weekday_index <= 6;
      const groups = getWeekdayActivitySummary({
        weekdayFilter: hasSpecificWeekday ? weekday_index : 'ALL'
      });

      const wdInfo = hasSpecificWeekday ? VIETNAMESE_WEEKDAYS[weekday_index] : null;
      const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';

      if (groups.length === 0) {
        return {
          requiresConfirmation: false,
          cardType: 'WEB_ACTION_CARD',
          message: hasSpecificWeekday
            ? `📅 Hiện chưa có giao dịch bán hàng hay chi tiêu nào được ghi nhận vào ${wdInfo.label} ạ!`
            : `📅 Hiện tại chưa có giao dịch nào được ghi nhận trong hệ thống ạ.`
        };
      }

      const lines = [];
      for (const g of groups.slice(0, 5)) {
        const salesStr =
          g.salesList.length > 0
            ? g.salesList
                .map(
                  (s) =>
                    `${s.item_name}${s.quantity > 1 ? ` ×${s.quantity}` : ''} (${fmt(s.amount)}${
                      s.payment_method === 'DEBT' ? ' - Nợ' : ''
                    })`
                )
                .join(', ')
            : 'Không có';
        const expStr =
          g.expensesList.length > 0
            ? g.expensesList.map((e) => `${e.item_name} (${fmt(e.amount)})`).join(', ')
            : 'Không có';
        lines.push(
          `📅 ${g.weekdayLabel} (${g.displayDate}):\n` +
            `  • 🛒 Bán được (+${fmt(g.totalSales)}): ${salesStr}\n` +
            `  • 💸 Chi tiêu (-${fmt(g.totalExpenses)}): ${expStr}`
        );
      }

      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        weekdayGroups: groups.slice(0, 5),
        message: `📊 Báo cáo chi tiết theo Thứ (Bán gì & Chi gì):\n\n` + lines.join('\n\n')
      };
    }

    if (operation === 'navigate_ui') {
      const targetLabels = {
        home: 'Trang chủ (Dashboard)',
        history: 'Lịch sử đơn hàng',
        debt: 'Sổ nợ khách hàng',
        cod: 'Quản lý Đơn Ship COD',
        cashflow: 'Báo cáo Dòng Tiền',
        report: 'Xuất Báo Cáo Doanh Thu',
        items: 'Quản lý Món Hàng & Tồn Kho',
        backup: 'Sao lưu & Khôi phục dữ liệu',
        sale_form: 'Biểu mẫu + Bán Hàng mới',
        expense_form: 'Biểu mẫu + Ghi Chi Tiền'
      };
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        uiAction: { target: ui_target },
        message: `🚀 Đã mở mục "${targetLabels[ui_target] || ui_target}" trên màn hình cho anh/chị!`
      };
    }

    if (operation === 'convert_sale_to_debt') {
      const transactions = getTransactions();
      const targetAmount = Math.max(0, Number(amount) || 0);
      const custName = (customer_name || '').trim();

      // 1. Tìm đơn bán hàng gần nhất cần chuyển sang nợ
      let targetTx = null;
      if (targetAmount > 0) {
        // Tìm đơn bán gần nhất có số tiền tương ứng
        targetTx = transactions.find((t) => t.type === 'SALE' && Math.abs((t.sale_price || 0) - targetAmount) < 1);
      }
      if (!targetTx && custName) {
        // Tìm đơn bán gần nhất của khách hàng này
        targetTx = transactions.find((t) => t.type === 'SALE' && (t.customer_name || '').toLowerCase() === custName.toLowerCase());
      }
      if (!targetTx) {
        // Fallback: Lấy đơn bán gần nhất chưa phải là nợ, hoặc đơn bán gần nhất
        targetTx = transactions.find((t) => t.type === 'SALE' && t.payment_method !== 'DEBT') || transactions.find((t) => t.type === 'SALE');
      }

      if (targetTx) {
        const finalCust = custName || (targetTx.customer_name && targetTx.customer_name !== 'Khách lẻ' ? targetTx.customer_name : 'Khách nợ');
        const updates = {
          payment_method: 'DEBT',
          customer_name: finalCust
        };
        if (created_at) {
          updates.created_at = created_at;
        }
        const updated = updateTransaction(targetTx.id, updates);
        return {
          requiresConfirmation: false,
          cardType: 'WEB_ACTION_CARD',
          tx: updated,
          message: `✅ Đã chuyển đơn bán "${updated.item_name}" (${new Intl.NumberFormat('vi-VN').format(updated.sale_price)}đ) của khách "${updated.customer_name}" sang hình thức Ghi Nợ vào Sổ Nợ thành công!`
        };
      }

      // 2. Nếu chưa có đơn bán nào trước đó để sửa, tự động tạo mới đơn nợ
      const fallbackAmount = targetAmount > 0 ? targetAmount : 100000;
      const finalCust = custName || 'Khách nợ';
      const tx = addTransaction({
        type: 'SALE',
        item_name: item_name ? item_name.trim() : 'Đơn ghi nợ',
        sale_price: fallbackAmount,
        cost_price: 0,
        quantity: 1,
        payment_method: 'DEBT',
        customer_name: finalCust,
        created_at: created_at || new Date().toISOString()
      });
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        tx,
        message: `✅ Đã ghi nhận khoản nợ ${new Intl.NumberFormat('vi-VN').format(tx.sale_price)}đ cho khách "${tx.customer_name}" vào Sổ Nợ thành công!`
      };
    }

    if (operation === 'record_expense') {
      const expenseName = (item_name || 'Chi phí phát sinh').trim();
      const expenseAmount = Math.max(0, Number(amount) || 0);
      if (expenseAmount <= 0) {
        throw new Error('Vui lòng cung cấp số tiền chi phí lớn hơn 0đ (ví dụ: "Ghi chi 300k tiền điện").');
      }
      const tx = addTransaction({
        type: 'EXPENSE',
        item_name: expenseName,
        sale_price: expenseAmount,
        cost_price: 0,
        payment_method: 'CASH_TRANSFER',
        created_at: created_at || new Date().toISOString()
      });
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        tx,
        message: `✅ Đã ghi nhận khoản chi "${expenseName}" với số tiền ${new Intl.NumberFormat('vi-VN').format(expenseAmount)}đ vào hệ thống!`
      };
    }

    if (operation === 'record_sale') {
      const saleName = (item_name || 'Đơn bán hàng').trim();
      const saleAmount = Math.max(0, Number(amount) || 0);
      if (saleAmount <= 0) {
        throw new Error('Vui lòng cho biết giá tiền bán hàng (ví dụ: "Ghi bán Áo thun 250k").');
      }
      const isDebt = payment_method === 'DEBT';
      const finalCust = customer_name && customer_name.trim() ? customer_name.trim() : (isDebt ? 'Khách nợ' : 'Khách lẻ');
      const tx = addTransaction({
        type: 'SALE',
        item_name: saleName,
        sale_price: saleAmount,
        cost_price: Math.max(0, Number(cost_price) || 0),
        quantity: Math.max(1, Number(quantity) || 1),
        payment_method: payment_method || 'CASH_TRANSFER',
        customer_name: finalCust,
        created_at: created_at || new Date().toISOString()
      });

      const formattedAmount = new Intl.NumberFormat('vi-VN').format(saleAmount) + 'đ';
      if (isDebt) {
        return {
          requiresConfirmation: false,
          cardType: 'WEB_ACTION_CARD',
          tx,
          message: `✅ Đã ghi nhận đơn nợ "${saleName}" (${formattedAmount}) cho khách "${finalCust}" vào Sổ Nợ thành công!`
        };
      }
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        tx,
        message: `✅ Đã ghi đơn bán "${saleName}" (${formattedAmount}) lên Trang chủ!`
      };
    }

    if (operation === 'upsert_item') {
      const name = (item_name || '').trim();
      if (!name) {
        throw new Error('Vui lòng cung cấp tên món hàng cần thêm hoặc cập nhật.');
      }
      const existing = getItems().find((i) => (i.name || '').toLowerCase() === name.toLowerCase());
      if (existing) {
        const updated = updateItem(existing.id, {
          default_price: amount > 0 ? amount : existing.default_price,
          default_cost: cost_price > 0 ? cost_price : existing.default_cost,
          stock: quantity !== undefined ? quantity : existing.stock
        });
        return {
          requiresConfirmation: false,
          cardType: 'WEB_ACTION_CARD',
          item: updated,
          message: `✅ Đã cập nhật món hàng "${updated.name}" (Giá: ${new Intl.NumberFormat('vi-VN').format(updated.default_price)}đ, Tồn kho: ${updated.stock ?? 'Không giới hạn'})!`
        };
      }
      const created = addItem({
        name,
        default_price: Math.max(0, Number(amount) || 100000),
        default_cost: Math.max(0, Number(cost_price) || 0),
        stock: quantity !== undefined ? Number(quantity) : null
      });
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        item: created,
        message: `✅ Đã thêm món hàng mới "${created.name}" (Giá: ${new Intl.NumberFormat('vi-VN').format(created.default_price)}đ) vào danh mục!`
      };
    }

    if (operation === 'settle_all_cod') {
      const res = settleAllPendingCodOrders();
      if (res.settledCount === 0) {
        return {
          requiresConfirmation: false,
          cardType: 'WEB_ACTION_CARD',
          message: '📦 Hiện tại không có đơn Ship COD nào đang chờ thu tiền.'
        };
      }
      return {
        requiresConfirmation: false,
        cardType: 'WEB_ACTION_CARD',
        message: `✅ Đã đối soát & thu tiền thành công ${res.settledCount} đơn Ship COD (+${new Intl.NumberFormat('vi-VN').format(res.settledAmount)}đ vào Thu thực)!`
      };
    }

    throw new Error(`Thao tác "${operation}" chưa được hỗ trợ.`);
  }


  commitAction(actionId) {
    if (!actionId || !this.pendingActions.has(actionId)) {
      throw new Error('Yêu cầu xác nhận không tồn tại hoặc đã hết hạn.');
    }

    const record = this.pendingActions.get(actionId);
    if (Date.now() > record.expiresAt) {
      this.pendingActions.delete(actionId);
      throw new Error('Yêu cầu đã quá thời gian xác nhận (10 phút).');
    }

    if (record.type === 'CREATE_ORDER') {
      const newOrder = {
        ...record.draftData,
        created_at: new Date().toISOString(),
        timeline: [
          { time: new Date().toISOString(), note: 'Đơn hàng được khách xác nhận qua AI' }
        ]
      };

      for (const item of newOrder.items) {
        const product = this.products.find((p) => p.id === item.product_id);
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
        }
      }

      this.orders.unshift(newOrder);
      this.nextOrderIndex++;
      this.pendingActions.delete(actionId);

      return {
        success: true,
        actionType: 'CREATE_ORDER',
        order: newOrder,
        message: `✅ Đơn hàng ${newOrder.order_id} đã được tạo thành công vào hệ thống.`
      };
    }

    if (record.type === 'UPDATE_ORDER') {
      const orderIndex = this.orders.findIndex((o) => o.order_id === record.targetOrderId);
      if (orderIndex === -1) {
        this.pendingActions.delete(actionId);
        throw new Error(`Đơn hàng ${record.targetOrderId} không còn tồn tại.`);
      }

      const updatedOrder = {
        ...record.draftData,
        updated_at: new Date().toISOString()
      };

      if (!updatedOrder.timeline) updatedOrder.timeline = [];
      updatedOrder.timeline.push({
        time: new Date().toISOString(),
        note: `Cập nhật [${record.actionType}] đã được khách xác nhận qua AI.`
      });

      if (record.actionType === 'cancel_order') {
        for (const item of updatedOrder.items) {
          const product = this.products.find((p) => p.id === item.product_id);
          if (product) {
            product.stock += item.quantity;
          }
        }
      }

      Object.assign(this.orders[orderIndex], updatedOrder);
      this.pendingActions.delete(actionId);

      return {
        success: true,
        actionType: 'UPDATE_ORDER',
        order: updatedOrder,
        message: `✅ Đơn hàng ${updatedOrder.order_id} đã được cập nhật thành công!`
      };
    }

    if (record.type === 'BULK_CANCEL') {
      const cancelledList = [];
      let deletedStoreCount = 0;

      if (Array.isArray(record.storeTxIds) && record.storeTxIds.length > 0 && typeof window !== 'undefined') {
        try {
          deletedStoreCount = deleteTransactionsByIds(record.storeTxIds);
        } catch (e) {
          console.warn('Lỗi xóa giao dịch trong store:', e);
        }
      }

      for (const orderId of record.cancellableOrderIds) {
        const order = this.getOrderById(orderId);
        if (order && order.status !== ORDER_STATUS.CANCELLED) {
          order.status = ORDER_STATUS.CANCELLED;
          order.status_label = STATUS_LABELS.CANCELLED;
          order.updated_at = new Date().toISOString();
          if (!order.timeline) order.timeline = [];
          order.timeline.push({
            time: new Date().toISOString(),
            note: 'Đã hủy hàng loạt theo xác nhận của khách qua AI.'
          });

          if (order.items) {
            for (const item of order.items) {
              const product = this.products.find((p) => p.id === item.product_id);
              if (product) product.stock += item.quantity;
            }
          }
          cancelledList.push(order);
        }
      }

      this.pendingActions.delete(actionId);
      const totalCancelledCount = cancelledList.length + deletedStoreCount;

      return {
        success: true,
        actionType: 'BULK_CANCEL',
        cancelledCount: totalCancelledCount,
        timePeriod: record.timePeriod,
        orders: cancelledList,
        message: `✅ Đã hủy/xóa thành công ${totalCancelledCount} đơn hàng trong ${record.timePeriod}! (Đã hoàn tồn kho tương ứng).`
      };
    }

    if (record.type === 'CLEAR_DEBTS') {
      const res = clearCustomerDebts({
        customerName: record.customerName,
        recordAsPayment: record.recordAsPayment
      });
      this.pendingActions.delete(actionId);
      const formattedMoney = new Intl.NumberFormat('vi-VN').format(res.clearedAmount || record.totalDebt || 0);
      return {
        success: true,
        actionType: 'CLEAR_DEBTS',
        clearedCount: res.clearedCount || record.owingCount,
        clearedAmount: res.clearedAmount || record.totalDebt,
        message: record.recordAsPayment
          ? `✅ Đã ghi nhận thu hết nợ cho ${res.clearedCount || record.owingCount} khách hàng (Tổng cộng: +${formattedMoney}đ vào Thu thực)!`
          : `✅ Đã xóa sạch công nợ của ${res.clearedCount || record.owingCount} khách hàng (Tổng nợ đã xóa: ${formattedMoney}đ — Nợ chưa thu hiện tại: 0đ)!`
      };
    }

    throw new Error('Loại hành động không hợp lệ.');
  }

  cancelPendingAction(actionId) {
    if (this.pendingActions.has(actionId)) {
      this.pendingActions.delete(actionId);
      return { success: true, message: 'Đã hủy bỏ thao tác dự thảo. Dữ liệu không thay đổi.' };
    }
    return { success: false, message: 'Không tìm thấy yêu cầu chờ tương ứng.' };
  }

  getPendingAction(actionId) {
    return this.pendingActions.get(actionId) || null;
  }
}

export const ecommerceDb = new EcommerceDatabase();

