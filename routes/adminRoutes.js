// routes/adminRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { isAdminMiddleware } from "../middlewares/isAdminMiddleware.js";
import { client } from "../dbConfig.js";
import { ObjectId } from "mongodb";

const router = express.Router();
const Users = client.db("myEcommerce").collection("users");
const Products = client.db("myEcommerce").collection("products");

// get all users
router.get("/users", authMiddleware, isAdminMiddleware, async (req, res) => {
  const users = await Users.find({}, { projection: { password: 0 } }).toArray();
  res.json(users);
});

// block/unblock user
router.put("/user/:id/block", authMiddleware, isAdminMiddleware, async (req, res) => {
  const { block } = req.body; // true/false
  const id = req.params.id;
  const r = await Users.updateOne({ _id: new ObjectId(id) }, { $set: { blocked: !!block } });
  if (!r.matchedCount) return res.status(404).json({ message: "User not found" });
  // add notification
  await Users.updateOne({ _id: new ObjectId(id) }, { $push: { notifications: { text: block ? "Your account has been blocked" : "Your account has been unblocked", date: new Date() } } });
  res.json({ message: `User ${block ? "blocked" : "unblocked"}` });
});

// get all products
router.get("/products", authMiddleware, isAdminMiddleware, async (req, res) => {
  const products = await Products.find().sort({ createdAt: -1 }).toArray();
  res.json(products);
});

// block/unblock product
router.put("/product/:id/block", authMiddleware, isAdminMiddleware, async (req, res) => {
  const { block } = req.body;
  const id = req.params.id;
  const r = await Products.updateOne({ _id: new ObjectId(id) }, { $set: { blocked: !!block } });
  if (!r.matchedCount) return res.status(404).json({ message: "Product not found" });
  res.json({ message: `Product ${block ? "blocked" : "unblocked"}` });
});

export default router;
