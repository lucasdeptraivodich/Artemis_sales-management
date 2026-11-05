import { useState, useMemo } from 'react';
import { getCodOrders, markCodReceived, formatMoney, formatDate } from '../store';

function getCarrierTrackingUrl(code) {
  if (!code) return null;
  const cleanCode = code.trim();
  const upper = cleanCode.toUpperCase();

  if (upper.startsWith('VTP') || upper.startsWith('VT') || /^\d{10,12}$/.test(cleanCode)) {
    return `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don-hang/?tracking=${cleanCode}`;
  }
  if (upper.startsWith('GHN') || cleanCode.length === 8) {
    return `https://donhang.ghn.vn/?order_code=${cleanCode}`;
  }
  if (upper.startsWith('S') || upper.startsWith('B') || upper.includes('GHTK')) {
    return `https://giaohangtietkiem.vn/tra-cuu-van-don/?code=${cleanCode}`;
  }
  return `https://www.google.com/search?q=tra+c%E1%BB%A9u+v%E1%BA%ADn+%C4%91%C6%A1n+${encodeURIComponent(cleanCode)}`;
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
      <div className="flex items-center justify-between mb-2 pt-2">
        <h1 className="text-[1.35rem] font-extrabold text-white">📦 Đơn Ship / COD</h1>
        <span className="text-[0.82rem] text-yellow-300 font-bold">
          {allCodOrders.length} đơn
        </span>
      </div>

      <div
        className="glass-card p-4 mb-3 flex items-center justify-between"
        style={{ borderLeft: '4px solid var(--color-blue-500)' }}
      >
        <div>
          <p className="text-[0.82rem] text-yellow-300 font-semibold">Chờ đối soát / thanh toán COD</p>
          <p className="font-extrabold text-[1.3rem]" style={{ color: 'var(--color-blue-400)' }}>
            {formatMoney(pendingTotal)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="pulse-dot" style={{ background: 'var(--color-orange-400)' }} />
            <span className="text-[0.88rem] font-bold text-white">{pendingCount} chờ thu</span>
          </div>
          <span className="text-[0.78rem] text-slate-200 block mt-0.5">
            {receivedCount} đã nhận
          </span>
        </div>
      </div>

      <div className="relative mb-3">
        <input
          className="input-field pl-9 pr-8"
          placeholder="Tìm người nhận, SĐT, mã vận đơn, địa chỉ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-300 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { id: 'pending', label: `⏳ Chờ thu (${pendingCount})` },
          { id: 'received', label: `✅ Đã nhận (${receivedCount})` },
          { id: 'all', label: `Tất cả (${allCodOrders.length})` },
        ].map((f) => (
          <button
            key={f.id}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-[0.88rem] transition-all border ${
              filter === f.id
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-blue-400 shadow-md'
                : 'bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] border-white/10'
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
          <p className="text-[2.5rem] mb-3">📭</p>
          <p className="text-[var(--color-text-muted)] text-[1.05rem]">
            {filter === 'pending' ? 'Không có đơn đang chờ thanh toán' : 'Chưa có đơn COD nào'}
          </p>
          <p className="text-[var(--color-text-muted)] text-[0.85rem] mt-1">
            Thử thay đổi bộ lọc hoặc tạo đơn COD mới khi bán hàng.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredOrders.map((order) => {
            const trackingUrl = getCarrierTrackingUrl(order.tracking_code);

            return (
              <div key={order.id} className={`cod-card ${order.is_cod_received ? 'received' : ''}`}>
                {/* Top section */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[1.05rem] truncate">
                        {order.item_name}
                        {order.quantity && order.quantity > 1 && (
                          <span className="text-amber-300 font-bold ml-1.5 text-xs">
                            ×{order.quantity}
                          </span>
                        )}
                      </p>
                      {onEditOrder && (
                        <button
                          onClick={() => onEditOrder(order)}
                          title="Sửa thông tin đơn ship COD"
                          className="w-6 h-6 rounded bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] flex items-center justify-center text-[0.72rem] text-slate-300"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                    <p className="text-[0.78rem] text-[var(--color-text-muted)] mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className="font-extrabold text-[1.15rem]" style={{ color: 'var(--color-blue-400)' }}>
                    {formatMoney(order.sale_price)}
                  </span>
                </div>

                {/* Customer info */}
                  <div className="rounded-lg p-3 mb-3 bg-black/40 border border-white/5">
                    {order.customer_name && (
                      <p className="text-[0.92rem] font-bold text-white">👤 {order.customer_name}</p>
                    )}
                    {order.customer_phone && (
                      <p className="text-[0.82rem] text-yellow-300 font-semibold mt-0.5">
                        📱 {order.customer_phone}
                      </p>
                    )}
                    {order.shipping_address && (
                      <p className="text-[0.82rem] text-slate-100 font-medium mt-0.5">
                        📍 {order.shipping_address}
                      </p>
                    )}
                  {order.tracking_code && (
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
                      <span className="text-[0.82rem] font-semibold text-blue-400">
                        🔖 MVĐ: {order.tracking_code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyTracking(order.tracking_code)}
                          className="text-[0.7rem] px-2 py-0.5 rounded bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-slate-300"
                        >
                          Copy MVĐ
                        </button>
                        {trackingUrl && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[0.7rem] px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold"
                          >
                            Tra cứu ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {(order.customer_name || order.shipping_address) && (
                    <button
                      className="flex-1 py-2.5 rounded-xl font-bold text-[0.88rem] active:scale-95 transition-transform"
                      style={{
                        background: 'var(--color-dark-500)',
                        color: 'var(--color-text-primary)',
                      }}
                      onClick={() => handleCopyAddress(order)}
                    >
                      📋 Copy Địa Chỉ
                    </button>
                  )}

                  <button
                    className="flex-1 py-2.5 rounded-xl font-bold text-[0.88rem] flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    style={{
                      background: order.is_cod_received
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'linear-gradient(135deg, var(--color-green-600), var(--color-green-500))',
                      color: order.is_cod_received ? 'var(--color-green-400)' : 'white',
                    }}
                    onClick={() => handleToggleCod(order)}
                  >
                    {order.is_cod_received ? <>✅ Đã nhận tiền</> : <>💰 Nhận tiền COD</>}
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
