import { useState } from 'react';
import {
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  isSupabaseReady,
} from '../supabase';
import { uploadLocalDataToCloud, syncAllFromCloud } from '../store';
import AdvancedSettingsModal from './AdvancedSettingsModal';

export default function AuthModal({ user, onClose, onAuthSuccess, showToast }) {
  const isReady = isSupabaseReady();
  const [activeTab, setActiveTab] = useState(user ? 'profile' : 'login');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [syncLocalData, setSyncLocalData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Login
  const handleLogin = async (e) => {
    e?.preventDefault();
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu');
      return;
    }

    try {
      setLoading(true);
      const data = await signInWithEmail(email.trim(), password);
      showToast('🎉 Đăng nhập thành công!');
      
      // Đồng bộ dữ liệu từ cloud về máy
      try {
        await syncAllFromCloud();
      } catch (syncErr) {
        console.warn('Lỗi đồng bộ ngay sau login:', syncErr);
      }

      if (onAuthSuccess) onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Đăng nhập thất bại';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email hoặc mật khẩu không chính xác!';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Email chưa được xác thực trong Supabase!';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async (e) => {
    e?.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Vui lòng nhập Email và Mật khẩu');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu cần tối thiểu 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu nhập lại không khớp');
      return;
    }

    try {
      setLoading(true);
      const data = await signUpWithEmail(email.trim(), password, shopName.trim());
      showToast('🎉 Đăng ký thành công!');

      // Nếu có chọn sao lưu dữ liệu hiện tại lên Cloud
      if (syncLocalData && data.user) {
        try {
          await uploadLocalDataToCloud();
          showToast('☁️ Đã sao lưu dữ liệu máy lên Cloud!');
        } catch (syncErr) {
          console.warn('Lỗi upload dữ liệu cũ lên cloud:', syncErr);
        }
      }

      if (onAuthSuccess) onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Đăng ký thất bại';
      if (msg.includes('User already registered')) {
        msg = 'Email này đã được đăng ký tài khoản!';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOutUser();
      showToast('👋 Đã đăng xuất an toàn');
      if (onAuthSuccess) onAuthSuccess(null);
      onClose();
    } catch (err) {
      showToast('Lỗi khi đăng xuất: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content max-w-[440px] p-5" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-[1.5rem]">🔐</span>
              <h2 className="text-[1.25rem] font-extrabold text-white">
                {user ? 'Tài Khoản & Dữ Liệu' : 'Đăng Nhập / Đăng Ký'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[1.2rem] bg-[var(--color-dark-500)] text-white active:scale-90 transition-transform font-bold"
            >
              ✕
            </button>
          </div>

          {/* Tab Switcher - Chỉ hiển thị Đăng Nhập & Đăng Ký */}
          {!user ? (
            <div className="flex bg-[var(--color-dark-600)] rounded-xl p-1 mb-4 border border-white/10">
              <button
                type="button"
                className={`flex-1 py-2.5 text-[0.92rem] rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-white hover:text-emerald-300 font-bold'
                }`}
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-[0.92rem] rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                    : 'text-white hover:text-emerald-300 font-bold'
                }`}
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage('');
                }}
              >
                Đăng Ký
              </button>
            </div>
          ) : null}

          {/* Offline / Not Configured gentle warning */}
          {!isReady && (
            <div
              className="mb-4 p-3 rounded-xl text-[0.82rem] leading-relaxed cursor-pointer bg-amber-500/15 border border-amber-500/40 text-yellow-300"
              onClick={() => setShowAdvancedSettings(true)}
            >
              <div className="font-bold flex items-center gap-1.5">
                <span>⚙️</span> Chưa kết nối máy chủ online
              </div>
              <p className="mt-1 text-[0.78rem] text-slate-200">
                Ứng dụng hiện lưu dữ liệu an toàn trên máy. Nhấn vào đây để mở <b>Cài đặt nâng cao</b> nếu muốn kết nối máy chủ online.
              </p>
            </div>
          )}

        {/* Error message */}
        {errorMessage && (
          <div
            className="mb-4 p-3 rounded-xl text-[0.85rem] text-red-200"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid var(--color-red-500)',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* TAB 1: ĐĂNG NHẬP */}
        {activeTab === 'login' && !user && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Email
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="ví dụ: cuahang@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pr-12"
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[1.1rem] opacity-70 hover:opacity-100"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-giant btn-sale mt-2 text-[1rem] py-3.5"
            >
              {loading ? '⏳ Đang đăng nhập...' : '🚀 ĐĂNG NHẬP'}
            </button>

            <div className="text-center text-[0.82rem] text-[var(--color-text-muted)] mt-2">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="text-[var(--color-green-400)] font-bold underline hover:opacity-80"
              >
                Đăng ký ngay
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: ĐĂNG KÝ */}
        {activeTab === 'register' && !user && (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Tên cửa hàng / Tiệm của bạn
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="ví dụ: Tiệm Phụ Kiện Lucas"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Email đăng nhập
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="cuahang@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Mật khẩu (tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pr-12"
                  placeholder="Mật khẩu..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[1.1rem] opacity-70 hover:opacity-100"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[0.8rem] text-[var(--color-text-secondary)] mb-1 font-semibold">
                Nhập lại mật khẩu
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-field"
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2.5 p-2 rounded-lg bg-[var(--color-dark-700)] cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={syncLocalData}
                onChange={e => setSyncLocalData(e.target.checked)}
                className="mt-1 w-4 h-4 accent-green-500 rounded"
              />
              <span className="text-[0.8rem] text-[var(--color-text-secondary)] leading-tight">
                Tự động đồng bộ các đơn hàng & sổ nợ hiện có trên máy này lên tài khoản mới
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-giant btn-sale mt-2 text-[1rem] py-3.5 font-extrabold text-slate-950"
            >
              {loading ? '⏳ Đang tạo tài khoản...' : '✨ TẠO TÀI KHOẢN & LƯU LÊN MẠNG'}
            </button>

            <div className="text-center text-[0.85rem] text-slate-200 mt-1">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-emerald-400 font-bold underline hover:opacity-80 ml-1"
              >
                Đăng nhập ngay
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: THÔNG TIN TÀI KHOẢN (Khi đã đăng nhập) */}
        {user && activeTab === 'profile' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-[var(--color-dark-700)] border border-[var(--color-dark-500)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-green-500)] text-slate-950 flex items-center justify-center font-extrabold text-[1.4rem]">
                  {(user.user_metadata?.shop_name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[1.05rem] text-white">
                    {user.user_metadata?.shop_name || 'Cửa hàng của tôi'}
                  </h3>
                  <p className="text-[0.85rem] text-[var(--color-text-secondary)]">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--color-dark-600)] flex items-center justify-between text-[0.82rem]">
                <span className="text-[var(--color-text-muted)]">Trạng thái dữ liệu:</span>
                <span className="text-[var(--color-green-400)] font-bold flex items-center gap-1">
                  🟢 Đã kết nối Cloud
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await uploadLocalDataToCloud();
                    showToast('☁️ Đã sao lưu dữ liệu lên đám mây!');
                  } catch (err) {
                    showToast('Lỗi sao lưu: ' + err.message, 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-white font-semibold text-[0.9rem] flex items-center justify-center gap-2 transition-colors"
              >
                ☁️ Sao lưu dữ liệu lên Cloud ngay
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await syncAllFromCloud();
                    showToast('🔄 Đã làm mới dữ liệu từ Cloud!');
                    onClose();
                  } catch (err) {
                    showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--color-dark-600)] hover:bg-[var(--color-dark-500)] text-white font-semibold text-[0.9rem] flex items-center justify-center gap-2 transition-colors"
              >
                🔄 Đồng bộ tải dữ liệu từ Cloud về máy
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-semibold text-[0.9rem] flex items-center justify-center gap-2 transition-colors mt-2"
              >
                🚪 Đăng xuất tài khoản
              </button>
            </div>
          </div>
        )}

        {/* Footer Link to Advanced Settings */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={() => setShowAdvancedSettings(true)}
            className="text-[0.82rem] text-yellow-300 hover:text-white underline font-bold inline-flex items-center gap-1.5"
          >
            <span>⚙️</span>
            <span>Cài đặt kết nối nâng cao (Kỹ thuật)</span>
          </button>
        </div>
      </div>
    </div>

    {showAdvancedSettings && (
      <AdvancedSettingsModal
        onClose={() => setShowAdvancedSettings(false)}
        showToast={showToast}
      />
    )}
  </>
);
}
