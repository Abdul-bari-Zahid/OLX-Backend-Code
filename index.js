import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { client } from "./dbConfig.js";
import authRoutes from "./routes/authRoutes.js";
import adminAuthRoutes from "./routes/adminauthrout.js";
import productRoutes from "./routes/productRoute.js";
import usersRoutes from "./routes/usersRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { Server } from 'socket.io';
import http from 'http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://olx-frontend-code.vercel.app/",
      "https://olx-admin-code.vercel.app/login"
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Socket auth middleware: verify JWT sent from client via `auth: { token }`
io.use((socket, next) => {
  try {
    const token = socket.handshake?.auth?.token || null;
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.id || decoded?.userId || decoded?.uid;
    if (userId) {
      // ensure userSockets map exists
      if (!io.userSockets) io.userSockets = new Map();
      io.userSockets.set(String(userId), socket.id);
      // attach to socket for easy cleanup later
      socket.userId = String(userId);
      console.log('Socket auth successful:', socket.id, '-> user', socket.userId);
    }
    return next();
  } catch (err) {
    console.warn('Socket auth failed:', err.message);
    return next();
  }
});

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://olx-frontend-code.vercel.app/",
    "https://olx-admin-code.vercel.app/login"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'localhost.'));
});

// ✅ Register all routes here
app.use("/api/auth", authRoutes);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api", usersRoutes);
app.use("/api", userRoutes);
app.use("/api", categoryRoutes);
app.use("/api", productRoutes);
app.use("/api", adminRoutes);
app.use("/api", messageRoutes);

// ✅ Root check
app.get("/api", (req, res) => res.send("✅ API running fine"));

