/**
 * System Prompt & Deterministic Intent Matcher for AI Agent
 */
import { getRevenueReportData, getDebtSummary, getItems } from '../store.js';

export const SYSTEM_PROMPT = `Bạn là Trợ lý AI Quản lý Toàn diện của hệ thống Artemis (Quản lý Bán hàng, Sổ nợ & Dòng tiền).
Bạn có toàn quyền hỗ trợ người dùng thao tác MỌI TÍNH NĂNG trên trang web thông qua các công cụ:
1. get_order_status: Tra cứu thông tin và tình trạng đơn hàng (ví dụ: ORD-1001).
2. create_order: Tạo đơn hàng giao vận mới có xác nhận (Human-in-the-loop) khi có SĐT và địa chỉ giao hàng.
3. update_order: Đổi địa chỉ, số lượng hoặc hủy đơn hàng lẻ (mã ORD-...).
4. cancel_bulk_orders: Xóa/hủy hàng loạt đơn hàng theo tháng hoặc khoảng thời gian.
5. clear_debts: Xóa hết nợ / tất toán công nợ trong Sổ Nợ (xóa toàn bộ nợ chưa thu về 0đ hoặc xóa/thu nợ từng khách).
6. manage_web_store:
   - record_expense: Ghi khoản chi tiền mới (tiền điện, nhập hàng, mặt bằng...). Hỗ trợ nhận diện ngày (created_at).
   - record_sale: Ghi đơn bán hàng nhanh lên Dashboard (chọn payment_method là CASH_TRANSFER, DEBT nếu khách nợ, hoặc COD). Hỗ trợ nhận diện ngày (created_at).
   - convert_sale_to_debt: Chuyển đơn bán vừa ghi hoặc đơn theo số tiền/khách sang hình thức ghi nợ vào Sổ Nợ (khi khách nói "thêm vào là nó nợ", "chuyển đơn 6tr sang nợ", "đổi thành nợ"...).
   - upsert_item: Thêm món hàng mới hoặc cập nhật giá bán / tồn kho.
   - settle_all_cod: Thu hết tiền các đơn Ship COD đang chờ.
   - navigate_ui: Mở bất kỳ trang/cửa sổ nào trên web (home, history, debt, cod, cashflow, report, items, backup, sale_form, expense_form).
   - query_weekday_report: Xem báo cáo thu chi theo thứ trong tuần.

QUY TẮC AN TOÀN & THÔNG MINH:
- CHÚ Ý ĐIỀU HƯỚNG: Chỉ gọi navigate_ui khi người dùng THỰC SỰ MUỐN MỞ TRANG (ví dụ: "mở sổ nợ", "xem báo cáo", hoặc chỉ nói ngắn gọn "thêm đơn hàng" mà chưa có tên món/giá tiền). Tuyệt đối KHÔNG gọi navigate_ui khi người dùng muốn ghi nợ, đổi đơn sang nợ, sửa đơn, hoặc ghi bán hàng có số tiền.
- XỬ LÝ NGÀY THÁNG: Nhận diện thời gian người dùng nói (ví dụ: "hôm qua", "ngày 5/11", "ngày 02/11/2026") và truyền vào tham số created_at dạng ISO 8601.
- Với thao tác nhạy cảm (tạo đơn, sửa/hủy đơn, xóa hàng loạt đơn, xóa sổ nợ), luôn gọi tool để hiển thị bảng xác nhận trước khi ghi vào DB.
- Khi người dùng trò chuyện tự nhiên, hỏi thăm (ví dụ: "m làm dc những gì", "hôm nay bán được nhiêu", "tư vấn giúp chị"...), hãy trả lời thật tự nhiên, thân thiện, thông minh như một người trợ lý thực thụ. Luôn xưng "Em" và gọi người dùng là "Anh/Chị".`;

