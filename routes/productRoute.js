


import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { client } from "../dbConfig.js";
import { ObjectId } from "mongodb";

const router = express.Router();
const db = client.db("myEcommerce");
const Products = db.collection("products");
const Users = db.collection("users");



// Add new product
router.post("/user/product", authMiddleware, async (req, res) => {
  try {
    const { title, description, price, category, location, condition } = req.body;
    if (!title || !description || !price)
      return res.status(400).json({ message: "All fields are required" });

    const product = {
      title,
      description,
      price: Number(price),
      category: category || "Uncategorized",
      location: location || "",
      condition: condition || "new",
      images: req.body.images || [],
      userId: req.user.id,
      blocked: false,
      createdAt: new Date(),
    };

    const result = await Products.insertOne(product);
    res.json({ message: "✅ Product added successfully", data: result });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ message: "Error adding product", error: err.message });
  }
});

//  Get all public (unblocked) products with optional pagination & category
// Query params:
// - page (1-based)
// - limit (items per page)
// - category (category slug or name)
router.get("/user/products", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, parseInt(req.query.limit || '0')) || 0; // 0 means no limit
    const category = req.query.category;

    const filter = { blocked: { $ne: true } };
    if (category) {
      // category may be sent as slug (kebab-case) or plain name; match case-insensitive
      const normalized = category.replace(/-/g, ' ');
      filter.category = { $regex: `^${normalized}$`, $options: 'i' };
    }

    const total = await Products.countDocuments(filter);

    let cursor = Products.find(filter).sort({ createdAt: -1 });
    if (limit > 0) {
      const skip = (page - 1) * limit;
      cursor = cursor.skip(skip).limit(limit);
    }

    const products = await cursor.toArray();

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

    res.json({ products, total, page, totalPages });
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});




router.get("/products/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId(req.params.id);

    const product = await Products.findOne({ _id: id });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: "Error fetching product" });
  }
});



//  Get specific product (public)
router.get("/pb/user/product/:id", async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const product = await Products.findOne({ _id: id });

    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.blocked)
      return res.status(403).json({ message: "This product is blocked by admin" });

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: "Error fetching product", error: err.message });
  }
});

// ✅ Get products of logged-in user (for Profile page)
router.get("/user/my-products/:userId", authMiddleware, async (req, res) => {
  try {
    let userId = req.params.userId;
    if (userId === "me") userId = req.user.id;

    const products = await Products.find({ userId }).sort({ createdAt: -1 }).toArray();
    res.json({ products });
  } catch (err) {
    console.error("Fetch my products error:", err);
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});

// ADMIN ``ROUTES BELOW

// ✅ Get all products with uploader info
router.get("/admin/products", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only" });

    const products = await Products.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          price: 1,
          category: 1,
          blocked: 1,
          images: 1,
          createdAt: 1,
          userId: 1,
          userName: "$userDetails.name",
          userEmail: "$userDetails.email",
        },
      },
    ])
      .sort({ createdAt: -1 })
      .toArray();

    res.json(products);
  } catch (err) {
    console.error("Admin products error:", err);
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
});

// ✅ Block / Unblock product
router.put("/admin/product/:id/block", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only" });

    const id = new ObjectId(req.params.id);
    const { block } = req.body;

    const result = await Products.updateOne(
      { _id: id },
      { $set: { blocked: !!block } }
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ message: "Product not found" });

    res.json({ message: block ? "Product blocked" : "Product unblocked" });
  } catch (err) {
    console.error("Block error:", err);
    res.status(500).json({ message: "Error updating product", error: err.message });
  }
});

// ✅ Get single product (for edit or view)
router.get("/admin/product/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admins only" });

    const id = new ObjectId(req.params.id);
    const product = await Products.findOne({ _id: id });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ message: "Error fetching product", error: err.message });
  }
});

export default router;