// Debug: show user->socket mapping (only for non-production local debugging)
app.get('/api/debug/sockets', (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ message: 'Not found' });
  const map = io.userSockets || new Map();
  const arr = Array.from(map.entries());
  res.json({ sockets: arr });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🔌 New socket connection:", socket.id);

  // Map to store userId -> socketId could be shared across connections
  // We'll attach it to io instance for simplicity
  if (!io.userSockets) io.userSockets = new Map();

  // Client should identify after connecting
  socket.on('identify', (userId) => {
    try {
      if (userId) {
        const idKey = typeof userId === 'object' ? JSON.stringify(userId) : String(userId);
        io.userSockets.set(idKey, socket.id);
        console.log(`👤 Identified user ${idKey} -> socket ${socket.id}`);
        // announce to other clients that this user is online
        try {
          io.emit('user-online', { userId: idKey });
        } catch (err) {
          console.warn('emit user-online error', err);
        }
      }
    } catch (err) {
      console.error('identify error', err);
    }
  });

  // Check specific user status
  socket.on('check-status', (userId, callback) => {
    try {
      const idKey = typeof userId === 'object' ? JSON.stringify(userId) : String(userId);
      const isOnline = io.userSockets && io.userSockets.has(idKey);
      // Also check if we have them in the socket auth map (sometimes key format differs)
      // Iterate keys if not found (fallback)
      let found = isOnline;
      if (!found && io.userSockets) {
        for (const [k, v] of io.userSockets) {
          if (String(k).includes(String(userId)) || String(userId).includes(String(k))) {
            found = true;
            break;
          }
        }
      }

      console.log(`? Check status for ${userId} (${idKey}): ${found ? 'Online' : 'Offline'}`);
      if (typeof callback === 'function') callback({ userId: idKey, online: !!found });
    } catch (err) {
      console.error('check-status error', err);
      if (typeof callback === 'function') callback({ online: false });
    }
  });

  // Join product chat room
  socket.on("join-product-chat", (productId) => {
    const roomName = `product-${productId}`;
    socket.join(roomName);
    console.log(`👤 User joined room: ${roomName}`);
  });

  // Leave product chat room
  socket.on("leave-product-chat", (productId) => {
    const roomName = `product-${productId}`;
    socket.leave(roomName);
    console.log(`👤 User left room: ${roomName}`);
  });

  // Send product chat message (supports acknowledgement callback)
  socket.on("send-product-message", async (data, callback) => {
    try {
      const { productId, senderId, receiverId, senderName, text } = data;
      console.log('socket send-product-message received', { productId, senderId, receiverId, senderName, text });
      const roomName = `product-${productId}`;

      const message = {
        productId,
        senderId,
        receiverId,
        senderName,
        text,
        createdAt: new Date(),
        read: false,
        status: 'sent'
      };

      // Save to MongoDB
      const db = client.db('olx');
      const messagesCollection = db.collection('messages');
      const result = await messagesCollection.insertOne(message);

      // Emit to product room only
      io.to(roomName).emit("receive-product-message", {
        _id: result.insertedId,
        ...message
      });

      // Also notify the receiver directly (if connected) with a focused notification
      try {
        const receiverKey = typeof receiverId === 'object' ? JSON.stringify(receiverId) : String(receiverId);
        const receiverSocketId = io.userSockets.get(receiverKey);
        console.log('🔍 notify lookup:', { receiverKey, receiverSocketId, mapKeys: Array.from(io.userSockets?.keys() || []) });

        const notificationPayload = {
          productId,
          senderId,
          senderName,
          text,
          messageId: result.insertedId
        };

        if (receiverSocketId) {
          console.log('✅ Sending direct notification to receiver socket:', receiverSocketId);
          io.to(receiverSocketId).emit('new-message-notification', notificationPayload);
        } else {
          // Fallback 1: emit notification to the entire product room so any participant (seller) in that room gets notified
          console.log('⚠️ Receiver not in direct map, broadcasting to room:', roomName);
          io.to(roomName).emit('new-message-notification', notificationPayload);

          // Fallback 2: broadcast to ALL connected sockets (ensures seller gets it even if not in the product room)
          console.log('📢 Broadcasting new-message-notification to all connected sockets');
          io.emit('new-message-notification', notificationPayload);
        }
      } catch (err) {
        console.error('❌ notify receiver error', err);
      }

      console.log(`📨 Message in ${roomName}:`, text);
      // acknowledge to sender if callback provided
      try {
        if (typeof callback === 'function') callback({ success: true, messageId: result.insertedId });
      } catch (ackErr) {
        console.error('ack callback error', ackErr);
      }
    } catch (err) {
      console.error('Error sending product message:', err);
      socket.emit("message-error", { error: err.message });
      try {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      } catch (ackErr) {
        console.error('ack callback error on failure', ackErr);
      }
    }
  });

  // Typing indicator events
  socket.on('typing-start', (data) => {
    try {
      const { productId, senderId, receiverId } = data || {};
      const payload = { productId, senderId, isTyping: true };
      const receiverKey = typeof receiverId === 'object' ? JSON.stringify(receiverId) : String(receiverId);
      const receiverSocketId = io.userSockets.get(receiverKey);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing', payload);
      } else {
        // fallback: notify product room (except sender)
        const roomName = `product-${productId}`;
        socket.to(roomName).emit('typing', payload);
      }
    } catch (err) {
      console.error('typing-start error', err);
    }
  });

  socket.on('typing-stop', (data) => {
    try {
      const { productId, senderId, receiverId } = data || {};
      const payload = { productId, senderId, isTyping: false };
      const receiverKey = typeof receiverId === 'object' ? JSON.stringify(receiverId) : String(receiverId);
      const receiverSocketId = io.userSockets.get(receiverKey);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing', payload);
      } else {
        const roomName = `product-${productId}`;
        socket.to(roomName).emit('typing', payload);
      }
    } catch (err) {
      console.error('typing-stop error', err);
    }
  });

  // Message read receipts (forward to sender)
  socket.on('message-read', (data) => {
    try {
      const { productId, readerId, senderId, messageIds } = data || {};
      const senderKey = typeof senderId === 'object' ? JSON.stringify(senderId) : String(senderId);
      const senderSocketId = io.userSockets.get(senderKey);
      const payload = { productId, readerId, messageIds };
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-read', payload);
      } else {
        // fallback: broadcast to product room
        const roomName = `product-${productId}`;
        io.to(roomName).emit('message-read', payload);
      }
    } catch (err) {
      console.error('message-read handler error', err);
    }
  });

  // Message delivered receipts
  socket.on('message-delivered', async (data) => {
    try {
      const { productId, receiverId, senderId, messageIds } = data || {};
      // Update DB (optional here if API calls it, but good to have socket handler too if we want speed)
      // For now, we assume Frontend calls API to update DB, and this just forwards the event.
      // BUT, if we want real-time speed, we can forward immediately.

      const payload = { productId, receiverId, messageIds };
      const senderKey = typeof senderId === 'object' ? JSON.stringify(senderId) : String(senderId);
      const senderSocketId = io.userSockets.get(senderKey);

      if (senderSocketId) {
        io.to(senderSocketId).emit('message-delivered', payload);
      } else {
        const roomName = `product-${productId}`;
        io.to(roomName).emit('message-delivered', payload);
      }
    } catch (err) {
      console.error('message-delivered handler error', err);
    }
  });

  // Listen for messages from client
  socket.on("message", (data) => {
    console.log("📨 Message received:", data);
    // Broadcast to all connected clients
    io.emit("message", { from: socket.id, data });
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, "from user", socket.userId, "Reason:", reason);
    try {
      if (io.userSockets) {
        // If we attached userId to socket during auth, remove directly
        if (socket.userId) {
          const hadMapping = io.userSockets.has(socket.userId);
          io.userSockets.delete(socket.userId);
          console.log(`🔒 Removed mapping for user ${socket.userId}, had mapping: ${hadMapping}`);
          try {
            io.emit('user-offline', { userId: socket.userId });
          } catch (err) {
            console.warn('emit user-offline error', err);
          }
        }
        // Also clean up any entries that reference this socket id (fallback)
        for (const [userId, sId] of io.userSockets.entries()) {
          if (sId === socket.id) {
            io.userSockets.delete(userId);
            console.log(`🔒 Removed mapping for user ${userId} (by socket id)`);
          }
        }
      }
    } catch (err) {
      console.error('error cleaning up socket mapping', err);
    }
  });

  socket.on("error", (error) => {
    console.error("⚠️ Socket error:", error);
  });
});

const PORT = process.env.PORT || 3004;

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Connect to DB then start server
client.connect()
  .then(() => {
    console.log('✅ Connected to MongoDB');
    httpServer.listen(PORT, (err) => {
      if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
      }
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 Socket.IO ready for ${process.env.CLIENT_URL}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

