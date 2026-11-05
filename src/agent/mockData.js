/**
 * Mock Data for E-Commerce AI Agent
 */
export const ORDER_STATUS = {
  PENDING: 'PENDING',         // Chờ xác nhận
  PROCESSING: 'PROCESSING',   // Đang chuẩn bị / Đóng gói
  SHIPPING: 'SHIPPING',       // Đang vận chuyển
  DELIVERED: 'DELIVERED',     // Đã hoàn thành
  CANCELLED: 'CANCELLED'      // Đã hủy
};

export const STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  PROCESSING: 'Đang đóng gói',
  SHIPPING: 'Đang vận chuyển',
  DELIVERED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy'
};

export const INITIAL_PRODUCTS = [
  { id: 'PROD-01', name: 'Son dưỡng môi Argan', price: 120000, stock: 50 },
  { id: 'PROD-02', name: 'Kem chống nắng SPF 50+', price: 250000, stock: 35 },
  { id: 'PROD-03', name: 'Serum Vitamin C Artemis', price: 380000, stock: 20 },
  { id: 'PROD-04', name: 'Sữa rửa mặt dịu nhẹ 150ml', price: 160000, stock: 40 }
];

export const INITIAL_ORDERS = [
  {
    order_id: 'ORD-1001',
    customer_name: 'Nguyễn Văn An',
    phone: '0901234567',
    delivery_address: '123 Lê Duẩn, Hải Châu, Đà Nẵng',
    status: ORDER_STATUS.PENDING,
    status_label: STATUS_LABELS.PENDING,
    items: [
      { product_id: 'PROD-01', name: 'Son dưỡng môi Argan', quantity: 2, price: 120000, line_total: 240000 }
    ],
    total_amount: 240000,
    shipping_fee: 25000,
    grand_total: 265000,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    timeline: [
      { time: new Date(Date.now() - 3600000 * 2).toISOString(), note: 'Đơn hàng được tạo thành công' }
    ]
  },
  {
    order_id: 'ORD-1002',
    customer_name: 'Trần Thị Mai',
    phone: '0987654321',
    delivery_address: '456 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    status: ORDER_STATUS.PROCESSING,
    status_label: STATUS_LABELS.PROCESSING,
    items: [
      { product_id: 'PROD-02', name: 'Kem chống nắng SPF 50+', quantity: 1, price: 250000, line_total: 250000 }
    ],
    total_amount: 250000,
    shipping_fee: 20000,
    grand_total: 270000,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    timeline: [
      { time: new Date(Date.now() - 3600000 * 6).toISOString(), note: 'Khách xác nhận thanh toán' },
      { time: new Date(Date.now() - 3600000 * 4).toISOString(), note: 'Kho đang đóng gói hàng' }
    ]
  },
  {
    order_id: 'ORD-1003',
    customer_name: 'Lê Hoàng Nam',
    phone: '0912345678',
    delivery_address: '789 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội',
    status: ORDER_STATUS.SHIPPING,
    status_label: STATUS_LABELS.SHIPPING,
    tracking_code: 'VNPOST-8823719',
    carrier: 'Bưu điện Việt Nam (VNPost)',
    items: [
      { product_id: 'PROD-03', name: 'Serum Vitamin C Artemis', quantity: 1, price: 380000, line_total: 380000 }
    ],
    total_amount: 380000,
    shipping_fee: 30000,
    grand_total: 410000,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    timeline: [
      { time: new Date(Date.now() - 3600000 * 24).toISOString(), note: 'Đơn hàng khởi tạo' },
      { time: new Date(Date.now() - 3600000 * 18).toISOString(), note: 'Đã bàn giao cho bưu tá' }
    ]
  },
  {
    order_id: 'ORD-1004',
    customer_name: 'Phạm Thu Hương',
    phone: '0934567890',
    delivery_address: '32 Hùng Vương, TP. Nha Trang, Khánh Hòa',
    status: ORDER_STATUS.DELIVERED,
    status_label: STATUS_LABELS.DELIVERED,
    tracking_code: 'SPX-994182',
    carrier: 'Shopee Xpress',
    items: [
      { product_id: 'PROD-01', name: 'Son dưỡng môi Argan', quantity: 1, price: 120000, line_total: 120000 }
    ],
    total_amount: 120000,
    shipping_fee: 25000,
    grand_total: 145000,
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    timeline: [
      { time: new Date(Date.now() - 3600000 * 72).toISOString(), note: 'Đơn hàng khởi tạo' },
      { time: new Date(Date.now() - 3600000 * 24).toISOString(), note: 'Giao hàng thành công' }
    ]
  }
];
