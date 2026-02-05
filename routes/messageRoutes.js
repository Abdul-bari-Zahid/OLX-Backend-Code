import express from 'express';
import { client } from '../dbConfig.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();
const db = client.db('olx');
const messagesCollection = db.collection('messages');

// Get conversations for the authenticated user
router.get('/messages/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Aggregate latest message per (productId, otherUser)
    const pipeline = [
      { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          productId: 1,
          senderId: 1,
          receiverId: 1,
          text: 1,
          createdAt: 1,
          read: 1,
          status: 1,
          otherUserId: {
            $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"]
          }
        }
      },
      {
        $group: {
          _id: { productId: "$productId", otherUserId: "$otherUserId" },
          lastMessage: { $first: "$text" },
          lastMessageObj: { $first: "$$ROOT" },
          unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ["$receiverId", userId] }, { $eq: ["$read", false] }] }, 1, 0] } }
        }
      },
      {
        $project: {
          productId: '$_id.productId',
          otherUserId: '$_id.otherUserId',
          lastMessageObj: 1,
          unreadCount: 1
        }
      },
      { $sort: { 'lastMessageObj.createdAt': -1 } }
    ];

    const results = await messagesCollection.aggregate(pipeline).toArray();

    res.json({ success: true, conversations: results });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, message: 'Error fetching conversations' });
  }
});

// Get all messages for a specific product
router.get('/messages/product/:productId', authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const messages = await messagesCollection
      .find({ productId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

// Get conversation between two users for a product
router.get('/messages/product/:productId/user/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { productId, otherUserId } = req.params;
    const userId = req.user.id; // from authMiddleware

    const messages = await messagesCollection
      .find({
        productId,
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ success: false, message: 'Error fetching conversation' });
  }
});

// Save a message to MongoDB (fallback if socket fails)
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { productId, receiverId, text } = req.body;
    const senderId = req.user.id;

    const message = {
      productId,
      senderId,
      receiverId,
      text,
      createdAt: new Date(),
      read: false,
      status: 'sent' // sent, delivered, read
    };

    const result = await messagesCollection.insertOne(message);
    res.json({ success: true, message: { _id: result.insertedId, ...message } });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ success: false, message: 'Error saving message' });
  }
});

// Mark messages as delivered (when recipient receives them via socket or loads them)
router.post('/messages/mark-delivered', authMiddleware, async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user.id; // The user who received the messages

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'messageIds array required' });
    }

    // Convert string IDs to ObjectId if needed, but here we assume strict string matching or handling by driver if using ObjectIds.
    // However, the current code seems to use strings or auto-handling. Let's assume we can map if they are ObjectIds.
    // SAFETY: If _id is ObjectId, we might need to transform. 
    // Checking previous code: `createdAt: new Date(), read: false`. No explicit ObjectId import shown in file, 
    // but usually Mongo driver handles it. If _id is stored as ObjectId, we need to convert.
    // Let's rely on the fact that `messageIds` passed from frontend might be strings.
    // We update messages where `receiverId` is current user AND `_id` is in `messageIds`.

    // IMPORT ObjectId if not present? 
    // The file imports `client` from dbConfig. We might need ObjectId from mongodb.
    // Let's assume messageIds are strings and we need to match them.
    // If IDs are stored as ObjectIds in DB, we need to convert.
    // I will try to import ObjectId just in case, but since I can't easily see if they are ObjectIds, 
    // I will use a filter that works for both if I can, OR just assume standard Mongo ID.

    // For now, simple update:
    // We'll trust the driver or assume string IDs if that's what the app uses. 
    // Actually, `messagesCollection.insertOne` generates ObjectId.

    // Let's add ObjectId import to the top if possible, but I am editing a chunk. 
    // I will assume `mongodb` package is available.

    const { ObjectId } = await import('mongodb'); // Dynamic import to be safe or just use if available.

    const objectIds = messageIds.map(id => {
      try { return new ObjectId(id); } catch (e) { return id; }
    });

    const filter = {
      _id: { $in: objectIds },
      receiverId: userId,
      status: 'sent' // only update if currently sent
    };

    const update = { $set: { status: 'delivered', deliveredAt: new Date() } };

    const result = await messagesCollection.updateMany(filter, update);

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error marking messages delivered:', err);
    res.status(500).json({ success: false, message: 'Error marking messages delivered' });
  }
});

// Mark messages as read for a conversation (product + otherUser)
router.post('/messages/mark-read', authMiddleware, async (req, res) => {
  try {
    const { productId, otherUserId } = req.body;
    const userId = req.user.id;

    if (!productId || !otherUserId) return res.status(400).json({ success: false, message: 'productId and otherUserId required' });

    const filter = {
      productId,
      senderId: otherUserId,
      receiverId: userId,
      read: { $ne: true }
    };

    const update = { $set: { read: true, status: 'read', readAt: new Date() } };

    const result = await messagesCollection.updateMany(filter, update);

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Error marking messages read:', err);
    res.status(500).json({ success: false, message: 'Error marking messages read' });
  }
});

export default router;
