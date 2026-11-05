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
import { processAgentMessage } from '../src/agent/aiAgentEngine.js';
import { ecommerceDb } from '../src/agent/ecommerceDb.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock Middleware kiểm tra Authorization
function authMiddleware(req, res, next) {
  // Trong môi trường production, verify Bearer JWT token ở đây:
  // const token = req.headers.authorization?.split(' ')[1];
  // if (!token) return res.status(401).json({ error: 'Unauthorized: Thiếu token xác thực.' });
  req.user = {
    id: req.headers['x-user-id'] || 'guest_user_1',
    role: 'customer'
  };
  next();
}

/**
 * POST /api/agent/chat
 * Luồng: Nhận chat -> Phân tích Intent/Tool Call -> Kiểm tra Nghiệp vụ & HITL -> Phản hồi
 */
app.post('/api/agent/chat', authMiddleware, async (req, res) => {
  try {
    const { messages, sessionState, apiKey, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Body phải chứa mảng "messages".' });
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
app.post('/api/agent/confirm', authMiddleware, async (req, res) => {
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
 * Tra cứu danh sách đơn hàng mẫu
 */
app.get('/api/agent/orders', (req, res) => {
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
