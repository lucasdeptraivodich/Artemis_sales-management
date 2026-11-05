import React, { useState, useRef, useEffect } from 'react';
import OrderPreviewCard from './OrderPreviewCard';
import { processAgentMessage } from '../agent/aiAgentEngine';
import { ecommerceDb } from '../agent/ecommerceDb';

const QUICK_PROMPTS = [
  { label: '💸 Xóa hết nợ', prompt: 'Xóa hết nợ của tháng 11' },
  { label: '🗑️ Xóa đơn T11/2026', prompt: 'Xóa hàng loạt đơn của tháng 11/2026' },
  { label: '👥 Mở Sổ nợ', prompt: 'Mở sổ nợ' },
  { label: '📊 Mở Dòng tiền', prompt: 'Mở báo cáo dòng tiền' },
  { label: '🔍 Tra cứu ORD-1001', prompt: 'Tra cứu tình trạng đơn hàng ORD-1001' },
];

const VAULT_KEY = 'artemis_ai_key_vault_v2';
const LEGACY_KEY = 'artemis_ai_api_key';
const VAULT_SALT = 'ARTEMIS_SECURE_SALT_2026';

function encodeApiKey(rawKey) {
  if (!rawKey) return '';
  try {
    const trimmed = rawKey.trim();
    const xored = Array.from(trimmed)
      .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ VAULT_SALT.charCodeAt(i % VAULT_SALT.length)))
      .join('');
    return 'v2:' + btoa(unescape(encodeURIComponent(xored)));
  } catch (e) {
    return '';
  }
}

function decodeApiKey(stored) {
  if (!stored) return '';
  try {
    if (!stored.startsWith('v2:')) return stored;
    const raw = decodeURIComponent(escape(atob(stored.slice(3))));
    return Array.from(raw)
      .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ VAULT_SALT.charCodeAt(i % VAULT_SALT.length)))
      .join('');
  } catch (e) {
    return '';
  }
}

