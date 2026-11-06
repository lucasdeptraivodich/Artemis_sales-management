import React from 'react';
import { formatDate } from '../store';

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

export default function OrderPreviewCard({ card, onConfirm, onCancel, isProcessing }) {
  if (!card) return null;
  const { type, preview, diff, order, errorMessage, actionId } = card;
  const currentOrder = preview || order;

  if (type === 'ERROR_CARD') {
    return (
      <div className="mt-2 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200">
        <div className="flex items-center gap-1.5 font-semibold text-red-400 mb-1">
          <span>⚠️</span> <span>Từ chối yêu cầu</span>
        </div>
        <p className="leading-relaxed">{errorMessage}</p>
      </div>
    );
  }

  if (type === 'ACTION_CONFIRMED_CARD') {
    if (card.actionType === 'CLEAR_DEBTS') {
      return (
        <div className="mt-2 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-100 shadow-lg">
          <div className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
            <span>🎉</span> Đã hoàn tất xử lý Sổ Nợ
          </div>
          <p className="text-slate-300">Số dư nợ chưa thu trên Trang chủ và Sổ nợ đã được cập nhật về 0đ.</p>
        </div>
      );
    }
    if (card.actionType === 'BULK_CANCEL') {
      return (
        <div className="mt-2 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-100 shadow-lg">
          <div className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
            <span>🎉</span> Đã hoàn tất hủy hàng loạt
          </div>
          <p className="text-slate-300">Đã cập nhật hủy các đơn hàng hợp lệ trong hệ thống và tự động hoàn lại số lượng tồn kho.</p>
        </div>
      );
    }
    if (currentOrder) {
      return (
        <div className="mt-2 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-100 shadow-lg">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5 mb-2">
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <span>🎉</span> Đã hoàn tất ghi nhận
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[11px] font-mono">
              {currentOrder.order_id}
            </span>
          </div>
          <div className="space-y-1 text-slate-300">
            <p><span className="text-slate-400">Khách:</span> <strong className="text-white">{currentOrder.customer_name}</strong></p>
            <p><span className="text-slate-400">Trạng thái:</span> <span className="text-emerald-300 font-medium">{currentOrder.status_label || currentOrder.status}</span></p>
            <p><span className="text-slate-400">Tổng tiền:</span> <strong className="text-amber-300">{formatVND(currentOrder.grand_total || currentOrder.total_amount)}</strong></p>
          </div>
        </div>
      );
    }
  }

  if (type === 'ORDER_STATUS_CARD' && currentOrder) {
    return (
      <div className="mt-2 p-3 bg-slate-900/90 border border-cyan-500/40 rounded-xl text-xs text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5 mb-2">
          <span className="font-bold text-cyan-400">📦 Mã: {currentOrder.order_id}</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {currentOrder.status_label || currentOrder.status}
          </span>
        </div>
        <div className="space-y-1 text-slate-300">
          <p><span className="text-slate-400">Người nhận:</span> {currentOrder.customer_name} ({currentOrder.phone})</p>
          <p><span className="text-slate-400">Địa chỉ:</span> {currentOrder.delivery_address}</p>
          {currentOrder.carrier && (
            <p><span className="text-slate-400">Vận đơn:</span> {currentOrder.carrier} ({currentOrder.tracking_code || 'Chưa có'})</p>
          )}
        </div>
        {currentOrder.items?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-800">
            {currentOrder.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-[11px] py-0.5">
                <span>{it.quantity}x {it.name || it.product_id}</span>
                <span className="font-mono text-slate-300">{formatVND(it.line_total || (it.price * it.quantity))}</span>
              </div>
            ))}
            <div className="mt-1 pt-1 border-t border-slate-800 flex justify-between font-bold text-white">
              <span>Tổng cộng:</span>
              <span className="text-amber-400">{formatVND(currentOrder.grand_total || currentOrder.total_amount)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'BULK_CANCEL_PREVIEW') {
    const { timePeriod, cancellableOrders = [], skippedOrders = [] } = preview || card;
    return (
      <div className="mt-2 p-3 bg-gradient-to-b from-rose-950/60 to-slate-900 border border-rose-500/60 rounded-xl text-xs text-slate-200 shadow-xl">
        <div className="flex items-center justify-between border-b border-rose-500/30 pb-1.5 mb-2">
          <span className="font-bold text-rose-300 flex items-center gap-1">
            <span>⚠️</span> <span>Xác Nhận Hủy Hàng Loạt</span>
          </span>
          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold uppercase animate-pulse">
            Chờ xác nhận
          </span>
        </div>
        <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          <p><span className="text-slate-400">Thời gian:</span> <strong className="text-white">{timePeriod}</strong></p>
          <p><span className="text-slate-400">Số đơn sẽ hủy:</span> <strong className="text-rose-400">{cancellableOrders.length} đơn hàng</strong></p>
          <div className="flex flex-wrap gap-1 mt-1">
            {cancellableOrders.slice(0, 6).map((o, idx) => (
              <span key={`${o.order_id}_${idx}`} className="px-1.5 py-0.5 bg-rose-900/40 border border-rose-700/50 rounded text-[10px] font-mono text-rose-200">
                {o.order_id} ({formatVND(o.grand_total)})
              </span>
            ))}
            {cancellableOrders.length > 6 && (
              <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">
                +{cancellableOrders.length - 6} đơn khác
              </span>
            )}
          </div>
          {skippedOrders.length > 0 && (
            <p className="text-[10px] text-amber-300/80 pt-1 border-t border-slate-800">
              * Giữ nguyên {skippedOrders.length} đơn do đang giao hoặc đã hoàn tất ({skippedOrders.map((s) => s.order_id).join(', ')}).
            </p>
          )}
        </div>
        <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex gap-2">
          <button
            onClick={() => onConfirm(actionId)}
            disabled={isProcessing}
            className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? 'Đang hủy...' : `⚠️ Xác nhận hủy ${cancellableOrders.length} đơn`}
          </button>
          <button
            onClick={() => onCancel(actionId)}
            disabled={isProcessing}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer border border-slate-700"
          >
            Không hủy
          </button>
        </div>
      </div>
    );
  }

  if (type === 'CLEAR_DEBT_PREVIEW') {
    const {
      owingCustomers = [],
      totalDebt = 0,
      owingCount = 0,
      recordAsPayment = false,
      timePeriod
    } = preview || card;

    return (
      <div className="mt-2 p-3 bg-gradient-to-b from-rose-950/60 to-slate-900 border border-rose-500/60 rounded-xl text-xs text-slate-200 shadow-xl">
        <div className="flex items-center justify-between border-b border-rose-500/30 pb-1.5 mb-2">
          <span className="font-bold text-rose-300 flex items-center gap-1">
            <span>💸</span> <span>{recordAsPayment ? 'Xác Nhận Thu Hết Nợ' : 'Xác Nhận Xóa Sạch Nợ'}</span>
          </span>
          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[10px] font-bold uppercase animate-pulse">
            Chờ xác nhận
          </span>
        </div>
        <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
          {timePeriod && (
            <p><span className="text-slate-400">Kỳ yêu cầu:</span> <strong className="text-white">{timePeriod}</strong></p>
          )}
          <p><span className="text-slate-400">Số khách đang nợ:</span> <strong className="text-amber-300">{owingCount} khách hàng</strong></p>
          <p><span className="text-slate-400">Tổng nợ sẽ xóa:</span> <strong className="text-rose-400 text-sm">{formatVND(totalDebt)}</strong></p>
          <div className="flex flex-wrap gap-1 mt-1">
            {owingCustomers.slice(0, 6).map((c, idx) => (
              <span key={`${c.id || idx}`} className="px-1.5 py-0.5 bg-rose-900/40 border border-rose-700/50 rounded text-[10px] font-mono text-rose-200">
                {c.name} ({formatVND(c.total_debt)})
              </span>
            ))}
            {owingCustomers.length > 6 && (
              <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">
                +{owingCustomers.length - 6} khách khác
              </span>
            )}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex gap-2">
          <button
            onClick={() => onConfirm(actionId)}
            disabled={isProcessing}
            className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? 'Đang xử lý...' : `⚠️ Xác nhận ${recordAsPayment ? 'thu' : 'xóa'} ${formatVND(totalDebt)}`}
          </button>
          <button
            onClick={() => onCancel(actionId)}
            disabled={isProcessing}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer border border-slate-700"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    );
  }

  if (type === 'WEB_ACTION_CARD') {
    if (card.tx) {
      const isSale = card.tx.type === 'SALE';
      return (
        <div
          className={`mt-2 p-3 ${
            isSale ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100' : 'bg-amber-950/60 border-amber-500/40 text-amber-100'
          } border rounded-xl text-xs shadow-lg`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
            <span className={`font-bold flex items-center gap-1.5 ${isSale ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span>{isSale ? '🛒' : '💸'}</span> {isSale ? 'Đã ghi nhận đơn bán hàng' : 'Đã ghi nhận khoản chi'}
            </span>
            <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-mono">{card.tx.id}</span>
          </div>
          <div className="space-y-1 text-slate-300">
            <p>
              <span className="text-slate-400">Món:</span> <strong className="text-white">{card.tx.item_name}</strong>
            </p>
            <p>
              <span className="text-slate-400">Số tiền:</span>{' '}
              <strong className="text-amber-300 text-sm">{formatVND(card.tx.sale_price || card.tx.amount)}</strong>
            </p>
            {card.tx.customer_name && card.tx.customer_name !== 'Khách lẻ' && (
              <p>
                <span className="text-slate-400">Khách:</span>{' '}
                <span className="text-white font-medium">{card.tx.customer_name}</span>
              </p>
            )}
            <p>
              <span className="text-slate-400">Thanh toán:</span>{' '}
              <span className="text-emerald-300 font-medium">
                {card.tx.payment_method === 'DEBT'
                  ? 'Ghi nợ'
                  : card.tx.payment_method === 'COD'
                  ? 'Ship COD'
                  : 'Tiền mặt / Chuyển khoản'}
              </span>
            </p>
            {card.tx.created_at && (
              <p>
                <span className="text-slate-400">Thời gian:</span>{' '}
                <span className="text-slate-300 font-mono text-[11px]">{formatDate(card.tx.created_at)}</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  const isCreate = type === 'CREATE_ORDER_PREVIEW';

  return (
    <div className="mt-2 p-3 bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/50 rounded-xl text-xs text-slate-200">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5 mb-2">
        <span className="font-bold text-amber-300">📝 {isCreate ? 'Bản Nháp Đơn Mới' : 'Bản Xem Trước Sửa Đơn'}</span>
        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold uppercase animate-pulse">
          Chờ bạn duyệt
        </span>
      </div>

      {isCreate && currentOrder && (
        <div className="space-y-1">
          <p><span className="text-slate-400">Khách:</span> <strong className="text-white">{currentOrder.customer_name}</strong> ({currentOrder.phone})</p>
          <p><span className="text-slate-400">Giao đến:</span> {currentOrder.delivery_address}</p>
          <div className="mt-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            {currentOrder.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs py-0.5">
                <span>{it.quantity}x {it.name}</span>
                <span className="font-mono text-slate-300">{formatVND(it.line_total)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>Phí ship:</span>
              <span className="font-mono">{formatVND(currentOrder.shipping_fee)}</span>
            </div>
            <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-700/60 mt-1">
              <span>Tổng COD:</span>
              <span className="text-amber-400 text-sm">{formatVND(currentOrder.grand_total)}</span>
            </div>
          </div>
        </div>
      )}

      {!isCreate && diff && (
        <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <p><span className="text-slate-400">Mã đơn:</span> <strong className="text-cyan-400">{card.orderId}</strong></p>
          {diff.action === 'cancel_order' && (
            <div className="text-rose-300 bg-rose-950/30 p-1.5 rounded border border-rose-500/30">
              <strong>Yêu cầu hủy đơn hàng</strong>
              <p className="text-[11px] text-slate-300">Lý do: {diff.reason}</p>
            </div>
          )}
          {diff.action === 'change_address' && (
            <div className="text-[11px]">
              <p className="text-slate-400 line-through">Cũ: {diff.oldAddress}</p>
              <p className="text-emerald-300 font-medium">Mới: {diff.newAddress}</p>
            </div>
          )}
          {diff.action === 'change_quantity' && (
            <div className="text-[11px]">
              <p>{diff.productName}: <span className="line-through">{diff.oldQuantity}</span> ➡️ <strong className="text-emerald-300">{diff.newQuantity}</strong></p>
              <p className="font-bold text-white">Tổng mới: <span className="text-amber-400">{formatVND(diff.newGrandTotal)}</span></p>
            </div>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex gap-2">
        <button
          onClick={() => onConfirm(actionId)}
          disabled={isProcessing}
          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? 'Đang ghi...' : '✅ Xác nhận thực hiện'}
        </button>
        <button
          onClick={() => onCancel(actionId)}
          disabled={isProcessing}
          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all cursor-pointer border border-slate-700"
        >
          Hủy bỏ
        </button>
      </div>
    </div>
  );
}
