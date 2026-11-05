import { useState, useCallback, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import History from './components/History';
import DebtBook from './components/DebtBook';
import CodManager from './components/CodManager';
import SaleForm from './components/SaleForm';
import ExpenseForm from './components/ExpenseForm';
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import CashFlowModal from './components/CashFlowModal';
import ItemManagerModal from './components/ItemManagerModal';
import BackupModal from './components/BackupModal';
import CustomerModal from './components/CustomerModal';
import ReportExportModal from './components/ReportExportModal';
import AdvancedSettingsModal from './components/AdvancedSettingsModal';
import AiChatWidget from './components/AiChatWidget';

import { getCurrentUser, onAuthStateChange } from './supabase';
import { setCurrentUser, syncAllFromCloud, initAppDatabase } from './store';

const TABS = [
  { id: 'home', label: 'Trang chủ', icon: '🏠' },
  { id: 'history', label: 'Lịch sử đơn', icon: '📋' },
  { id: 'debt', label: 'Sổ nợ', icon: '👥' },
  { id: 'cod', label: 'Đơn Ship', icon: '📦' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showItemManager, setShowItemManager] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [customerModalState, setCustomerModalState] = useState({ open: false, customer: null });

  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Initialize Persistent Database (IndexedDB) and Supabase Session
  useEffect(() => {
    // 1. Khởi tạo IndexedDB
    initAppDatabase().then(() => {
      refresh();
    });

    // 2. Lấy session người dùng hiện tại
    getCurrentUser().then((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setCurrentUser(currentUser);
        syncAllFromCloud().then(() => refresh());
      }
    });

    const subscription = onAuthStateChange((event, session) => {
      const authUser = session?.user || null;
      setUser(authUser);
      setCurrentUser(authUser);
      if (authUser) {
        syncAllFromCloud().then(() => refresh());
      } else {
        refresh();
      }
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, [refresh]);

  const handleSaleComplete = () => {
    setShowSaleForm(false);
    showToast('✅ Đã ghi đơn bán hàng!');
    refresh();
  };

  const handleExpenseComplete = () => {
    setShowExpenseForm(false);
    showToast('✅ Đã ghi chi tiền!');
    refresh();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Dashboard
            key={refreshKey}
            user={user}
            onOpenAuth={() => setShowAuthModal(true)}
            onSale={() => setShowSaleForm(true)}
            onExpense={() => setShowExpenseForm(true)}
            onRefresh={refresh}
            onOpenCashFlow={() => setShowCashFlowModal(true)}
            onOpenReport={() => setShowReportModal(true)}
            onOpenItemManager={() => setShowItemManager(true)}
            onOpenBackup={() => setShowBackupModal(true)}
          />
        );
      case 'history':
        return (
          <History
            key={refreshKey}
            onRefresh={refresh}
            showToast={showToast}
            onEdit={(tx) => setEditingTransaction(tx)}
            onOpenReport={() => setShowReportModal(true)}
          />
        );
      case 'debt':
        return (
          <DebtBook
            key={refreshKey}
            onRefresh={refresh}
            showToast={showToast}
            onAddCustomer={() => setCustomerModalState({ open: true, customer: null })}
            onEditCustomer={(customer) => setCustomerModalState({ open: true, customer })}
          />
        );
      case 'cod':
        return (
          <CodManager
            key={refreshKey}
            onRefresh={refresh}
            showToast={showToast}
            onEditOrder={(order) => setEditingTransaction(order)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Top Banner for non-home tabs if user is not logged in */}
      {!user && activeTab !== 'home' && (
        <div
          onClick={() => setShowAuthModal(true)}
          className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-1.5 text-center text-[0.78rem] text-amber-200 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>⚠️</span>
          <span>Chưa đăng nhập! Nhấn vào đây để lưu dữ liệu lên đám mây tránh thất lạc.</span>
        </div>
      )}

      {/* Page Content */}
      {renderContent()}

      {/* Sale Form Modal (Create) */}
      {showSaleForm && (
        <SaleForm
          onClose={() => setShowSaleForm(false)}
          onComplete={handleSaleComplete}
        />
      )}

      {/* Sale Form Modal (Edit existing order) */}
      {editingTransaction && (
        <SaleForm
          initialData={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onComplete={() => {
            setEditingTransaction(null);
            showToast('✅ Đã cập nhật đơn hàng!');
            refresh();
          }}
        />
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseForm
          onClose={() => setShowExpenseForm(false)}
          onComplete={handleExpenseComplete}
        />
      )}

      {/* Cash Flow Report Modal */}
      {showCashFlowModal && (
        <CashFlowModal
          onClose={() => setShowCashFlowModal(false)}
          showToast={showToast}
        />
      )}

      {/* Product Catalog Items Manager Modal */}
      {showItemManager && (
        <ItemManagerModal
          onClose={() => setShowItemManager(false)}
          onItemsChanged={refresh}
          showToast={showToast}
        />
      )}

      {/* Backup & Restore & Excel Export Modal */}
      {showBackupModal && (
        <BackupModal
          onClose={() => setShowBackupModal(false)}
          onRestoreSuccess={refresh}
          showToast={showToast}
        />
      )}

      {/* Customer Add / Edit Modal */}
      {customerModalState.open && (
        <CustomerModal
          customer={customerModalState.customer}
          onClose={() => setCustomerModalState({ open: false, customer: null })}
          onSaved={refresh}
          showToast={showToast}
        />
      )}

      {/* Revenue Report (Excel & Zalo) Modal */}
      {showReportModal && (
        <ReportExportModal
          user={user}
          onClose={() => setShowReportModal(false)}
          showToast={showToast}
        />
      )}

      {/* Advanced Technical Settings Modal */}
      {showAdvancedSettings && (
        <AdvancedSettingsModal
          onClose={() => setShowAdvancedSettings(false)}
          showToast={showToast}
        />
      )}

      {/* Auth & Database Modal */}
      {showAuthModal && (
        <AuthModal
          user={user}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={(newUser) => {
            setUser(newUser);
            setCurrentUser(newUser);
            refresh();
          }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="flex max-w-[480px] mx-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          {/* Quick Account Tab */}
          <button
            className={`bottom-nav-item ${showAuthModal ? 'active' : ''}`}
            onClick={() => setShowAuthModal(true)}
            title={user ? 'Tài khoản' : 'Đăng nhập'}
          >
            <span className="icon">{user ? '👤' : '🔐'}</span>
            <span>{user ? 'Tài khoản' : 'Đăng nhập'}</span>
          </button>
        </div>
      </nav>
      {/* AI Agent Chat Widget (Function Calling & Human-In-The-Loop) */}
      <AiChatWidget
        onRefresh={refresh}
        showToast={showToast}
        onUiAction={(action) => {
          const target = action?.target;
          if (!target) return;
          if (['home', 'history', 'debt', 'cod'].includes(target)) {
            setActiveTab(target);
          } else if (target === 'cashflow') {
            setShowCashFlowModal(true);
          } else if (target === 'report') {
            setShowReportModal(true);
          } else if (target === 'items') {
            setShowItemManager(true);
          } else if (target === 'backup') {
            setShowBackupModal(true);
          } else if (target === 'sale_form') {
            setShowSaleForm(true);
          } else if (target === 'expense_form') {
            setShowExpenseForm(true);
          }
        }}
      />

    </div>
  );
}
