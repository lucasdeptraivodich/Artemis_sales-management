/**
 * System Prompt & Deterministic Intent Matcher for AI Agent
 */
export const SYSTEM_PROMPT = `Bạn là Trợ lý AI Quản lý Toàn diện của hệ thống Artemis (Quản lý Bán hàng, Sổ nợ & Dòng tiền).
Bạn có toàn quyền hỗ trợ người dùng thao tác MỌI TÍNH NĂNG trên trang web thông qua các công cụ:
1. get_order_status: Tra cứu thông tin và tình trạng đơn hàng (ví dụ: ORD-1001).
2. create_order: Tạo đơn hàng mới có xác nhận (Human-in-the-loop).
3. update_order: Đổi địa chỉ, số lượng hoặc hủy đơn hàng lẻ.
4. cancel_bulk_orders: Xóa/hủy hàng loạt đơn hàng theo tháng hoặc khoảng thời gian.
5. clear_debts: Xóa hết nợ / tất toán công nợ trong Sổ Nợ (xóa toàn bộ nợ chưa thu về 0đ hoặc xóa/thu nợ từng khách).
6. manage_web_store:
   - record_expense: Ghi khoản chi tiền mới (tiền điện, nhập hàng, mặt bằng...).
   - record_sale: Ghi đơn bán hàng nhanh lên Dashboard.
   - upsert_item: Thêm món hàng mới hoặc cập nhật giá bán / tồn kho.
   - settle_all_cod: Thu hết tiền các đơn Ship COD đang chờ.
   - navigate_ui: Mở bất kỳ trang/cửa sổ nào trên web (home, history, debt, cod, cashflow, report, items, backup, sale_form, expense_form).

QUY TẮC AN TOÀN (HUMAN-IN-THE-LOOP):
- Với thao tác nhạy cảm (tạo đơn, sửa/hủy đơn, xóa hàng loạt đơn, xóa sổ nợ), luôn gọi tool để hiển thị bảng xác nhận trước khi ghi vào DB.
- Luôn xưng "Em" và gọi người dùng là "Anh/Chị", trả lời ngắn gọn, thông minh và chủ động.`;

function parseVietnameseMoney(text) {
  const clean = text.toLowerCase().replace(/,/g, '.');
  const trMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:triệu|tr|m)\b/);
  if (trMatch) return Math.round(parseFloat(trMatch[1]) * 1000000);
  const kMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:nghìn|ngàn|k)\b/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const rawMatch = clean.match(/(\d{4,10})\s*(?:đ|đồng|vnd)?\b/);
  if (rawMatch) return parseInt(rawMatch[1], 10);
  return 0;
}

/**
 * Phân tích Intent cục bộ (Deterministic Intent Matcher)
 * Hoạt động như một LLM Function Calling Emulator khi chạy offline hoặc test mà không cần API Key.
 */