export function buildLiveStoreContext() {
  try {
    const todayStats = getRevenueReportData('today')?.totals || {};
    const monthStats = getRevenueReportData('month')?.totals || {};
    const debtInfo = getDebtSummary() || { totalDebt: 0, owingCount: 0, owingCustomers: [] };
    const items = getItems() || [];
    const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';

    const owingNames = (debtInfo.owingCustomers || debtInfo.customers || [])
      .slice(0, 5)
      .map((c) => `${c.name} (${fmt(c.total_debt ?? c.totalDebt)})`)
      .join(', ');

    return (
      `\n\n[DỮ LIỆU CỬA HÀNG THỜI GIAN THỰC HIỆN TẠI]:\n` +
      `- Hôm nay: ${todayStats.orderCount || 0} đơn bán, Doanh thu ${fmt(todayStats.revenue)}, Thực thu ${fmt(todayStats.actualIncome)}, Chi phí ${fmt(todayStats.expense)}, Lợi nhuận ròng ${fmt(todayStats.netProfit)}.\n` +
      `- Tháng này: ${monthStats.orderCount || 0} đơn bán, Tổng doanh thu ${fmt(monthStats.revenue)}, Thực thu ${fmt(monthStats.actualIncome)}, Chi phí & Vốn ${fmt(monthStats.costAndExpense)}, Lợi nhuận ròng ${fmt(monthStats.netProfit)}.\n` +
      `- Công nợ chưa thu: ${fmt(debtInfo.totalDebt)} (${debtInfo.owingCount || 0} khách đang nợ${owingNames ? ': ' + owingNames : ''}).\n` +
      `- Số mặt hàng trong danh mục: ${items.length} món.`
    );
  } catch (e) {
    return '';
  }
}

