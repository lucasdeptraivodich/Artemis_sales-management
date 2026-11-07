/**
 * ============================================================================
 * ARTEMIS E-COMMERCE AI AGENT BACKEND SERVER (Node.js / Express)
 * ============================================================================
 * Endpoints:
 * - POST /api/agent/chat: Tiếp nhận tin nhắn chat, phân tích Function Calling & Human-in-the-loop
 * - POST /api/agent/confirm: Endpoint xác nhận nhanh (1-Click button confirm từ UI card)
 * - GET  /api/agent/orders: Lấy danh sách đơn hàng
 * - GET  /api/agent/products: Lấy danh mục sản phẩm
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { processAgentMessage } from '../src/agent/aiAgentEngine.js';
import { ecommerceDb } from '../src/agent/ecommerceDb.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Whitelist Protection
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin ${origin} is not allowed.`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));

// Lightweight in-memory Sliding Window Rate Limiter
function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 30, message = 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }) {
  const requests = new Map();

  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) requests.delete(key);
      else requests.set(key, valid);
    }
  }, 5 * 60 * 1000);
  interval.unref?.();

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'client';
    const now = Date.now();
    const timestamps = requests.get(key) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil((recentTimestamps[0] + windowMs - now) / 1000)
      });
    }

    recentTimestamps.push(now);
    requests.set(key, recentTimestamps);
    next();
  };
}

const chatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Bạn đã gửi quá nhiều yêu cầu AI trong thời gian ngắn. Vui lòng chờ 1 phút trước khi thử lại.'
});

// Supabase Auth Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Middleware kiểm tra Authorization (Hỗ trợ JWT Supabase & Bảo vệ PII)
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (supabaseClient && token) {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized: Token xác thực không hợp lệ hoặc đã hết hạn.' });
      }
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role || 'authenticated'
      };
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Lỗi xác thực token.', details: err.message });
    }
  }

  // Nếu chạy trong production mà không có token: chặn truy cập
  if (process.env.NODE_ENV === 'production') {
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Thiếu Bearer Token xác thực.' });
    }
  }

  // Môi trường Dev/Test nội bộ: Cung cấp fallback an toàn
  req.user = {
    id: req.headers['x-user-id'] || 'dev_guest_user',
    role: 'customer'
  };
  next();
}

/**
 * POST /api/agent/chat
 * Luồng: Nhận chat -> Phân tích Intent/Tool Call -> Kiểm tra Nghiệp vụ & HITL -> Phản hồi
 */
app.post('/api/agent/chat', chatRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { messages, sessionState, apiKey, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Body phải chứa mảng "messages".' });
    }

    if (messages.length > 50) {
      return res.status(400).json({ error: 'Số lượng tin nhắn vượt quá giới hạn cho phép (tối đa 50).' });
    }

    for (const msg of messages) {
      if (typeof msg?.content === 'string' && msg.content.length > 10000) {
        return res.status(400).json({ error: 'Nội dung tin nhắn vượt quá 10,000 ký tự.' });
      }
    }

    const response = await processAgentMessage({
      messages,
      sessionState: sessionState || {},
      apiKey: apiKey || null,
      model: model || null
    });

    return res.json(response);
  } catch (error) {
    console.error('Lỗi xử lý AI Agent Chat:', error);
    return res.status(500).json({
      error: 'Lỗi máy chủ nội bộ khi xử lý hội thoại AI.',
      details: error.message
    });
  }
});

/**
 * POST /api/agent/confirm
 * Human-in-the-loop: Tiếp nhận nút bấm "Xác nhận" hoặc "Hủy bỏ" từ Preview Card
 */
app.post('/api/agent/confirm', chatRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { actionId, approved } = req.body;

    if (!actionId) {
      return res.status(400).json({ error: 'Thiếu actionId để thực thi xác nhận.' });
    }

    if (approved) {
      const commitResult = ecommerceDb.commitAction(actionId);
      return res.json({
        success: true,
        message: commitResult.message,
        order: commitResult.order,
        actionType: commitResult.actionType
      });
    } else {
      const cancelResult = ecommerceDb.cancelPendingAction(actionId);
      return res.json({
        success: true,
        message: cancelResult.message
      });
    }
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/orders
 * Tra cứu danh sách đơn hàng (Bảo vệ thông tin cá nhân khách hàng bằng authMiddleware)
 */
app.get('/api/agent/orders', authMiddleware, (req, res) => {
  res.json({
    orders: ecommerceDb.getAllOrders()
  });
});

/**
 * GET /api/agent/products
 * Tra cứu danh mục sản phẩm mẫu
 */
app.get('/api/agent/products', (req, res) => {
  res.json({
    products: ecommerceDb.getAllProducts()
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Artemis AI Agent Server is running at http://localhost:${PORT}`);
  });
}

export default app;
