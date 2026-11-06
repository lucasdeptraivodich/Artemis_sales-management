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
   - record_expense: Ghi khoản chi tiền mới (tiền điện, nhập hàng, mặt bằng...). Hỗ trợ nhận diện ngày (created_at).
   - record_sale: Ghi đơn bán hàng nhanh lên Dashboard (chọn payment_method là CASH_TRANSFER, DEBT nếu khách nợ, hoặc COD). Hỗ trợ nhận diện ngày (created_at).
   - convert_sale_to_debt: Chuyển đơn bán vừa ghi hoặc đơn theo số tiền/khách sang hình thức ghi nợ vào Sổ Nợ (khi khách nói "thêm vào là nó nợ", "chuyển đơn 6tr sang nợ", "đổi thành nợ"...).
   - upsert_item: Thêm món hàng mới hoặc cập nhật giá bán / tồn kho.
   - settle_all_cod: Thu hết tiền các đơn Ship COD đang chờ.
   - navigate_ui: Mở bất kỳ trang/cửa sổ nào trên web (home, history, debt, cod, cashflow, report, items, backup, sale_form, expense_form).

QUY TẮC AN TOÀN & THÔNG MINH:
- CHÚ Ý ĐIỀU HƯỚNG: Chỉ gọi navigate_ui khi người dùng THỰC SỰ MUỐN MỞ TRANG (ví dụ: "mở sổ nợ", "xem báo cáo"). Tuyệt đối KHÔNG gọi navigate_ui khi người dùng muốn ghi nợ, đổi đơn sang nợ, sửa đơn, hoặc thao tác dữ liệu.
- XỬ LÝ NGÀY THÁNG: Nhận diện thời gian người dùng nói (ví dụ: "hôm qua", "ngày 5/11", "ngày 02/11/2026") và truyền vào tham số created_at dạng ISO 8601.
- Với thao tác nhạy cảm (tạo đơn, sửa/hủy đơn, xóa hàng loạt đơn, xóa sổ nợ), luôn gọi tool để hiển thị bảng xác nhận trước khi ghi vào DB.
- Luôn xưng "Em" và gọi người dùng là "Anh/Chị", trả lời ngắn gọn, thông minh và chủ động.`;

export function parseVietnameseMoney(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().normalize('NFC');

  // 1. Số kèm chữ triệu / tr / m / củ: ví dụ: 6 triệu, 6.5tr, 6m, 6 củ
  const trMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|m|củ|cu)\b/i);
  if (trMatch) {
    return Math.round(parseFloat(trMatch[1].replace(',', '.')) * 1000000);
  }

  // 2. Số kèm chữ nghìn / ngàn / k: ví dụ: 500k, 250 nghìn, 150 ngàn
  const kMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:nghìn|nghin|ngàn|ngan|k)\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }

  // 3. Tiếng lóng "xị" (1 xị = 100.000đ)
  const xiMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:xị|xi)\b/i);
  if (xiMatch) {
    return Math.round(parseFloat(xiMatch[1].replace(',', '.')) * 100000);
  }

  // 4. Số viết dạng phân cách hàng nghìn (ví dụ: 6.000.000, 6,000,000, 500.000)
  const dotSeparatedMatch = clean.match(/\b\d{1,3}(?:[.,]\d{3})+(?:\s*(?:đ|đồng|dong|vnd))?\b/i);
  if (dotSeparatedMatch) {
    const digitsOnly = dotSeparatedMatch[0].replace(/[^\d]/g, '');
    const parsed = parseInt(digitsOnly, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 5. Số thuần từ 4 chữ số trở lên: ví dụ: 6000000, 50000
  const rawMatch = clean.match(/\b(\d{4,10})\s*(?:đ|đồng|dong|vnd)?\b/i);
  if (rawMatch) {
    return parseInt(rawMatch[1], 10);
  }

  return 0;
}

/**
 * Nhận diện Thứ trong tuần từ câu tiếng Việt (0 = Chủ Nhật, 1 = Thứ 2, ..., 6 = Thứ 7)
 */
export function parseVietnameseWeekdayIndex(text) {
  if (!text) return null;
  const clean = text.toLowerCase().normalize('NFC');
  if (/(?:chủ\s+nhật|chu\s+nhat|(?:^|\s)cn(?:\s|$))/iu.test(clean)) return 0;
  if (/thứ\s*(?:2|hai)(?:\s|[.,!?]|$)/iu.test(clean)) return 1;
  if (/thứ\s*(?:3|ba)(?:\s|[.,!?]|$)/iu.test(clean)) return 2;
  if (/thứ\s*(?:4|tư|bốn)(?:\s|[.,!?]|$)/iu.test(clean)) return 3;
  if (/thứ\s*(?:5|năm)(?:\s|[.,!?]|$)/iu.test(clean)) return 4;
  if (/thứ\s*(?:6|sáu)(?:\s|[.,!?]|$)/iu.test(clean)) return 5;
  if (/thứ\s*(?:7|bảy)(?:\s|[.,!?]|$)/iu.test(clean)) return 6;
  return null;
}

/**
 * Bóc tách ngày tháng tự nhiên tiếng Việt
 * Hỗ trợ: "hôm nay", "hôm qua", "hôm kia", "thứ 2..thứ 7", "chủ nhật", "ngày 5/11", "05/11/2026"...
 */
export function parseVietnameseDate(text) {
  if (!text) return null;
  const clean = text.toLowerCase().normalize('NFC');
  const now = new Date();

  // 1. Ngày tương đối: hôm nay, hôm qua, hôm kia
  if (/\b(?:hôm qua|ngày hôm qua)\b/i.test(clean)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  if (/\b(?:hôm kia|ngày hôm kia)\b/i.test(clean)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return d.toISOString();
  }
  if (/\b(?:hôm nay|bữa nay)\b/i.test(clean)) {
    return now.toISOString();
  }

  // 2. Ngày đầy đủ: ngày 5/11/2026 hoặc 05/11/2026 hoặc 05-11-2026
  const fullDateMatch = clean.match(/(?:ngày\s+)?(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    const year = parseInt(fullDateMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 2000 && year <= 2100) {
      const d = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      return d.toISOString();
    }
  }

  // 3. Ngày tháng năm dạng chữ: ngày 5 tháng 11 năm 2026
  const textDateYearMatch = clean.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/);
  if (textDateYearMatch) {
    const day = parseInt(textDateYearMatch[1], 10);
    const month = parseInt(textDateYearMatch[2], 10) - 1;
    const year = parseInt(textDateYearMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      return d.toISOString();
    }
  }

  // 4. Ngày và tháng (năm hiện tại): ngày 5 tháng 11 hoặc ngày 5/11
  const textDateMatch = clean.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})/);
  if (textDateMatch) {
    const day = parseInt(textDateMatch[1], 10);
    const month = parseInt(textDateMatch[2], 10) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(now.getFullYear(), month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      return d.toISOString();
    }
  }

  const slashDateMatch = clean.match(/(?:ngày\s+)(\d{1,2})\s*[\/\-]\s*(\d{1,2})\b/);
  if (slashDateMatch) {
    const day = parseInt(slashDateMatch[1], 10);
    const month = parseInt(slashDateMatch[2], 10) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const d = new Date(now.getFullYear(), month, day, now.getHours(), now.getMinutes(), now.getSeconds());
      return d.toISOString();
    }
  }

  // 5. Chỉ có ngày trong tháng hiện tại: ngày 5, vào ngày 12
  const dayOnlyMatch = clean.match(/(?:vào\s+|ngày\s+)(\d{1,2})\b(?!\s*[\/\-]\s*\d)/);
  if (dayOnlyMatch && !clean.includes('hàng loạt') && !clean.includes('tháng')) {
    const day = parseInt(dayOnlyMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day, now.getHours(), now.getMinutes(), now.getSeconds());
      return d.toISOString();
    }
  }

  // 6. Thứ trong tuần (Thứ 2 .. Thứ 7, Chủ Nhật) -> quy về ngày gần nhất của thứ đó
  const weekdayIdx = parseVietnameseWeekdayIndex(clean);
  if (weekdayIdx !== null) {
    const d = new Date(now);
    const currentDay = d.getDay();
    let diff = weekdayIdx - currentDay;
    if (diff > 0) diff -= 7; // Ưu tiên ngày trong quá khứ gần nhất hoặc hôm nay
    d.setDate(d.getDate() + diff);
    return d.toISOString();
  }

  return null;
}

/**
 * Xóa sạch các cụm từ ngày tháng & thứ ra khỏi chuỗi để không làm dơ tên món / tên khách
 */
export function removeVietnameseDate(text) {
  if (!text) return '';
  return text
    .replace(/\b(?:hôm qua|ngày hôm qua|hôm kia|ngày hôm kia|hôm nay|bữa nay)\b/gi, ' ')
    .replace(/(?:vào\s+)?(?:thứ\s*(?:2|3|4|5|6|7|hai|ba|tư|bốn|năm|sáu|bảy)|chủ\s+nhật)(?:\s+tuần\s+(?:này|trước))?/giu, ' ')
    .replace(/(?:vào\s+)?ngày\s+\d{1,2}\s+tháng\s+\d{1,2}(?:\s+năm\s+\d{4})?/gi, ' ')
    .replace(/(?:vào\s+)?ngày\s+\d{1,2}\s*[\/\-]\s*\d{1,2}(?:\s*[\/\-]\s*\d{4})?/gi, ' ')
    .replace(/(?:vào\s+)?ngày\s+\d{1,2}\b(?!\s*[\/\-]\s*\d)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Viết hoa chữ cái đầu từng từ trong tên
 */
export function capitalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Bóc tách tên khách hàng từ câu tiếng Việt tự nhiên
 */
export function extractCustomerName(text) {
  if (!text) return '';
  const clean = text.normalize('NFC');
  const EXCLUDED = [
    'hàng', 'lẻ', 'sạn', 'tháng', 'hôm nay', 'hôm qua', 'hôm kia',
    'nợ', 'cod', 'nó', 'họ', 'ai', 'người ta', 'đơn', 'đơn hàng',
    'vào', 'chi', 'tiền', 'món', 'giá', 'bán', 'đã bán', 'vừa bán',
    'tất cả', 'toàn bộ', 'hết', 'cho', 'anh', 'chị', 'em', 'mục', 'được',
    'sang', 'thành', 'về', 'ra', 'lên', 'xuống', 'khoản'
  ];

  // 1. Dạng: [Tên] nợ [Số tiền] (ví dụ: đức nợ 6 triệu, anh hùng nợ 500k)
  const directMatch = clean.match(/(?:^|[\s,.\-:])([A-ZÀ-Ỹa-zà-ỹ]{2,20})\s+nợ\s+\d+/iu);
  if (directMatch && directMatch[1]) {
    const raw = directMatch[1].trim();
    if (!EXCLUDED.includes(raw.toLowerCase())) {
      return capitalizeName(raw);
    }
  }

  // 2. Dạng: cho [khách|anh|chị] [Tên] / khách [Tên] / cho [Tên]
  const forMatch = clean.match(
    /(?:cho khách|cho anh|cho chị|cho em|cho bác|cho cô|cho chú|khách hàng|khách|tên khách|tên|cho)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,20})(?:,|\.|\s+giá|\s+nợ|\s+tiền|\s+ngày|$)/iu
  );
  if (forMatch && forMatch[1]) {
    const raw = forMatch[1].trim();
    if (!EXCLUDED.includes(raw.toLowerCase())) {
      return capitalizeName(raw);
    }
  }

  // 3. Dạng: ghi nợ [cho] [Tên] [Số tiền] (ví dụ: ghi nợ đức 6 triệu)
  const ghiNoMatch = clean.match(
    /(?:ghi nợ|bán nợ|thêm nợ)\s+(?:cho\s+)?(?:khách\s+|anh\s+|chị\s+)?([A-ZÀ-Ỹa-zà-ỹ]{2,20})/iu
  );
  if (ghiNoMatch && ghiNoMatch[1]) {
    const raw = ghiNoMatch[1].trim();
    if (!EXCLUDED.includes(raw.toLowerCase())) {
      return capitalizeName(raw);
    }
  }

  // 4. Dạng: nợ của [Tên]
  const noCuaMatch = clean.match(/(?:nợ của|của khách)\s+([A-ZÀ-Ỹa-zà-ỹ]{2,20})/iu);
  if (noCuaMatch && noCuaMatch[1]) {
    const raw = noCuaMatch[1].trim();
    if (!EXCLUDED.includes(raw.toLowerCase())) {
      return capitalizeName(raw);
    }
  }

  return '';
}

/**
 * Bóc tách chi tiết đơn bán hàng từ câu nói tự nhiên tiếng Việt
 */
function extractSaleDetails(text) {
  const lower = text.toLowerCase().normalize('NFC');
  const amount = parseVietnameseMoney(text);
  const createdAt = parseVietnameseDate(text);

  // 1. Số lượng
  let quantity = 1;
  const qtyMatch =
    text.match(/(?:bán|đơn|lấy|mua)\s+(\d+)\s*(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi|áo|quần|đơn|vé|ly|chén|chai|hũ|tuýp)?\b/i) ||
    text.match(/\b(\d+)\s*(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi|áo|quần|vé|ly|chai|hũ|tuýp)\b/i);
  if (qtyMatch && parseInt(qtyMatch[1], 10) > 0) {
    quantity = parseInt(qtyMatch[1], 10);
  }

  // 2. Hình thức thanh toán
  let paymentMethod = 'CASH_TRANSFER';
  if (lower.includes('nợ') || lower.includes('ghi nợ') || lower.includes('chưa trả') || lower.includes('thiếu')) {
    paymentMethod = 'DEBT';
  } else if (lower.includes('cod') || lower.includes('ship cod') || lower.includes('giao thu tiền')) {
    paymentMethod = 'COD';
  }

  // 3. Tên khách hàng
  let customerName = extractCustomerName(text) || (paymentMethod === 'DEBT' ? 'Khách nợ' : 'Khách lẻ');

  // 4. Bóc tách tên món hàng (item_name)
  let cleaned = removeVietnameseDate(text)
    // Bỏ tiền tố hành động
    .replace(/^.*?(?:ghi bán hàng|ghi đơn bán|ghi nhận bán|bán hàng|ghi bán|đã bán|vừa bán|bán lẻ|bán)\s*[:\-\s]*/i, '')
    // Bỏ từ chỉ đơn hàng
    .replace(/(?:đã bán|vừa bán|một đơn|1 đơn|đơn hàng|đơn bán|đơn)/gi, '')
    // Bỏ cụm từ giá tiền
    .replace(/(?:trị giá|với giá|giá|tiền|thành tiền)\s*[:\s]*\d+.*$/i, '')
    // Bỏ số tiền và đơn vị
    .replace(/\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|m|củ|cu|nghìn|nghin|ngàn|ngan|k|xị|xi|đ|đồng|dong|vnd)?\b/gi, '')
    .replace(/\d{1,3}(?:[.,]\d{3})+\b/g, '')
    // Bỏ cụm khách hàng
    .replace(/(?:cho khách|cho anh|cho chị|cho bác|cho cô|cho chú|cho em|khách hàng|khách|cho)\s+[A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,20}/gi, '')
    // Bỏ phương thức thanh toán
    .replace(/(?:ghi nợ|nợ|ship cod|cod|chuyển khoản|tiền mặt)/gi, '')
    // Bỏ đơn vị đếm
    .replace(/(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi)/gi, '')
    // Dọn dẹp dấu câu thừa
    .replace(/[:,\-\.\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Chuẩn hóa tên sản phẩm
  let itemName = cleaned;
  if (!itemName || itemName.length < 2) {
    itemName = paymentMethod === 'DEBT' ? 'Đơn ghi nợ' : 'Đơn bán hàng';
  } else {
    itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
  }

  return {
    itemName,
    amount: amount || 0,
    quantity,
    paymentMethod,
    customerName,
    createdAt
  };
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

  // 0A-0. TRA CỨU THU CHI THEO THỨ (Ví dụ: "thứ 5 bán được những gì chi tiêu những gì", "thứ mấy bán được gì", "xem thu chi thứ 2")
  const isWeekdayQuery =
    /(?:thứ\s*(?:mấy|2|3|4|5|6|7|hai|ba|tư|bốn|năm|sáu|bảy)|chủ\s+nhật|hôm\s+nay|hôm\s+qua).*(?:bán\s+(?:được\s+)?(?:những\s+)?gì|chi\s+(?:tiêu\s+)?(?:những\s+)?gì|thu\s+chi)/iu.test(lower) ||
    /(?:xem|tra\s+cứu|thống\s+kê|báo\s+cáo).*(?:thu\s+chi\s+)?(?:theo\s+thứ|thứ\s*(?:2|3|4|5|6|7|hai|ba|tư|năm|sáu|bảy)|chủ\s+nhật)/iu.test(lower) ||
    /bán\s+(?:được\s+)?(?:những\s+)?gì.*chi\s+(?:tiêu\s+)?(?:những\s+)?gì/iu.test(lower);

  if (isWeekdayQuery && parseVietnameseMoney(text) === 0) {
    const wdIndex = parseVietnameseWeekdayIndex(text);
    return {
      name: 'manage_web_store',
      args: {
        operation: 'query_weekday_report',
        weekday_index: wdIndex !== null ? wdIndex : undefined
      }
    };
  }

  // 0A. XỬ LÝ SỔ NỢ / CÔNG NỢ / CHUYỂN ĐƠN SANG NỢ (Ưu tiên kiểm tra trước khi kiểm tra xóa đơn hàng!)
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
    // 0A-1. CHUYỂN ĐƠN VỪA BÁN HOẶC ĐƠN THEO SỐ TIỀN/KHÁCH SANG NỢ (convert_sale_to_debt)
    const isConvertToDebtIntent =
      /chuyển(?:\s+đơn|\s+khoản|\s+mục|\s+giao\s+dịch)?.*?(?:sang|thành)\s+nợ(?:\s|[.,!?]|$)/iu.test(lower) ||
      /đổi(?:\s+đơn)?.*?(?:sang|thành)\s+nợ(?:\s|[.,!?]|$)/iu.test(lower) ||
      /sửa(?:\s+đơn)?.*?(?:sang|thành)\s+nợ(?:\s|[.,!?]|$)/iu.test(lower) ||
      /(?:thêm|cho|tính)\s+vào\s+(?:là\s+)?(?:nó\s+|khách\s+)?nợ(?:\s|[.,!?]|$)/iu.test(lower) ||
      /(?:đơn\s+(?:vừa\s+bán|vừa\s+rồi|vừa\s+tạo|này)|giao\s+dịch\s+này)\s+(?:là\s+)?(?:khách\s+)?(?:mua\s+)?nợ(?:\s|[.,!?]|$)/iu.test(lower) ||
      /^(?:là\s+)?(?:nó|khách)\s+nợ$/iu.test(lower) ||
      /khách\s+nợ\s+đơn\s+(?:này|vừa\s+rồi|vừa\s+bán)/iu.test(lower);

    if (isConvertToDebtIntent) {
      const debtAmount = parseVietnameseMoney(text);
      const debtCust = extractCustomerName(text);
      const debtDate = parseVietnameseDate(text);
      return {
        name: 'manage_web_store',
        args: {
          operation: 'convert_sale_to_debt',
          amount: debtAmount || undefined,
          customer_name: debtCust || undefined,
          created_at: debtDate || undefined
        }
      };
    }

    // 0A-2. ĐIỀU HƯỚNG MỞ SỔ NỢ (Chỉ kích hoạt khi người dùng thực sự muốn mở trang Sổ NỢ)
    const isExplicitDebtNav =
      /(?:mở|xem|vào|bật|đi tới|chuyển qua|chuyển sang)\s+(?:trang\s+|tab\s+|mục\s+|phần\s+)?(?:sổ nợ|danh sách nợ|công nợ|mục nợ)(?:\s|[.,!?]|$)/iu.test(lower) ||
      /^(?:mở|xem|vào|đi tới)\s+(?:sổ\s+)?nợ$/iu.test(lower.trim());

    if (isExplicitDebtNav && !hasDeleteOrCancelVerb && !lower.includes('thu') && !lower.includes('trả')) {
      return {
        name: 'manage_web_store',
        args: { operation: 'navigate_ui', ui_target: 'debt' }
      };
    }

    // 0A-3. XÓA SẠCH NỢ HOẶC TẤT TOÁN THU HẾT NỢ (clear_debts)
    const isPayDebt =
      lower.includes('thu nợ') ||
      lower.includes('thu no') ||
      lower.includes('tất toán') ||
      lower.includes('tat toan') ||
      lower.includes('thu hết') ||
      lower.includes('thu het') ||
      lower.includes('trả nợ') ||
      lower.includes('tra no');

    if (hasDeleteOrCancelVerb || isPayDebt || lower.includes('hết nợ') || lower.includes('sạch nợ')) {
      let isSpecificCustomer = false;
      let targetCustomerName = null;
      const custMatch = text.match(/(?:cho|của|khách|anh|chị)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)/);
      if (custMatch && !['tất cả', 'toàn bộ', 'tháng', 'sổ nợ'].includes(custMatch[1].toLowerCase())) {
        isSpecificCustomer = true;
        targetCustomerName = custMatch[1].trim();
      }

      return {
        name: 'clear_debts',
        args: {
          scope: isSpecificCustomer ? 'customer' : 'all',
          customer_name: targetCustomerName || undefined,
          time_period: monthMatch ? `tháng ${monthMatch[1]}/${monthMatch[2] || '2026'}` : undefined,
          record_as_payment: isPayDebt
        }
      };
    }

    // 0A-4. GHI NỢ TRỰC TIẾP (Ví dụ: "đức nợ 6 triệu", "ghi nợ đức 6 triệu", "cho đức nợ 6 triệu")
    const isDirectDebtRecord =
      /(?:ghi nợ|bán nợ|cho nợ|thêm nợ|mua nợ)/iu.test(lower) ||
      /(?:^|[\s,.\-:])([A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,20})\s+nợ\s+\d+/iu.test(text);

    if (isDirectDebtRecord) {
      const amount = parseVietnameseMoney(text);
      const customerName = extractCustomerName(text) || 'Khách nợ';
      const customDate = parseVietnameseDate(text);
      if (amount > 0) {
        return {
          name: 'manage_web_store',
          args: {
            operation: 'record_sale',
            payment_method: 'DEBT',
            item_name: 'Đơn ghi nợ',
            amount,
            customer_name: customerName,
            created_at: customDate || undefined
          }
        };
      }
    }
  }

  // 0B. ĐIỀU HƯỚNG GIAO DIỆN & MỞ CỬA SỔ TRÊN WEB
  if (
    lower.includes('mở') ||
    lower.includes('xem') ||
    lower.includes('chuyển sang tab') ||
    lower.includes('chuyển qua tab') ||
    lower.includes('chuyển sang mục') ||
    lower.includes('chuyển qua mục') ||
    lower.includes('chuyển sang trang') ||
    lower.includes('bật') ||
    lower.includes('đi tới')
  ) {
    if (lower.includes('sổ nợ') || lower.includes('công nợ')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'debt' } };
    }
    if (lower.includes('lịch sử')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'history' } };
    }
    if (lower.includes('đơn ship') || lower.includes('quản lý cod') || lower.includes('cod')) {
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
    const customDate = parseVietnameseDate(text);
    const cleanedName = removeVietnameseDate(text)
      .replace(/ghi chi|chi tiền|khoản chi|chi/gi, '')
      .replace(/\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|m|củ|cu|nghìn|nghin|ngàn|ngan|k|xị|xi|đ|đồng|dong|vnd)?\b/gi, '')
      .replace(/\d{1,3}(?:[.,]\d{3})+\b/g, '')
      .replace(/[:,\-\.\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      name: 'manage_web_store',
      args: {
        operation: 'record_expense',
        item_name: cleanedName ? cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1) : 'Chi phí phát sinh',
        amount: amount || 100000,
        created_at: customDate || undefined
      }
    };
  }

  // 0C2. GHI BÁN HÀNG / BÁN HÀNG NHANH LÊN DASHBOARD
  const isSaleIntent =
    (lower.includes('ghi bán') ||
      lower.includes('bán ') ||
      lower.includes('bán hàng') ||
      lower.includes('đã bán') ||
      lower.includes('vừa bán') ||
      lower.includes('bán được') ||
      lower.includes('ghi đơn bán') ||
      lower.includes('ghi nhận bán') ||
      lower.includes('bán lẻ') ||
      /^(?:bán|đã bán|vừa bán)\s+/i.test(lower)) &&
    !hasDeleteOrCancelVerb &&
    !orderIdMatch;

  if (isSaleIntent) {
    const sale = extractSaleDetails(text);
    return {
      name: 'manage_web_store',
      args: {
        operation: 'record_sale',
        item_name: sale.itemName,
        amount: sale.amount || 100000,
        quantity: sale.quantity,
        payment_method: sale.paymentMethod,
        customer_name: sale.customerName,
        created_at: sale.createdAt || undefined
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