export function simulateLlmToolCalling(lastUserMessage) {
  const text = (lastUserMessage || '').trim();
  const lower = text.toLowerCase().normalize('NFC');
  const orderIdMatch = text.match(/\b(ORD-\d{4,})\b/i);

  const hasDeleteOrCancelVerb =
    lower.includes('hủy') ||
    lower.includes('huỷ') ||
    lower.includes('xóa') ||
    lower.includes('xoá') ||
    /\b(huy|xoa|delete|clear)\b/i.test(lower);

  const hasBulkKeyword =
    lower.includes('hàng loạt') ||
    lower.includes('hang loat') ||
    lower.includes('hết') ||
    lower.includes('sạch') ||
    lower.includes('tất cả') ||
    lower.includes('tat ca') ||
    lower.includes('toàn bộ') ||
    lower.includes('toan bo') ||
    lower.includes('các đơn') ||
    lower.includes('cac don') ||
    lower.includes('nhiều đơn') ||
    lower.includes('danh sách');

  const monthMatch =
    text.match(/tháng\s*(\d{1,2}(?:\s*[\/\-]\s*\d{4})?)/i) ||
    text.match(/thang\s*(\d{1,2}(?:\s*[\/\-]\s*\d{4})?)/i) ||
    text.match(/\b(\d{1,2}\s*[\/\-]\s*\d{4})\b/);

  // 0A. XỬ LÝ SỔ NỢ / CÔNG NỢ (Ưu tiên kiểm tra trước khi kiểm tra xóa đơn hàng!)
  const isDebtRelated =
    (lower.includes('nợ') ||
      lower.includes('sổ nợ') ||
      lower.includes('so no') ||
      lower.includes('công nợ') ||
      lower.includes('cong no') ||
      lower.includes('xóa nợ') ||
      lower.includes('xoa no') ||
      lower.includes('hết nợ') ||
      lower.includes('het no') ||
      lower.includes('thu nợ') ||
      lower.includes('thu no') ||
      lower.includes('tất toán')) &&
    !lower.includes('nợ đơn');

  if (isDebtRelated) {
    if (
      (lower.includes('mở') || lower.includes('xem') || lower.includes('vào') || lower.includes('chuyển')) &&
      !hasDeleteOrCancelVerb &&
      !lower.includes('thu') &&
      !lower.includes('trả')
    ) {
      return {
        name: 'manage_web_store',
        args: { operation: 'navigate_ui', ui_target: 'debt' }
      };
    }

    const isPayDebt =
      lower.includes('thu nợ') ||
      lower.includes('thu hết nợ') ||
      lower.includes('trả hết nợ') ||
      lower.includes('tất toán');
    if (hasDeleteOrCancelVerb || isPayDebt) {
      let timePeriod = null;
      if (monthMatch) {
        const raw = monthMatch[1] ? monthMatch[1].replace(/\s+/g, '').replace('-', '/') : monthMatch[0];
        timePeriod = /^\d{1,2}$/.test(raw) ? `tháng ${raw}/${new Date().getFullYear()}` : `tháng ${raw}`;
      }
      const custMatch = text.match(/(?:khách|của khách|cho khách|anh|chị)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,25})$/i);
      const isSpecificCustomer =
        custMatch &&
        !custMatch[1].toLowerCase().includes('tháng') &&
        !custMatch[1].toLowerCase().includes('hết') &&
        !custMatch[1].toLowerCase().includes('tất cả');

      return {
        name: 'clear_debts',
        args: {
          scope: isSpecificCustomer ? 'customer' : 'all',
          customer_name: isSpecificCustomer ? custMatch[1].trim() : undefined,
          time_period: timePeriod || undefined,
          record_as_payment: isPayDebt && !hasDeleteOrCancelVerb
        }
      };
    }
  }

  // 0B. ĐIỀU HƯỚNG GIAO DIỆN & MỞ CỬA SỔ TRÊN WEB
  if (lower.includes('mở') || lower.includes('xem') || lower.includes('chuyển sang') || lower.includes('bật')) {
    if (lower.includes('sổ nợ') || lower.includes('công nợ')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'debt' } };
    }
    if (lower.includes('lịch sử')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'history' } };
    }
    if (lower.includes('đơn ship') || lower.includes('quản lý cod')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'cod' } };
    }
    if (lower.includes('dòng tiền')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'cashflow' } };
    }
    if (lower.includes('báo cáo') || lower.includes('xuất excel')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'report' } };
    }
    if (lower.includes('món hàng') || lower.includes('tồn kho') || lower.includes('sản phẩm')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'items' } };
    }
    if (lower.includes('sao lưu') || lower.includes('backup')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'backup' } };
    }
    if (lower.includes('trang chủ') || lower.includes('dashboard')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'home' } };
    }
  }

  // 0C. GHI CHI PHÍ / CHI TIỀN TRỰC TIẾP LÊN WEB
  if (lower.includes('ghi chi') || lower.includes('chi tiền') || lower.includes('khoản chi') || /^chi\s+\d+/i.test(lower)) {
    const amount = parseVietnameseMoney(text);
    const cleanedName = text
      .replace(/ghi chi|chi tiền|khoản chi|chi/gi, '')
      .replace(/\d+(?:[.,]\d+)?\s*(?:triệu|tr|m|nghìn|ngàn|k|đ|đồng|vnd)?/gi, '')
      .trim();
    return {
      name: 'manage_web_store',
      args: {
        operation: 'record_expense',
        item_name: cleanedName || 'Chi phí phát sinh',
        amount: amount || 100000
      }
    };
  }

  // 0D. THU TIỀN ĐƠN SHIP COD
  if (
    (lower.includes('thu hết') || lower.includes('nhận hết') || lower.includes('đối soát') || lower.includes('tất toán')) &&
    (lower.includes('cod') || lower.includes('ship'))
  ) {
    return {
      name: 'manage_web_store',
      args: { operation: 'settle_all_cod' }
    };
  }

  // 0E. THÊM / SỬA MÓN HÀNG & TỒN KHO
  if (lower.includes('thêm món') || lower.includes('cập nhật tồn kho') || lower.includes('sửa giá món')) {
    const amount = parseVietnameseMoney(text);
    const stockMatch = text.match(/(?:tồn kho|kho|số lượng)\s*(\d+)/i);
    const nameMatch = text.match(/(?:thêm món|món|sản phẩm)\s+([^0-9,.\n]+)/i);
    return {
      name: 'manage_web_store',
      args: {
        operation: 'upsert_item',
        item_name: nameMatch ? nameMatch[1].replace(/giá|tồn kho|vốn/gi, '').trim() : 'Món mới',
        amount: amount || 100000,
        quantity: stockMatch ? parseInt(stockMatch[1], 10) : undefined
      }
    };
  }

  // 0. Hủy / Xóa hàng loạt có Human-in-the-loop Preview & Xác nhận
  if (
    hasDeleteOrCancelVerb &&
    !orderIdMatch &&
    (hasBulkKeyword || monthMatch || lower.includes('tháng này') || lower.includes('thang nay'))
  ) {
    let timePeriod = 'tháng 11/2026';
    if (monthMatch) {
      const raw = monthMatch[1] ? monthMatch[1].replace(/\s+/g, '').replace('-', '/') : monthMatch[0];
      if (/^\d{1,2}\/\d{4}$/.test(raw)) {
        timePeriod = `tháng ${raw}`;
      } else if (/^\d{1,2}$/.test(raw)) {
        const yearMatch = text.match(/năm\s*(\d{4})/i);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
        timePeriod = `tháng ${raw}/${year}`;
      } else {
        timePeriod = raw.toLowerCase().includes('tháng') ? raw : `tháng ${raw}`;
      }
    } else if (lower.includes('tháng này') || lower.includes('thang nay')) {
      const now = new Date();
      timePeriod = `tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }

    return {
      name: 'cancel_bulk_orders',
      args: {
        time_period: timePeriod,
        reason: 'Khách hàng yêu cầu xóa/hủy hàng loạt qua trợ lý AI.'
      }
    };
  }

  // 1. Tra cứu đơn
  if (
    (lower.includes('tra cứu') || lower.includes('kiểm tra') || lower.includes('tình trạng') || lower.includes('trạng thái') || lower.includes('đơn hàng') || lower.includes('xem đơn') || orderIdMatch) &&
    orderIdMatch &&
    !hasDeleteOrCancelVerb && !lower.includes('đổi') && !lower.includes('sửa') && !lower.includes('số lượng') && !lower.includes('địa chỉ') && !lower.includes('thành') && !lower.includes('tăng')
  ) {
    return {
      name: 'get_order_status',
      args: { order_id: orderIdMatch[1].toUpperCase() }
    };
  }

  // 2. Hủy / Xóa đơn lẻ
  if (hasDeleteOrCancelVerb) {
    if (orderIdMatch) {
      return {
        name: 'update_order',
        args: {
          order_id: orderIdMatch[1].toUpperCase(),
          action: 'cancel_order',
          payload: { reason: 'Khách hàng yêu cầu hủy đơn qua tin nhắn chat.' }
        }
      };
    }
    return {
      textOnly: 'Để hủy/xóa đơn hàng, anh/chị vui lòng cung cấp mã đơn hàng cụ thể (ví dụ: ORD-1001, ORD-1002) hoặc nhập khoảng thời gian (ví dụ: "xóa hàng loạt đơn của tháng 11/2026") để em hỗ trợ nhé!'
    };
  }

  // 3. Đổi địa chỉ
  if ((lower.includes('địa chỉ') || lower.includes('giao sang') || lower.includes('đổi sang')) && orderIdMatch) {
    let extractedAddress = 'Số 88 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP.HCM';
    const addrMatch = text.match(/(?:thành|sang|về|đến)\s+([^,.\n]+(?:,[^,.\n]+)*)/i);
    if (addrMatch && addrMatch[1]) {
      extractedAddress = addrMatch[1].trim();
    }
    return {
      name: 'update_order',
      args: {
        order_id: orderIdMatch[1].toUpperCase(),
        action: 'change_address',
        payload: { new_address: extractedAddress }
      }
    };
  }

  // 4. Đổi số lượng
  if ((lower.includes('số lượng') || lower.includes('thành') || lower.includes('tăng')) && orderIdMatch) {
    const qtyMatch = text.match(/(?:thành|thành\s*số\s*lượng|lên)\s*(\d+)/i) || text.match(/\b(\d+)\b/);
    const newQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 2;
    return {
      name: 'update_order',
      args: {
        order_id: orderIdMatch[1].toUpperCase(),
        action: 'change_quantity',
        payload: { product_id: 'PROD-01', new_quantity: newQty }
      }
    };
  }

  // 5. Tạo đơn mới
  if (lower.includes('mua') || lower.includes('đặt') || lower.includes('tạo đơn') || lower.includes('order')) {
    const phoneMatch = text.match(/(0\d{9}|\+84\d{9})/);
    const phone = phoneMatch ? phoneMatch[1] : '0912345678';

    let customerName = 'Khách hàng';
    const nameMatch = text.match(/(?:cho|tên|khách)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)/);
    if (nameMatch) {
      customerName = nameMatch[1];
    } else if (lower.includes('nam')) {
      customerName = 'Lê Hoàng Nam';
    } else {
      customerName = 'Nguyễn Văn Khách';
    }

    let address = 'Số 12 Phố Cầu Giấy, Hà Nội';
    const addrMatch = text.match(/(?:tại|đến|địa chỉ)\s+([^,.\n]+(?:,[^,.\n]+)*)/i);
    if (addrMatch) {
      address = addrMatch[1].trim();
    }

    const items = [];
    if (lower.includes('son')) {
      const qMatch = text.match(/(\d+)\s*(?:cây|thỏi|hộp|chiếc)?\s*son/i);
      items.push({ product_id: 'PROD-01', quantity: qMatch ? parseInt(qMatch[1], 10) : 2 });
    }
    if (lower.includes('kem') || lower.includes('chống nắng')) {
      const qMatch = text.match(/(\d+)\s*(?:hũ|tuýp|lọ|chai)?\s*kem/i);
      items.push({ product_id: 'PROD-02', quantity: qMatch ? parseInt(qMatch[1], 10) : 1 });
    }
    if (lower.includes('serum')) {
      items.push({ product_id: 'PROD-03', quantity: 1 });
    }
    if (lower.includes('sữa rửa mặt') || lower.includes('sua rua mat')) {
      items.push({ product_id: 'PROD-04', quantity: 1 });
    }
    if (items.length === 0) {
      items.push({ product_id: 'PROD-01', quantity: 1 });
    }

    return {
      name: 'create_order',
      args: {
        customer_name: customerName,
        phone,
        items,
        delivery_address: address,
        note: 'Giao hàng giờ hành chính'
      }
    };
  }

  return null;
}
