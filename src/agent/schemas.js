/**
 * ============================================================================
 * AI FUNCTION CALLING / TOOL DEFINITIONS (OpenAI & Gemini Compatible Schema)
 * ============================================================================
 * Chức năng: Khai báo JSON Schema chuẩn cho các công cụ AI Agent có thể gọi.
 * Tuân thủ chuẩn OpenAI tools / Gemini function declarations.
 */

export const ORDER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Tra cứu thông tin chi tiết và tiến độ trạng thái của một đơn hàng dựa trên mã đơn hàng (order_id). Sử dụng khi khách hàng muốn kiểm tra tình trạng giao hàng, tiền thu COD, hoặc danh sách sản phẩm trong đơn.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'Mã định danh đơn hàng cần tra cứu (ví dụ: ORD-1001, ORD-1002).',
            pattern: '^[A-Za-z0-9-_]+$'
          }
        },
        required: ['order_id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Tạo một đơn hàng mới sau khi đã thu thập đủ họ tên khách hàng, số điện thoại, địa chỉ nhận hàng và danh sách sản phẩm. LƯU Ý: Hàm này chỉ sinh bản nháp (draft preview) để khách hàng xác nhận, KHÔNG được ghi trực tiếp vào cơ sở dữ liệu khi chưa có sự đồng ý của khách.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Họ và tên của khách hàng nhận hàng (tối thiểu 2 ký tự).',
            minLength: 2
          },
          phone: {
            type: 'string',
            description: 'Số điện thoại liên lạc của người nhận hàng (định dạng số điện thoại Việt Nam 10 chữ số, ví dụ: 0901234567 hoặc +84901234567).',
            pattern: '^(0|\\+84)[3|5|7|8|9][0-9]{8}$'
          },
          items: {
            type: 'array',
            description: 'Danh sách các sản phẩm và số lượng tương ứng mà khách muốn đặt.',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                product_id: {
                  type: 'string',
                  description: 'Mã sản phẩm trong hệ thống (ví dụ: PROD-01, PROD-02) hoặc tên sản phẩm rõ ràng.'
                },
                quantity: {
                  type: 'integer',
                  description: 'Số lượng mua của sản phẩm này. Phải là số nguyên dương lớn hơn hoặc bằng 1.',
                  minimum: 1
                }
              },
              required: ['product_id', 'quantity'],
              additionalProperties: false
            }
          },
          delivery_address: {
            type: 'string',
            description: 'Địa chỉ giao hàng chi tiết (số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố).',
            minLength: 5
          },
          note: {
            type: 'string',
            description: 'Ghi chú thêm cho đơn hàng (ví dụ: giao giờ hành chính, gọi trước khi giao).'
          }
        },
        required: ['customer_name', 'phone', 'items', 'delivery_address'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_order',
      description: 'Cập nhật thông tin đơn hàng đã có (đổi số lượng sản phẩm, đổi địa chỉ nhận hàng, hoặc hủy đơn hàng). Hệ thống sẽ tự động từ chối nếu đơn hàng đã ở trạng thái SHIPPING (Đang vận chuyển) hoặc DELIVERED (Đã hoàn thành).',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'Mã đơn hàng cần chỉnh sửa hoặc hủy (ví dụ: ORD-1001).',
            pattern: '^[A-Za-z0-9-_]+$'
          },
          action: {
            type: 'string',
            enum: ['change_quantity', 'change_address', 'cancel_order'],
            description: 'Loại thao tác muốn thực hiện trên đơn hàng.'
          },
          payload: {
            type: 'object',
            description: 'Dữ liệu tương ứng với action được chọn. Ví dụ: đổi địa chỉ cần { new_address }, đổi số lượng cần { product_id, new_quantity }, hủy đơn có thể kèm { reason }.',
            properties: {
              new_address: {
                type: 'string',
                description: 'Địa chỉ nhận hàng mới nếu action là change_address (tối thiểu 5 ký tự).'
              },
              product_id: {
                type: 'string',
                description: 'Mã sản phẩm cần đổi số lượng nếu action là change_quantity.'
              },
              new_quantity: {
                type: 'integer',
                minimum: 1,
                description: 'Số lượng mới của sản phẩm nếu action là change_quantity (phải là số nguyên > 0).'
              },
              reason: {
                type: 'string',
                description: 'Lý do thay đổi hoặc lý do hủy đơn hàng.'
              }
            },
            additionalProperties: false
          }
        },
        required: ['order_id', 'action', 'payload'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_bulk_orders',
      description: 'Yêu cầu hủy/xóa hàng loạt các đơn hàng theo khoảng thời gian (ví dụ: tháng 11/2026, toàn bộ). Bắt buộc phải qua bước người dùng bấm nút Xác nhận trước khi thực thi.',
      parameters: {
        type: 'object',
        properties: {
          time_period: {
            type: 'string',
            description: 'Khoảng thời gian cần hủy (ví dụ: "tháng 11/2026", "2026-11").'
          },
          reason: {
            type: 'string',
            description: 'Lý do hủy đơn hàng loạt.'
          }
        },
        required: ['time_period'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clear_debts',
      description: 'Xóa nợ hoặc thu nợ trong Sổ Nợ (ví dụ: "xóa hết nợ", "xóa hết nợ của tháng 11", "xóa sạch sổ nợ", "xóa nợ cho khách Hùng", "thu hết nợ"). Sinh bản xem trước để người dùng bấm Xác nhận.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['all', 'customer'],
            description: 'Phạm vi xóa nợ: "all" (toàn bộ sổ nợ) hoặc "customer" (một khách hàng cụ thể).'
          },
          customer_name: {
            type: 'string',
            description: 'Tên khách hàng nếu scope là "customer".'
          },
          time_period: {
            type: 'string',
            description: 'Khoảng thời gian người dùng đề cập (nếu có, ví dụ: "tháng 11/2026").'
          },
          record_as_payment: {
            type: 'boolean',
            description: 'True nếu khách trả nợ (ghi vào thu thực), False nếu xóa bỏ khoản nợ.'
          }
        },
        required: ['scope'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_web_store',
      description: 'Điều khiển mọi tính năng trên ứng dụng Web Artemis: ghi khoản chi phí mới (record_expense), ghi đơn bán nhanh (record_sale), thêm/sửa món hàng trong kho (upsert_item), thu toàn bộ tiền Ship COD (settle_all_cod), hoặc chuyển tab / mở cửa sổ chức năng trên giao diện (navigate_ui).',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['record_expense', 'record_sale', 'upsert_item', 'settle_all_cod', 'navigate_ui'],
            description: 'Loại thao tác trên hệ thống web.'
          },
          item_name: {
            type: 'string',
            description: 'Tên khoản chi, tên mặt hàng bán, hoặc tên sản phẩm trong kho.'
          },
          amount: {
            type: 'number',
            description: 'Số tiền chi phí hoặc giá bán (VNĐ).'
          },
          cost_price: {
            type: 'number',
            description: 'Giá vốn sản phẩm (VNĐ).'
          },
          quantity: {
            type: 'number',
            description: 'Số lượng bán hoặc số lượng tồn kho.'
          },
          customer_name: {
            type: 'string',
            description: 'Tên khách hàng (nếu có).'
          },
          payment_method: {
            type: 'string',
            enum: ['CASH_TRANSFER', 'DEBT', 'COD'],
            description: 'Phương thức thanh toán khi bán hàng.'
          },
          ui_target: {
            type: 'string',
            enum: ['home', 'history', 'debt', 'cod', 'cashflow', 'report', 'items', 'backup', 'sale_form', 'expense_form'],
            description: 'Đích điều hướng trên giao diện web khi operation là navigate_ui.'
          }
        },
        required: ['operation'],
        additionalProperties: false
      }
    }
  }
];

/**
 * Hàm kiểm tra tính hợp lệ của số điện thoại Việt Nam
 */
export function isValidVietnamPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  return vnPhoneRegex.test(cleanPhone);
}

/**
 * Hàm kiểm tra số lượng có phải là số nguyên dương > 0 hay không
 */
export function isValidQuantity(qty) {
  return Number.isInteger(qty) && qty > 0;
}
