import { ORDER_TOOLS } from './schemas.js';
import { ecommerceDb } from './ecommerceDb.js';
import { SYSTEM_PROMPT, buildLiveStoreContext, simulateLlmToolCalling } from './intentMatcher.js';

export { ORDER_TOOLS, SYSTEM_PROMPT };

export async function executeToolCall(toolName, args) {
  switch (toolName) {
    case 'get_order_status': {
      const order = ecommerceDb.getOrderById(args.order_id);
      if (!order) {
        return {
          success: false,
          error: `Không tìm thấy đơn hàng "${args.order_id}". Vui lòng kiểm tra lại mã đơn.`
        };
      }
      return {
        success: true,
        order,
        cardType: 'ORDER_STATUS_CARD',
        message: `Đơn hàng ${order.order_id} của ${order.customer_name} hiện ở trạng thái "${order.status_label}".`
      };
    }

    case 'create_order': {
      const draftResult = ecommerceDb.stageOrderCreation(args);
      return {
        success: true,
        requiresConfirmation: true,
        actionId: draftResult.actionId,
        cardType: 'CREATE_ORDER_PREVIEW',
        preview: draftResult.preview,
        message: draftResult.prompt
      };
    }

    case 'update_order': {
      const draftResult = ecommerceDb.stageOrderUpdate(args);
      return {
        success: true,
        requiresConfirmation: true,
        actionId: draftResult.actionId,
        cardType: 'UPDATE_ORDER_PREVIEW',
        preview: draftResult.preview,
        diff: draftResult.diff,
        message: draftResult.prompt
      };
    }
    case 'cancel_bulk_orders': {
      const draftResult = ecommerceDb.stageBulkCancellation(args);
      return {
        success: true,
        requiresConfirmation: true,
        actionId: draftResult.actionId,
        cardType: 'BULK_CANCEL_PREVIEW',
        preview: draftResult,
        message: draftResult.prompt
      };
    }

    case 'clear_debts': {
      const draftResult = ecommerceDb.stageDebtClearance(args);
      return {
        success: true,
        requiresConfirmation: true,
        actionId: draftResult.actionId,
        cardType: 'CLEAR_DEBT_PREVIEW',
        preview: draftResult,
        message: draftResult.prompt
      };
    }

    case 'manage_web_store': {
      const res = ecommerceDb.executeOrStageWebAction(args);
      return {
        success: true,
        requiresConfirmation: Boolean(res.requiresConfirmation),
        cardType: res.cardType || 'WEB_ACTION_CARD',
        tx: res.tx || null,
        item: res.item || null,
        uiAction: res.uiAction || null,
        message: res.message
      };
    }

    default:
      throw new Error(`Tool "${toolName}" không được định nghĩa.`);
  }
}

function sanitizeSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);
  const copy = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue;
    copy[k] = sanitizeSchemaForGemini(v);
  }
  return copy;
}

/**
 * Hỗ trợ các Model Google Gemini chính thức kèm cơ chế Auto-Fallback thông minh
 */
function buildGeminiModelCandidates(requestedModel) {
  const candidates = [];
  if (requestedModel && !requestedModel.includes('3.8') && !requestedModel.includes('2.5')) {
    candidates.push(requestedModel);
  }
  for (const fallback of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
  }
  return candidates;
}

async function callGemini(messages, apiKey, modelName = 'gemini-2.0-flash') {
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const functionDeclarations = ORDER_TOOLS.map((t) => sanitizeSchemaForGemini(t.function));

  const fullSystemPrompt = SYSTEM_PROMPT + buildLiveStoreContext();
  const body = {
    systemInstruction: { parts: [{ text: fullSystemPrompt }] },
    contents,
    tools: [{ functionDeclarations }],
    generationConfig: { temperature: 0.2 }
  };

  const candidates = buildGeminiModelCandidates(modelName);

  for (const candidateModel of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) continue;
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const fnPart = parts.find((p) => p.functionCall);
      if (fnPart?.functionCall) {
        return {
          name: fnPart.functionCall.name,
          args: fnPart.functionCall.args || {},
          usedModel: candidateModel
        };
      }
      const textPart = parts.find((p) => p.text);
      if (textPart?.text) return { textOnly: textPart.text, usedModel: candidateModel };
    } catch (err) {
      console.warn(`Gemini (${candidateModel}) error:`, err.message);
    }
  }
  return null;
}

