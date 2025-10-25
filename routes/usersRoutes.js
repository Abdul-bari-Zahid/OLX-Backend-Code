

import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdminMiddleware } from "../middlewares/isAdminMiddleware.js";
import { client } from "../dbConfig.js";
import { ObjectId } from "mongodb";

const router = express.Router();
const Users = client.db("myEcommerce").collection("users");

// ✅ Get all users (admin only)
router.get("/admin/users", authMiddleware, isAdminMiddleware, async (req, res) => {
  try {
    const users = await Users.find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json(users);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: err.message });
  }
});

// ✅ Get single logged-in user (for profile page)
router.get("/user/me", authMiddleware, async (req, res) => {
  try {
    const user = await Users.findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user", error: err.message });
  }
});

// ✅ Block / Unblock user (admin only)
router.put("/admin/user/:id/block", authMiddleware, isAdminMiddleware, async (req, res) => {
  try {
    const { block } = req.body;
    const userId = req.params.id;
    await Users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { blocked: !!block } }
    );
    res.json({ message: block ? "User blocked" : "User unblocked" });
  } catch (err) {
    res.status(500).json({ message: "Error updating user", error: err.message });
  }
});

export default router;
