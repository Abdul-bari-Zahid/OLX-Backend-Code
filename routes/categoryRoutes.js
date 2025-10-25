

import express from "express";
import { client } from "../dbConfig.js";
import { authMiddleware, isAdminMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();
const Categories = client.db("myEcommerce").collection("categories");

// ✅ Get all categories (public)
router.get("/categories", async (req, res) => {
  try {
    const cats = await Categories.find().sort({ createdAt: -1 }).toArray();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: "Error fetching categories", error: err.message });
  }
});

// ✅ Add new category (admin only)
router.post("/categories", authMiddleware, isAdminMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required" });

    // prevent duplicates
    const exist = await Categories.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (exist) return res.status(400).json({ message: "Category already exists" });

    const result = await Categories.insertOne({
      name: name.trim(),
      createdAt: new Date(),
    });
    res.json({ message: "Category added successfully", data: result });
  } catch (err) {
    res.status(500).json({ message: "Error adding category", error: err.message });
  }
});

// ✅ Delete a category (admin only)
router.delete("/categories/:id", authMiddleware, isAdminMiddleware, async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId(req.params.id);
    const result = await Categories.deleteOne({ _id: id });
    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Category not found" });

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting category", error: err.message });
  }
});

export default router;