/**
 * Giải mã phản hồi từ OpenAI / 9Router / Groq (Hỗ trợ cả JSON chuẩn lẫn luồng SSE data: {...})
 */
function parseOpenAiPayload(rawText) {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return null;

  // 1. Trường hợp JSON tiêu chuẩn
  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed);
    const msg = data.choices?.[0]?.message;
    if (msg?.tool_calls?.length > 0) {
      const tc = msg.tool_calls[0];
      return {
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}')
      };
    }
    if (msg?.content) return { textOnly: msg.content };
    return null;
  }

  // 2. Trường hợp proxy trả về luồng SSE (data: {...})
  let accumulatedContent = '';
  let toolName = '';
  let toolArgsStr = '';

  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine.startsWith('data:')) continue;
    const payload = cleanLine.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta || choice?.message;
      if (!delta) continue;
      if (delta.content) {
        accumulatedContent += delta.content;
      }
      if (delta.tool_calls?.length > 0) {
        const tc = delta.tool_calls[0];
        if (tc.function?.name) toolName += tc.function.name;
        if (tc.function?.arguments) toolArgsStr += tc.function.arguments;
      }
    } catch (e) {
      // Bỏ qua dòng SSE không hợp lệ
    }
  }

  if (toolName) {
    try {
      return { name: toolName, args: JSON.parse(toolArgsStr || '{}') };
    } catch (e) {
      return { name: toolName, args: {} };
    }
  }
  if (accumulatedContent.trim()) {
    return { textOnly: accumulatedContent.trim() };
  }
  return null;
}

async function callOpenAi(messages, apiKey, baseUrl = null, modelName = 'gpt-4o-mini') {
  const endpoint = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';

  const isGroqEndpoint = endpoint.includes('api.groq.com');
  const modelCandidates = [];
  if (isGroqEndpoint) {
    if (modelName && (modelName.includes('llama') || modelName.includes('qwen') || modelName.includes('mixtral'))) {
      modelCandidates.push(modelName.replace(/^groq\//, ''));
    }
    for (const groqModel of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
      if (!modelCandidates.includes(groqModel)) modelCandidates.push(groqModel);
    }
  } else {
    // Nếu modelName là gemini-2.0-flash đã bị deprecated trên Google/9Router, bỏ qua hoặc đổi thành auto-code
    if (modelName && !modelName.includes('2.0') && !modelName.includes('2.5')) {
      modelCandidates.push(modelName);
    }
    if (baseUrl) {
      for (const fallback of [
        'auto-code',
        'ag/gemini-3.8-flash',
        'gemini/gemini-3.8-flash',
        'ds/deepseek-chat',
        'groq/llama-3.3-70b-versatile'
      ]) {
        if (!modelCandidates.includes(fallback)) modelCandidates.push(fallback);
      }
    } else if (!modelCandidates.includes('gpt-4o-mini')) {
      modelCandidates.push('gpt-4o-mini');
    }
  }

  const fullSystemPrompt = SYSTEM_PROMPT + buildLiveStoreContext();
  const envKey =
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_AI_API_KEY) ||
    (typeof process !== 'undefined' && process?.env?.VITE_AI_API_KEY) ||
    null;

  for (const candidateModel of modelCandidates) {
    try {
      let activeKey = apiKey || envKey || 'proxy-key';
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`
        },
        body: JSON.stringify({
          model: candidateModel,
          stream: false,
          messages: [{ role: 'system', content: fullSystemPrompt }, ...messages],
          tools: ORDER_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2
        })
      });

      // Nếu key truyền từ localStorage bị 401 và có key trong .env, tự động thử lại bằng envKey
      if (res.status === 401 && envKey && activeKey !== envKey) {
        activeKey = envKey;
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`
          },
          body: JSON.stringify({
            model: candidateModel,
            stream: false,
            messages: [{ role: 'system', content: fullSystemPrompt }, ...messages],
            tools: ORDER_TOOLS,
            tool_choice: 'auto',
            temperature: 0.2
          })
        });
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`OpenAI / Custom Base API error (${res.status} - ${candidateModel}):`, errText);
        if (res.status === 401 || res.status === 403) break;
        continue;
      }
      const rawText = await res.text();
      const parsed = parseOpenAiPayload(rawText);
      if (parsed) return parsed;
    } catch (err) {
      console.warn(`OpenAI / Custom Base API error (${candidateModel}):`, err.message);
      break;
    }
  }
  return null;
}