export default function AiChatWidget({ onRefresh, showToast, onUiAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      const vaulted = localStorage.getItem(VAULT_KEY);
      if (vaulted) return decodeApiKey(vaulted);
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        // Tự động chuyển sang vùng lưu trữ mã hóa và xóa bản chữ thuần cũ
        localStorage.setItem(VAULT_KEY, encodeApiKey(legacy));
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
      }
      return '';
    } catch (e) {
      return '';
    }
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      return localStorage.getItem('artemis_ai_model') || 'gemini-3.8-flash';
    } catch (e) {
      return 'gemini-3.8-flash';
    }
  });
  const [saveToast, setSaveToast] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [sessionState, setSessionState] = useState({ pendingActionId: null });
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Chào bạn! Em là Trợ lý AI Bán Hàng Artemis. Em có thể tra cứu đơn, tạo đơn mới hoặc sửa/hủy đơn. Bạn có thể chọn gợi ý bên dưới để thử nghiệm!',
      timestamp: new Date()
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    setInput('');
    const userMsgId = `user_${Date.now()}`;
    const newMessages = [...messages, { id: userMsgId, sender: 'user', text, timestamp: new Date() }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const responseData = await processAgentMessage({
        messages: apiMessages,
        sessionState,
        apiKey: apiKey.trim() || null,
        model: selectedModel
      });

      if (responseData.sessionState) {
        setSessionState(responseData.sessionState);
      }

      if (responseData.uiAction && onUiAction) {
        onUiAction(responseData.uiAction);
      }

      if (
        responseData.card?.type === 'ACTION_CONFIRMED_CARD' ||
        responseData.card?.type === 'WEB_ACTION_CARD'
      ) {
        if (onRefresh) onRefresh();
        if (showToast && responseData.card?.type === 'ACTION_CONFIRMED_CARD') {
          showToast(responseData.reply || '✅ Đã thực hiện thành công!');
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: responseData.reply,
          card: responseData.card || null,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, sender: 'assistant', text: `Lỗi: ${err.message}`, timestamp: new Date() }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCardConfirm = async (actionId) => {
    setIsProcessingAction(true);
    try {
      const commitRes = ecommerceDb.commitAction(actionId);
      const result = {
        success: true,
        message: commitRes.message,
        order: commitRes.order,
        actionType: commitRes.actionType
      };

      setSessionState((prev) => ({ ...prev, pendingActionId: null }));
      if (onRefresh) onRefresh();
      if (showToast) showToast(result.message || '✅ Đã thực hiện thành công!');

      setMessages((prev) => [
        ...prev,
        {
          id: `confirm_${Date.now()}`,
          sender: 'assistant',
          text: result.message,
          card: { type: 'ACTION_CONFIRMED_CARD', actionType: result.actionType, order: result.order },
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      alert(`Lỗi xác nhận: ${err.message}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCardCancel = (actionId) => {
    ecommerceDb.cancelPendingAction(actionId);
    setSessionState((prev) => ({ ...prev, pendingActionId: null }));
    setMessages((prev) => [
      ...prev,
      {
        id: `cancel_${Date.now()}`,
        sender: 'assistant',
        text: 'Em đã hủy bỏ thao tác dự thảo. Dữ liệu của bạn được giữ nguyên ạ.',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 select-none">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-full shadow-2xl transition-all cursor-pointer border border-emerald-400/40"
        >
          <span className="text-xl">🤖</span>
          <span className="text-sm font-semibold">Trợ lý AI</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
        </button>
      )}

      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[550px] max-h-[85vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Artemis AI Assistant
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </h3>
                <p className="text-[10px] text-slate-400">Function Calling & HITL Gateway</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                  showSettings ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
                title="Cấu hình API Key (Gemini / OpenAI)"
              >
                ⚙️
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Settings Drawer */}
          {showSettings && (
            <div className="p-3 bg-slate-950/95 border-b border-amber-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <span>⚙️</span> Cài đặt API Model
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Lấy key Gemini ↗
                </a>
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] text-slate-400">
                    Gemini / OpenAI API Key <span className="text-emerald-400">(🔒 Đã mã hóa Vault)</span>:
                  </label>
                  {apiKey && (
                    <button
                      onClick={() => {
                        setApiKey('');
                        localStorage.removeItem(VAULT_KEY);
                        localStorage.removeItem(LEGACY_KEY);
                      }}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      title="Xóa API Key khỏi trình duyệt"
                    >
                      🗑️ Xóa Key
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Dán AIzaSy... hoặc sk-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Model:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (Ultra / Mới nhất)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const trimmed = apiKey.trim();
                      if (trimmed) {
                        localStorage.setItem(VAULT_KEY, encodeApiKey(trimmed));
                      } else {
                        localStorage.removeItem(VAULT_KEY);
                      }
                      localStorage.removeItem(LEGACY_KEY);
                      localStorage.setItem('artemis_ai_model', selectedModel);
                      setSaveToast(true);
                      setTimeout(() => setSaveToast(false), 2000);
                      setShowSettings(false);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs cursor-pointer"
                  >
                    Lưu
                  </button>
                </div>
              </div>
              {saveToast && <p className="text-[10px] text-emerald-400">✅ Đã lưu cấu hình vào trình duyệt!</p>}
            </div>
          )}

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800 flex gap-1.5 overflow-x-auto">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp.prompt)}
                disabled={isTyping}
                className="whitespace-nowrap px-2.5 py-1 bg-slate-800 hover:bg-emerald-950 hover:border-emerald-500/40 border border-slate-700 rounded-full text-[11px] text-slate-300 hover:text-emerald-300 cursor-pointer disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs leading-relaxed">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[88%] p-3 rounded-2xl ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.card && (
                    <OrderPreviewCard
                      card={m.card}
                      onConfirm={handleCardConfirm}
                      onCancel={handleCardCancel}
                      isProcessing={isProcessingAction}
                    />
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 bg-slate-800 rounded-2xl w-16">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-slate-800/90 border-t border-slate-700/60 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập yêu cầu: tra cứu, đặt hàng, hủy đơn..."
              disabled={isTyping}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 cursor-pointer"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