export function parseVietnameseMoney(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().normalize('NFC');
  const END_BOUNDARY = '(?=\\s|[.,!?;:)]|$)';

  // 0. Cụm đặc biệt: "nửa triệu" / "nửa củ" (500k), "nửa lít" / "nửa xị" / "nửa trăm" (50k)
  if (new RegExp(`(?:^|\\s)nửa\\s*(?:triệu|trieu|tr|củ|cu)${END_BOUNDARY}`, 'iu').test(clean)) {
    return 500000;
  }
  if (new RegExp(`(?:^|\\s)nửa\\s*(?:lít|lit|xị|xi|trăm|tram)${END_BOUNDARY}`, 'iu').test(clean)) {
    return 50000;
  }

  // 1A. Dạng ghép triệu + rưỡi: "1 triệu rưỡi", "1tr rưỡi", "2 củ rưỡi" -> 1.500.000, 2.500.000
  const trRuoiMatch = clean.match(
    new RegExp(`(\\d+)\\s*(?:triệu|trieu|tr|m|củ|cu)\\s*(?:rưỡi|ruoi)${END_BOUNDARY}`, 'iu')
  );
  if (trRuoiMatch) {
    return parseInt(trRuoiMatch[1], 10) * 1000000 + 500000;
  }

  // 1B. Dạng ghép triệu + phần lẻ nghìn: "1tr5", "1tr500", "2tr3", "1 triệu 5", "1 triệu 500k", "1 củ 2"
  const trCompoundMatch = clean.match(
    new RegExp(
      `(\\d+)\\s*(?:triệu|trieu|tr|củ|cu)\\s*(\\d{1,3})\\s*(?:nghìn|nghin|ngàn|ngan|k|trăm|tram)?${END_BOUNDARY}`,
      'iu'
    )
  );
  if (trCompoundMatch) {
    const millions = parseInt(trCompoundMatch[1], 10) * 1000000;
    const subStr = trCompoundMatch[2];
    const subVal = parseInt(subStr, 10);
    const subAmount =
      subStr.length === 1 ? subVal * 100000 : subStr.length === 2 ? subVal * 10000 : subVal * 1000;
    return millions + subAmount;
  }

  // 1C. Số kèm chữ triệu / tr / m / củ (dùng END_BOUNDARY để không bắt nhầm "2 trăm", "2 trâm", "2 món")
  const trMatch = clean.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:triệu|trieu|tr|m|củ|cu)${END_BOUNDARY}`, 'iu')
  );
  if (trMatch) {
    return Math.round(parseFloat(trMatch[1].replace(',', '.')) * 1000000);
  }

  // 2A. Dạng trăm/xị/lít + rưỡi: "1 trăm rưỡi", "1 xị rưỡi", "1 lít rưỡi" -> 150.000
  const tramRuoiMatch = clean.match(
    new RegExp(`(\\d+)\\s*(?:trăm|tram|xị|xi|lít|lit)\\s*(?:rưỡi|ruoi)${END_BOUNDARY}`, 'iu')
  );
  if (tramRuoiMatch) {
    return parseInt(tramRuoiMatch[1], 10) * 100000 + 50000;
  }

  // 2B. Số kèm chữ nghìn / ngàn / k / cành (hỗ trợ cả "50k rưỡi" -> 50.500 hoặc giữ nguyên nghìn)
  const kMatch = clean.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:nghìn|nghin|ngàn|ngan|k|cành|canh)(?:\\s*(?:rưỡi|ruoi))?${END_BOUNDARY}`, 'iu')
  );
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }

  // 3A. Tiếng lóng "xị" / "lít" / "trăm" (1 xị / 1 lít / 1 trăm = 100.000đ, ví dụ: "2 trăm", "3 xị")
  const xiOrTramMatch = clean.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:xị|xi|lít|lit|trăm(?:\\s*(?:nghìn|nghin|ngàn|ngan|k))?|tram)${END_BOUNDARY}`, 'iu')
  );
  if (xiOrTramMatch) {
    return Math.round(parseFloat(xiOrTramMatch[1].replace(',', '.')) * 100000);
  }

  // 3B. Dạng "chục" (1 chục = 10.000đ, ví dụ: "5 chục" = 50.000đ)
  const chucMatch = clean.match(
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:chục|chuc)(?:\\s*(?:nghìn|nghin|ngàn|ngan|k))?${END_BOUNDARY}`, 'iu')
  );
  if (chucMatch) {
    return Math.round(parseFloat(chucMatch[1].replace(',', '.')) * 10000);
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

  // Loại bỏ các cụm tiền tệ trước khi dò số lượng để không bắt nhầm "bán 200 nghìn nhẫn" thành quantity = 200
  const textWithoutMoney = text
    .replace(/\b\d+\s*(?:triệu|trieu|tr|m|củ|cu)\s*(?:rưỡi|ruoi|\d{1,3}(?:\s*(?:nghìn|nghin|ngàn|ngan|k))?)/giu, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|m|củ|cu|nghìn|nghin|ngàn|ngan|k|cành|canh|xị|xi|lít|lit|trăm|tram|chục|chuc|đ|đồng|dong|vnd)(?=\s|[.,!?;:)]|$)/giu, ' ')
    .replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, ' ')
    .replace(/\b\d{4,10}\b/g, ' ');

  // 1. Số lượng
  let quantity = 1;
  const qtyMatch =
    textWithoutMoney.match(/\b(\d+)\s*(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi|áo|quần|vé|ly|chén|chai|hũ|tuýp|món|sản phẩm|sp)(?=\s|[.,!?;:)]|$)/iu) ||
    textWithoutMoney.match(/(?:bán|lấy|mua|thêm|lên|nhập)\s+(\d{1,3})(?=\s+[a-zà-ỹ])/iu);
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
    .replace(/^.*?(?:ghi bán hàng|ghi đơn bán|ghi đơn hàng|ghi nhận bán|thêm đơn hàng|thêm đơn bán|thêm đơn|lên đơn hàng|lên đơn|nhập đơn hàng|nhập đơn|tạo đơn hàng|tạo đơn bán|bán hàng|ghi bán|đã bán|vừa bán|bán lẻ|ghi đơn|bán)\s*[:\-\s]*/i, '')
    // Bỏ từ chỉ đơn hàng
    .replace(/(?:đã bán|vừa bán|một đơn|1 đơn|đơn hàng|đơn bán|đơn)/gi, '')
    // Bỏ cụm từ giá tiền
    .replace(/(?:trị giá|với giá|giá|tiền|thành tiền)\s*[:\s]*\d+.*$/i, '')
    // Bỏ số tiền ghép (1tr5, 1 triệu rưỡi, nửa triệu...) và đơn vị tiền tệ (dùng lookahead để không cắt mất chữ "trâm", "trà", "món")
    .replace(/\b(?:nửa|nua)\s*(?:triệu|trieu|tr|củ|cu|lít|lit|xị|xi|trăm|tram)(?=\s|[.,!?;:)]|$)/giu, '')
    .replace(/\b\d+\s*(?:triệu|trieu|tr|m|củ|cu)\s*(?:rưỡi|ruoi|\d{1,3}(?:\s*(?:nghìn|nghin|ngàn|ngan|k))?)(?=\s|[.,!?;:)]|$)/giu, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|m|củ|cu|nghìn|nghin|ngàn|ngan|k|cành|canh|xị|xi|lít|lit|trăm|tram|chục|chuc|đ|đồng|dong|vnd)(?:\s*(?:rưỡi|ruoi|nghìn|nghin|ngàn|ngan|k))?(?=\s|[.,!?;:)]|$)/giu, '')
    .replace(/\d{1,3}(?:[.,]\d{3})+\b/g, '')
    .replace(/\b\d{4,10}\b/g, '')
    // Bỏ số lượng đứng đầu câu (ví dụ "2 trâm cài tóc" -> "trâm cài tóc")
    .replace(/^\s*\d+\s*(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi)?\s*/i, '')
    // Bỏ cụm khách hàng
    .replace(/(?:cho khách|cho anh|cho chị|cho bác|cho cô|cho chú|cho em|khách hàng|khách|cho)\s+[A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,20}/gi, '')
    // Bỏ phương thức thanh toán
    .replace(/(?:ghi nợ|nợ|ship cod|cod|chuyển khoản|tiền mặt)/gi, '')
    // Bỏ đơn vị đếm đứng rời
    .replace(/(?:^|\s)(?:cái|chiếc|bộ|đôi|hộp|thỏi|cây|túi)(?=\s|$)/gi, ' ')
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
  // Kiểm tra lệnh ngắn mở trực tiếp form Bán Hàng hoặc form Ghi Chi (khi chưa kèm số tiền/tên món cụ thể)
  const isBareSaleFormCmd =
    /^(?:thêm|tạo|lên|nhập|ghi|mở|bật)?\s*(?:form\s+|biểu\s*mẫu\s+|cửa\s*sổ\s+)?(?:đơn\s*hàng|đơn\s*bán|đơn\s*mới|bán\s*hàng|ghi\s*bán)(?:\s+mới)?[.,!?\s]*$/iu.test(
      lower
    ) ||
    /^(?:thêm|tạo|lên|nhập)\s+đơn[.,!?\s]*$/iu.test(lower);

  if (isBareSaleFormCmd && parseVietnameseMoney(text) === 0 && !orderIdMatch) {
    return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'sale_form' } };
  }

  const isBareExpenseFormCmd =
    /^(?:thêm|tạo|nhập|ghi|mở|bật)?\s*(?:form\s+|biểu\s*mẫu\s+|cửa\s*sổ\s+)?(?:khoản\s*chi|chi\s*tiêu|chi\s*phí|ghi\s*chi|chi\s*tiền)(?:\s+mới)?[.,!?\s]*$/iu.test(
      lower
    );

  if (isBareExpenseFormCmd && parseVietnameseMoney(text) === 0 && !orderIdMatch) {
    return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'expense_form' } };
  }

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
    if (lower.includes('bán hàng') || lower.includes('form bán') || lower.includes('thêm đơn')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'sale_form' } };
    }
    if (lower.includes('ghi chi') || lower.includes('khoản chi') || lower.includes('chi tiêu')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'expense_form' } };
    }
    if (lower.includes('trang chủ') || lower.includes('dashboard')) {
      return { name: 'manage_web_store', args: { operation: 'navigate_ui', ui_target: 'home' } };
    }
  }

  // 0C. GHI CHI PHÍ / CHI TIỀN TRỰC TIẾP LÊN WEB
  if (
    lower.includes('ghi chi') ||
    lower.includes('chi tiền') ||
    lower.includes('khoản chi') ||
    lower.includes('thêm chi') ||
    /^chi\s+\d+/i.test(lower)
  ) {
    const amount = parseVietnameseMoney(text);
    const customDate = parseVietnameseDate(text);
    const cleanedName = removeVietnameseDate(text)
      .replace(/thêm khoản chi|thêm chi phí|thêm chi|ghi chi|chi tiền|khoản chi|chi/gi, '')
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
  const hasPhoneOrAddress = /(0\d{9}|\+84\d{9})/.test(text) || /(?:giao đến|địa chỉ)/i.test(lower);
  const isQuestionAboutSales =
    /(?:bao\s*nhiêu|được\s*nhiêu|dc\s*nhiêu|đc\s*nhiêu|mấy\s*đơn|những\s*gì|bán\s*gì|thế\s*nào|sao\s*rồi|\?)/iu.test(
      lower
    );
  const isSaleIntent =
    (lower.includes('ghi bán') ||
      lower.includes('bán ') ||
      lower.includes('bán hàng') ||
      lower.includes('đã bán') ||
      lower.includes('vừa bán') ||
      lower.includes('bán được') ||
      lower.includes('ghi đơn bán') ||
      lower.includes('ghi đơn hàng') ||
      lower.includes('ghi đơn') ||
      lower.includes('ghi nhận bán') ||
      lower.includes('thêm đơn hàng') ||
      lower.includes('thêm đơn bán') ||
      lower.includes('thêm đơn') ||
      lower.includes('lên đơn hàng') ||
      lower.includes('lên đơn') ||
      lower.includes('nhập đơn hàng') ||
      lower.includes('nhập đơn') ||
      lower.includes('bán lẻ') ||
      /^(?:bán|đã bán|vừa bán|thêm đơn|lên đơn|nhập đơn)\s+/i.test(lower)) &&
    !hasDeleteOrCancelVerb &&
    !orderIdMatch &&
    !hasPhoneOrAddress &&
    !isQuestionAboutSales;

  if (isSaleIntent) {
    const sale = extractSaleDetails(text);
    const matchedItem = (getItems() || []).find(
      (i) => i.name !== 'Khác...' && (i.name || '').trim().toLowerCase() === (sale.itemName || '').trim().toLowerCase()
    );
    const defaultSaleTotal = matchedItem?.default_price > 0 ? matchedItem.default_price * (sale.quantity || 1) : 100000;
    const defaultCostTotal = matchedItem?.default_cost > 0 ? matchedItem.default_cost * (sale.quantity || 1) : 0;

    return {
      name: 'manage_web_store',
      args: {
        operation: 'record_sale',
        item_name: matchedItem ? matchedItem.name : sale.itemName,
        amount: sale.amount || defaultSaleTotal,
        cost_price: defaultCostTotal || undefined,
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

  // 6. HỘI THOẠI TỰ NHIÊN & TRẢ LỜI THÔNG MINH KHI OFFLINE (Hỏi khả năng, hỏi doanh thu/lợi nhuận/công nợ, cảm ơn...)
  const isCapabilityQuestion =
    /(?:(?:m|mày|em|bạn|bot)?\s*(?:có\s*thể|biết)?\s*(?:làm|giúp|hỗ\s*trợ)\s*(?:được|dc|đc|những\s*gì)?\s*(?:gì|những\s*gì|được\s*gì|chi\s*tiết)?|bạn\s*là\s*ai|em\s*là\s*ai|m\s*là\s*ai|mày\s*là\s*ai|ai\s*đây|chức\s*năng|tính\s*năng|hướng\s*dẫn|cách\s*dùng|cách\s*sử\s*dụng|tác\s*dụng\s*gì|help|trợ\s*giúp)/iu.test(
      lower
    ) ||
    /^(?:làm\s*gì|giúp\s*gì|hỗ\s*trợ\s*gì|có\s*gì|tính\s*năng\s*gì)[.,!?\s]*$/iu.test(lower);

  if (isCapabilityQuestion) {
    return {
      textOnly:
        'Dạ, em là **Trợ lý AI Quản lý Toàn diện của Artemis** 🤖. Anh/chị có thể nói chuyện tự nhiên với em để thực hiện mọi việc trên web:\n\n' +
        '1. 🛒 **Ghi bán hàng nhanh**: *"Bán trang sức 6 triệu"*, *"Thêm đơn 2 áo 300k"*, hoặc gõ *"Thêm đơn hàng"* để mở bảng nhập.\n' +
        '2. 💸 **Quản lý Sổ Nợ**: *"Đức nợ 6 triệu"*, *"Chuyển đơn vừa rồi sang nợ"*, *"Thu hết nợ"*, *"Xóa hết nợ tháng 11"*.\n' +
        '3. 🧾 **Ghi chi tiêu**: *"Ghi chi tiền điện 500k"*, *"Chi 200k mua túi đóng hàng hôm qua"*.\n' +
        '4. 📊 **Báo cáo & Điều hướng**: *"Hôm nay bán được bao nhiêu?"*, *"Thứ 2 bán được gì?"*, *"Mở dòng tiền"*, *"Mở sổ nợ"*.'
    };
  }

  const isGreeting =
    /^(?:chào|chào\s+em|chào\s+bạn|chào\s+ad|xin\s+chào|hello|hi|hi\s+em|alo|alo\s+em|em\s*ơi|ad\s*ơi|ơi)[.,!?\s]*$/iu.test(
      lower
    );

  if (isGreeting) {
    return {
      textOnly:
        'Dạ em chào Anh/Chị! 👋 Em là Trợ lý AI Artemis. Em có thể hỗ trợ Anh/Chị:\n' +
        '• Ghi đơn bán hàng nhanh (*"Bán trang sức 6 triệu"*, *"Đã bán 2 áo 300k"*)\n' +
        '• Ghi khoản chi tiêu (*"Ghi chi tiền điện 500k"*)\n' +
        '• Quản lý Sổ Nợ (*"Đức nợ 6 triệu"*, *"Chuyển sang nợ"*, *"Mở sổ nợ"*)\n' +
        '• Báo cáo & điều hướng (*"Hôm nay bán được bao nhiêu"*, *"Mở dòng tiền"*).\n\n' +
        'Anh/chị cần em hỗ trợ việc gì ngay bây giờ ạ? 😊'
    };
  }

  const isItemsListQuestion =
    /(?:trong\s*kho|danh\s*sách\s*món|danh\s*sách\s*sản\s*phẩm|kho\s*hàng|có\s*(?:những\s*)?(?:món|sản\s*phẩm|mặt\s*hàng)\s*nào|kiểm\s*tra\s*(?:kho|hàng))/iu.test(
      lower
    );

  if (isItemsListQuestion && parseVietnameseMoney(text) === 0) {
    try {
      const items = getItems() || [];
      const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';
      if (items.length === 0) {
        return {
          textOnly:
            '📦 Hiện tại trong danh mục chưa có món hàng nào. Anh/chị có thể nói ví dụ: *"Thêm món Áo thun giá 150k vốn 90k tồn kho 50 cái"* để em tạo nhé!'
        };
      }
      const list = items
        .slice(0, 10)
        .map(
          (it, idx) =>
            `${idx + 1}. **${it.name}** — Giá bán: **${fmt(it.price || it.sale_price || 0)}** (Tồn kho: ${it.stock ?? it.quantity ?? 0})`
        )
        .join('\n');
      return {
        textOnly: `📦 **Danh sách mặt hàng trong kho (${items.length} món):**\n${list}${
          items.length > 10 ? '\n*(và còn ' + (items.length - 10) + ' món khác)*' : ''
        }`
      };
    } catch (e) {
      // ignore
    }
  }

  const isRevenueStatusQuestion =
    /(?:doanh\s*thu|lợi\s*nhuận|lãi\s*(?:bao\s*nhiêu|được\s*nhiêu)|bán\s*(?:được|dc|đc)\s*(?:bao\s*nhiêu|nhiêu)|tình\s*hình\s*(?:buôn\s*bán|kinh\s*doanh|bán\s*hàng|hôm\s*nay|tháng\s*này)|tổng\s*kết\s*(?:thu\s*chi|doanh\s*thu|hôm\s*nay))/iu.test(
      lower
    );

  if (isRevenueStatusQuestion) {
    try {
      const todayStats = getRevenueReportData('today')?.totals || {};
      const monthStats = getRevenueReportData('month')?.totals || {};
      const debtInfo = getDebtSummary() || { totalDebt: 0, owingCount: 0 };
      const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';

      return {
        textOnly:
          `📊 **Báo cáo nhanh tình hình kinh doanh của Anh/Chị:**\n\n` +
          `• **Hôm nay:** ${todayStats.orderCount || 0} đơn — Doanh thu **${fmt(todayStats.revenue)}** | Thực thu **${fmt(todayStats.actualIncome)}** | Chi phí **${fmt(todayStats.expense)}** | Lợi nhuận: **${fmt(todayStats.netProfit)}**\n` +
          `• **Tháng này:** ${monthStats.orderCount || 0} đơn — Tổng doanh thu **${fmt(monthStats.revenue)}** | Thực thu **${fmt(monthStats.actualIncome)}** | Lợi nhuận ròng: **${fmt(monthStats.netProfit)}**\n` +
          `• **Nợ chưa thu:** **${fmt(debtInfo.totalDebt)}** (${debtInfo.owingCount || 0} khách nợ).`
      };
    } catch (e) {
      // ignore and fall through
    }
  }

  const isWhoOwesQuestion =
    /(?:ai\s*(?:đang\s*)?nợ|khách\s*nào\s*(?:đang\s*)?nợ|nợ\s*bao\s*nhiêu|tổng\s*nợ\s*(?:hiện\s*tại|bao\s*nhiêu)|kiểm\s*tra\s*công\s*nợ)/iu.test(
      lower
    );

  if (isWhoOwesQuestion) {
    try {
      const debtInfo = getDebtSummary() || { totalDebt: 0, owingCount: 0, customers: [] };
      const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + 'đ';
      if (!debtInfo.owingCount || debtInfo.totalDebt <= 0) {
        return { textOnly: '🎉 Hiện tại Sổ Nợ hoàn toàn sạch sẽ (**0đ**), không có khách hàng nào đang nợ ạ!' };
      }
      const list = (debtInfo.customers || [])
        .map((c, idx) => `${idx + 1}. **${c.name}**: nợ **${fmt(c.totalDebt)}**`)
        .join('\n');
      return {
        textOnly: `📒 Hiện có **${debtInfo.owingCount} khách hàng** đang nợ tổng cộng **${fmt(debtInfo.totalDebt)}**:\n${list}`
      };
    } catch (e) {
      // ignore
    }
  }

  if (/^(?:cảm\s*ơn|cam\s*on|thanks|thank\s*you|tuyệt\s*vời|giỏi\s*quá|hay\s*quá)(?:\s+em|\s+nhé|\s+nha)?[.,!?\s]*$/iu.test(lower)) {
    return {
      textOnly: 'Dạ không có gì ạ! Cần ghi đơn, ghi chi tiêu hay kiểm tra sổ sách gì thêm anh/chị cứ nhắn em nhé! ❤️'
    };
  }

  return null;
}