export async function processAgentMessage({ messages, sessionState = {}, apiKey = null, model = null, baseUrl = null }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Danh sách messages không hợp lệ.');
  }

  const lastUserMsg = messages[messages.length - 1];
  const userText = (lastUserMsg.content || '').trim();
  const lowerText = userText.toLowerCase();

  // 1. Human-in-the-loop: Kiểm tra xác nhận / hủy
  const isConfirm = ['xác nhận', 'xac nhan', 'đồng ý', 'dong y', 'ok', 'duyệt', 'confirm', 'chốt'].some(
    (kw) => lowerText === kw || lowerText.startsWith(kw + ' ') || lowerText.endsWith(' ' + kw)
  );

  const isCancelDraftOnly = [
    'hủy',
    'huy',
    'hủy bỏ',
    'huy bo',
    'không hủy',
    'khong huy',
    'hủy thao tác',
    'thôi',
    'không',
    'khong',
    'cancel'
  ].some((kw) => lowerText === kw);

  if (isConfirm && sessionState.pendingActionId) {
    try {
      const commitRes = ecommerceDb.commitAction(sessionState.pendingActionId);
      sessionState.pendingActionId = null;
      return {
        reply: commitRes.message,
        card: {
          type: 'ACTION_CONFIRMED_CARD',
          actionType: commitRes.actionType,
          order: commitRes.order
        },
        sessionState: { ...sessionState, pendingActionId: null }
      };
    } catch (err) {
      return {
        reply: `⚠️ Không thể thực thi: ${err.message}`,
        card: null,
        sessionState: { ...sessionState, pendingActionId: null }
      };
    }
  }

  if (isCancelDraftOnly && sessionState.pendingActionId) {
    ecommerceDb.cancelPendingAction(sessionState.pendingActionId);
    sessionState.pendingActionId = null;
    return {
      reply: 'Em đã hủy bỏ thao tác dự thảo. Dữ liệu đơn hàng của anh/chị vẫn được giữ nguyên ạ.',
      card: null,
      sessionState: { ...sessionState, pendingActionId: null }
    };
  }

  // 2. Tool Calling (Ưu tiên gọi LLM qua 9Router/OpenAI/Gemini nếu có cấu hình, fallback sang Deterministic Matcher)
  const localMatch = simulateLlmToolCalling(userText);
  let toolCall = null;

  // Nếu người dùng nhập một lệnh mới rõ ràng có gọi tool thì hủy pendingActionId cũ (nếu có)
  if (localMatch?.name && sessionState.pendingActionId) {
    ecommerceDb.cancelPendingAction(sessionState.pendingActionId);
    sessionState.pendingActionId = null;
  }

  // 2A. Tầng 1: Gọi qua Custom API Base URL (9Router trên máy bạn / Proxy nội bộ)
  const activeBaseUrl =
    baseUrl ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_AI_BASE_URL) ||
    (typeof process !== 'undefined' && process?.env?.VITE_AI_BASE_URL) ||
    null;

  const activeApiKey =
    apiKey ||
    (typeof import.meta !== 'undefined' && (import.meta?.env?.VITE_AI_API_KEY || import.meta?.env?.VITE_GROQ_API_KEY)) ||
    (typeof process !== 'undefined' && (process?.env?.VITE_AI_API_KEY || process?.env?.GROQ_API_KEY)) ||
    null;

  const activeModel =
    model && !model.includes('2.0') && !model.includes('2.5')
      ? model
      : (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GEMINI_MODEL) ||
        (typeof process !== 'undefined' && process?.env?.GEMINI_MODEL) ||
        (activeBaseUrl ? 'auto-code' : 'gemini-2.0-flash');

  if (activeBaseUrl) {
    const customRes = await callOpenAi(messages, activeApiKey, activeBaseUrl, activeModel);
    if (customRes?.name) {
      toolCall = customRes;
    } else if (customRes?.textOnly && !localMatch?.name) {
      return { reply: customRes.textOnly, card: null, sessionState };
    }
  }

  // 2B. Tầng 2A: Tự động chuyển sang Groq Cloud (Dành cho máy mẹ hoặc khi 9Router tắt)
  const groqKey =
    (apiKey?.startsWith('gsk_') ? apiKey : null) ||
    (typeof process !== 'undefined' && process?.env?.GROQ_API_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GROQ_API_KEY) ||
    null;

  if (!toolCall && groqKey) {
    const groqRes = await callOpenAi(messages, groqKey, 'https://api.groq.com/openai/v1', model);
    if (groqRes?.name) {
      toolCall = groqRes;
    } else if (groqRes?.textOnly && !localMatch?.name) {
      return { reply: groqRes.textOnly, card: null, sessionState };
    }
  }

  // 2C. Tầng 2B: Nếu có Gemini API Key trực tiếp
  const geminiKey =
    (apiKey?.startsWith('AIza') ? apiKey : null) ||
    (typeof process !== 'undefined' && (process?.env?.GEMINI_API_KEY || process?.env?.GOOGLE_API_KEY)) ||
    (typeof import.meta !== 'undefined' && (import.meta?.env?.VITE_GEMINI_API_KEY || import.meta?.env?.VITE_GOOGLE_API_KEY)) ||
    null;

  const geminiModel =
    model ||
    (typeof process !== 'undefined' && process?.env?.GEMINI_MODEL) ||
    (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GEMINI_MODEL) ||
    'gemini-2.0-flash';

  if (!toolCall && geminiKey && geminiKey.startsWith('AIza')) {
    const geminiRes = await callGemini(messages, geminiKey, geminiModel);
    if (geminiRes?.name) {
      toolCall = geminiRes;
    } else if (geminiRes?.textOnly && !localMatch?.name) {
      return { reply: geminiRes.textOnly, card: null, sessionState };
    }
  }

  // 2D. Tầng 2C: Nếu có OpenAI / OpenRouter API Key trực tiếp
  if (!toolCall && !baseUrl) {
    const openAiKey =
      apiKey ||
      (typeof process !== 'undefined' && process?.env?.OPENAI_API_KEY) ||
      (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_OPENAI_API_KEY) ||
      null;
    if (openAiKey && !openAiKey.startsWith('AIza') && !openAiKey.startsWith('gsk_')) {
      const targetBase = openAiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : null;
      const openAiRes = await callOpenAi(messages, openAiKey, targetBase, model);
      if (openAiRes?.name) {
        toolCall = openAiRes;
      } else if (openAiRes?.textOnly && !localMatch?.name) {
        return { reply: openAiRes.textOnly, card: null, sessionState };
      }
    }
  }

  // 2E. Tầng 3: Dự phòng ngầm thông minh (Offline / Deterministic Fallback)
  if (!toolCall) {
    toolCall = localMatch;
  }

  if (toolCall?.textOnly) {
    return { reply: toolCall.textOnly, card: null, actionRequired: false, sessionState };
  }

  // 3. Thực thi Tool
  if (toolCall) {
    try {
      const toolResult = await executeToolCall(toolCall.name, toolCall.args);
      if (toolResult.requiresConfirmation) {
        sessionState.pendingActionId = toolResult.actionId;
        return {
          reply: toolResult.message,
          card: {
            type: toolResult.cardType,
            actionId: toolResult.actionId,
            preview: toolResult.preview,
            diff: toolResult.diff || null
          },
          actionRequired: true,
          sessionState
        };
      }

      return {
        reply: toolResult.message,
        card: {
          type: toolResult.cardType,
          order: toolResult.order,
          tx: toolResult.tx || null,
          item: toolResult.item || null,
          uiAction: toolResult.uiAction || null
        },
        uiAction: toolResult.uiAction || null,
        actionRequired: false,
        sessionState
      };
    } catch (err) {
      return {
        reply: err.message,
        card: { type: 'ERROR_CARD', errorMessage: err.message },
        actionRequired: false,
        sessionState
      };
    }
  }

  return {
    reply:
      'Em chưa hiểu rõ câu lệnh này. Anh/chị có thể nhập mẫu như sau:\n' +
      '• Ghi bán hàng: "Ghi bán trang sức 6 triệu" hoặc "Đã bán 2 áo 300k"\n' +
      '• Ghi chi tiền: "Ghi chi tiền điện 500k"\n' +
      '• Quản lý nợ: "Xóa hết nợ tháng 11", "Mở sổ nợ"\n' +
      '• Điều hướng: "Mở dòng tiền", "Xem báo cáo"\n' +
      '(💡 Mẹo: Bấm biểu tượng bánh răng ⚙️ góc trên để cài đặt API Key nếu muốn trò chuyện tự nhiên hơn nhé!)',
    card: null,
    actionRequired: false,
    sessionState
  };
}
