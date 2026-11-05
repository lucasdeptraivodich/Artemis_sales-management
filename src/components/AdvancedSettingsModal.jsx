import { useState, useEffect } from 'react';
import {
  isSupabaseReady,
  getSupabaseConfig,
  saveSupabaseConfig,
  getSupabase,
} from '../supabase';

export default function AdvancedSettingsModal({ onClose, showToast }) {
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    setConfigUrl(cfg.url || '');
    setConfigKey(cfg.anonKey || '');
  }, []);

  const handleSaveConfig = async () => {
    setConfigStatus(null);
    if (!configUrl.trim() || !configKey.trim()) {
      setConfigStatus({
        success: false,
        message: 'Vui lòng điền đủ Supabase URL và Anon Public Key',
      });
      return;
    }

    if (!configUrl.startsWith('http://') && !configUrl.startsWith('https://')) {
      setConfigStatus({
        success: false,
        message: 'URL máy chủ phải bắt đầu bằng https://',
      });
      return;
    }

    try {
      setLoading(true);
      saveSupabaseConfig(configUrl.trim(), configKey.trim());

      const client = getSupabase();
      if (!client) throw new Error('Không thể khởi tạo kết nối');

      const { error } = await client.auth.getSession();
      if (error) throw error;

      setConfigStatus({
        success: true,
        message: '✅ Kết nối Database Supabase thành công! Dữ liệu đã sẵn sàng đồng bộ online.',
      });
      if (showToast) showToast('✅ Đã lưu cấu hình kết nối!');
    } catch (err) {
      setConfigStatus({
        success: false,
        message: '❌ Không thể kết nối: ' + (err.message || 'Kiểm tra lại URL hoặc Key'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-[460px] p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[1.5rem]">⚙️</span>
            <div>
              <h2 className="text-[1.2rem] font-extrabold text-white">Cài Đặt Nâng Cao</h2>
              <p className="text-[0.78rem] text-yellow-300 font-medium">
                Cấu hình kết nối cơ sở dữ liệu Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] text-white hover:bg-[var(--color-dark-400)] active:scale-90 transition-transform font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="flex flex-col gap-3.5">
          <div className="text-[0.82rem] text-white/90 leading-relaxed bg-[var(--color-dark-700)] p-3 rounded-xl border border-white/10">
            ℹ️ Mục này dành cho kỹ thuật viên hoặc khi muốn kết nối cơ sở dữ liệu riêng của shop (Supabase).
          </div>

          <div>
            <label className="block text-[0.82rem] text-yellow-300 mb-1 font-bold">
              Supabase Project URL
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="https://xyzabcdefg.supabase.co"
              value={configUrl}
              onChange={(e) => setConfigUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[0.82rem] text-yellow-300 mb-1 font-bold">
              Anon Public API Key
            </label>
            <textarea
              rows={3}
              className="input-field font-mono text-xs"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={configKey}
              onChange={(e) => setConfigKey(e.target.value)}
            />
          </div>

          {configStatus && (
            <div
              className={`p-3 rounded-xl text-[0.82rem] font-semibold ${
                configStatus.success
                  ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
                  : 'bg-red-950/80 border border-red-500 text-red-200'
              }`}
            >
              {configStatus.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={loading}
            className="btn-giant btn-sale text-[0.95rem] py-3 mt-1 text-white font-extrabold shadow-lg"
          >
            {loading ? '⏳ Đang kiểm tra kết nối...' : '💾 LƯU & THỬ KẾT NỐI'}
          </button>

          {/* Quick guide helper */}
          <div className="mt-1 p-3 rounded-xl bg-[var(--color-dark-700)] text-[0.78rem] text-slate-200 space-y-1 border border-white/5">
            <p className="font-bold text-yellow-300 text-[0.82rem]">
              💡 Hướng dẫn tạo kết nối miễn phí:
            </p>
            <p>1. Vào website <b>supabase.com</b> và tạo một Project mới (miễn phí vĩnh viễn).</p>
            <p>2. Chạy file <code>supabase_schema.sql</code> trong mục SQL Editor.</p>
            <p>3. Lấy <b>Project URL</b> và <b>Anon Key</b> trong mục Project Settings → API dán vào ô trên.</p>
          </div>
        </div>

        {/* Footer button */}
        <div className="pt-3 mt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--color-dark-600)] text-white hover:bg-[var(--color-dark-500)] font-bold text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
