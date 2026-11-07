import { useState, useMemo } from 'react';
import { getCodOrders, markCodReceived, formatMoney, formatDate } from '../store';
import {
  IconTruck,
  IconSearch,
  IconX,
  IconCopy,
  IconCheck,
  IconEdit,
} from './Icons';

function getCarrierTrackingUrl(code) {
  if (!code) return null;
  const cleanCode = code.trim();
  const upper = cleanCode.toUpperCase();
  const encodedCode = encodeURIComponent(cleanCode);

  if (upper.startsWith('VTP') || upper.startsWith('VT') || /^\d{10,12}$/.test(cleanCode)) {
    return `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don-hang/?tracking=${encodedCode}`;
  }
  if (upper.startsWith('GHN') || cleanCode.length === 8) {
    return `https://donhang.ghn.vn/?order_code=${encodedCode}`;
  }
  if (upper.startsWith('S') || upper.startsWith('B') || upper.includes('GHTK')) {
    return `https://giaohangtietkiem.vn/tra-cuu-van-don/?code=${encodedCode}`;
  }
  return `https://www.google.com/search?q=tra+c%E1%BB%A9u+v%E1%BA%ADn+%C4%91%C6%A1n+${encodedCode}`;
}

export default function CodManager({ onRefresh, showToast, onEditOrder }) {
  const allCodOrders = getCodOrders();
  const [filter, setFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = useMemo(() => {
    return allCodOrders.filter((o) => {
      if (filter === 'pending' && o.is_cod_received) return false;
      if (filter === 'received' && !o.is_cod_received) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (o.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (o.customer_phone || '').toLowerCase().includes(q);
        const matchAddress = (o.shipping_address || '').toLowerCase().includes(q);
        const matchTracking = (o.tracking_code || '').toLowerCase().includes(q);
        const matchItem = (o.item_name || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAddress && !matchTracking && !matchItem) return false;
      }
      return true;
    });
  }, [allCodOrders, filter, searchQuery]);

  const pendingCount = allCodOrders.filter((o) => !o.is_cod_received).length;
  const receivedCount = allCodOrders.filter((o) => o.is_cod_received).length;
  const pendingTotal = allCodOrders
    .filter((o) => !o.is_cod_received)
    .reduce((sum, o) => sum + (o.sale_price || 0), 0);

  const handleToggleCod = (order) => {
    const newState = !order.is_cod_received;
    markCodReceived(order.id, newState);
    showToast(newState ? '✅ Đã nhận tiền COD!' : '↩️ Đã đánh dấu chưa nhận');
    onRefresh();
  };

  const handleCopyAddress = (order) => {
    const text = `${order.customer_name || 'Khách'} - ${order.customer_phone || ''} - ${order.shipping_address || ''}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Đã copy địa chỉ!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('📋 Đã copy địa chỉ!');
    });
  };

  const handleCopyTracking = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      showToast('📋 Đã copy mã vận đơn!');
    });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pt-1">
        <div>
          <h1 className="text-[1.25rem] font-extrabold text-white flex items-center gap-2">
            <IconTruck className="w-5 h-5 text-blue-400" />
            <span>Đơn Giao Hàng & COD</span>
          </h1>
          <p className="text-[0.72rem] text-slate-400 mt-0.5">
            Tổng {allCodOrders.length} đơn ship giao hàng
          </p>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 to-slate-900/80 border border-blue-500/30 rounded-2xl p-3.5 mb-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[0.72rem] font-bold text-slate-300 uppercase tracking-wider block">
            Chờ đối soát / thanh toán COD
          </span>
          <p className="font-black text-[1.4rem] text-blue-400 mt-0.5">
            {formatMoney(pendingTotal)}
          </p>
        </div>
        <div className="text-right">
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
            {pendingCount} đơn chờ thu
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            {receivedCount} đơn đã nhận
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8 text-sm py-2"
          placeholder="Tìm người nhận, SĐT, mã vận đơn, địa chỉ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <IconSearch className="w-4 h-4" />
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-3 text-xs">
        {[
          { id: 'pending', label: `Chờ thu (${pendingCount})` },
          { id: 'received', label: `Đã nhận (${receivedCount})` },
          { id: 'all', label: `Tất cả (${allCodOrders.length})` },
        ].map((f) => (
          <button
            key={f.id}
            className={`flex-1 py-2 rounded-xl font-bold transition-all border ${
              filter === f.id
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border-white/5'
            }`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto mb-2.5 flex items-center justify-center">
            <IconTruck className="w-6 h-6" />
          </div>
          <p className="text-white font-bold text-sm">
            {filter === 'pending' ? 'Không có đơn đang chờ COD' : 'Chưa có đơn COD nào'}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Chọn hình thức "Ship COD" khi bán hàng để tạo đơn mới.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredOrders.map((order) => {
            const trackingUrl = getCarrierTrackingUrl(order.tracking_code);

            return (
              <div
                key={order.id}
                className={`p-3 rounded-2xl bg-slate-900/60 border transition-all ${
                  order.is_cod_received
                    ? 'border-emerald-500/20 bg-slate-900/40 opacity-75'
                    : 'border-white/5 hover:border-white/10'
                }`}
              >
                {/* Top section */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-white truncate">
                        {order.item_name}
                        {order.quantity && order.quantity > 1 && (
                          <span className="text-emerald-400 font-bold ml-1.5 text-xs">
                            ×{order.quantity}
                          </span>
                        )}
                      </p>
                      {onEditOrder && (
                        <button
                          onClick={() => onEditOrder(order)}
                          title="Sửa thông tin đơn ship COD"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                        >
                          <IconEdit className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className="font-extrabold text-sm text-blue-400">
                    {formatMoney(order.sale_price)}
                  </span>
                </div>

                {/* Customer info */}
                <div className="rounded-xl p-2.5 mb-2.5 bg-slate-950/50 border border-white/5 space-y-1">
                  {order.customer_name && (
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">Người nhận:</span> {order.customer_name}
                    </p>
                  )}
                  {order.customer_phone && (
                    <p className="text-xs text-slate-300 font-medium">
                      <span className="text-slate-400 font-normal">SĐT:</span> {order.customer_phone}
                    </p>
                  )}
                  {order.shipping_address && (
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-400 font-normal">Đ/c:</span> {order.shipping_address}
                    </p>
                  )}
                  {order.tracking_code && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <span className="text-xs font-semibold text-blue-400 truncate">
                        MVĐ: {order.tracking_code}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleCopyTracking(order.tracking_code)}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                        >
                          <IconCopy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                        {trackingUrl && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold"
                          >
                            Tra cứu ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  {(order.customer_name || order.shipping_address) && (
                    <button
                      className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 active:scale-95 transition-all"
                      onClick={() => handleCopyAddress(order)}
                    >
                      <IconCopy className="w-3.5 h-3.5" />
                      <span>Copy Địa Chỉ</span>
                    </button>
                  )}

                  <button
                    className={`flex-1 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all border ${
                      order.is_cod_received
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400'
                    }`}
                    onClick={() => handleToggleCod(order)}
                  >
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>{order.is_cod_received ? 'Đã thu COD' : 'Xác nhận thu COD'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
