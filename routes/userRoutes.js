import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { client } from "../dbConfig.js";
import { ObjectId } from "mongodb";
import { upload } from "../middlewares/uploadMiddleware.js";
import fs from "fs";
import path from "path";
import { title } from "process";

const router = express.Router();
const myDB = client.db("myEcommerce");
const Products = myDB.collection("products");

// helper to normalize user id to string
function normalizeUserId(val) {
  if (!val && val !== 0) return null;
  try {
    // if it's an object (like ObjectId) with toString, call it
    if (typeof val === "object" && typeof val.toString === "function") return val.toString();
    return String(val);
  } catch (e) {
    return String(val);
  }
}

/** Create product with single image (field name: image) */
router.post("/user/product", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const providedUserId = req.body.userId || (req.user && (req.user.id || req.user._id));
    const product = {
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date(),
      userId: normalizeUserId(providedUserId) // store as string for consistent queries
    };

    const response = await Products.insertOne(product);
    return res.json({ message: "Product added successfully", data: response });
  } catch (error) {
    return res.status(500).json({ error: "Error adding product", details: error.message });
  }
});

//Multiple images add product
// router.post(
//   "/user/product-multi",
//   authMiddleware,
//   upload.array("images", 5),
//   async (req, res) => {
//     try {
//       const providedUserId = req.body.userId || (req.user && (req.user.id || req.user._id));
//       // const product = {
//       //   title: req.body.title,
//       //   description: req.body.description,
//       //   price: Number(req.body.price),
//       //   //  Correct image paths
//       //   images: (req.files || []).map((f) => `uploads/${f.filename}`),
//       //   createdAt: new Date(),
//       //   userId: normalizeUserId(providedUserId),
//       // };

//       const product = {
//       title: req.body.title,
//       description: req.body.description,
//       price: Number(req.body.price),
//       category: req.body.category,
//       location: req.body.location,
//       condition: req.body.condition,
//       images: (req.files || []).map(f => `/uploads/${f.filename}`),
//       createdAt: new Date(),
//       userId: String(req.body.userId || (req.user && req.user._id))
//     };
//      if (
//         !req.body.title?.trim() ||
//         !req.body.description?.trim() ||
//         !req.body.category?.trim() ||
//         !req.body.location?.trim() ||
//         !req.body.condition?.trim() ||
//         !req.body.price 
//       ) {
//         return res.status(400).json({ message: "Please fill all required fields" });
//       }

//  if (!product.title && !product.description && !product.price && !product.location && !product.condition && !product.category && !product.images) {
//       return res.status(400).json({ message: "Please fill all required fields" });
//     }
//      const titleOk = typeof product.title === 'string' && product.title.trim().length > 0;
//     const descOk = typeof product.description === 'string' && product.description.trim().length > 0;
//     const categoryOk = typeof product.category === 'string' && product.category.trim().length > 0;
//     const locationOk = typeof product.location === 'string' && product.location.trim().length > 0;
//     const conditionOk = typeof product.condition === 'string' && product.condition.trim().length > 0;
//     const priceOk = typeof product.price === 'number' && isFinite(product.price) && product.price > 0;
//     const imagesOk = Array.isArray(product.images) && product.images.length > 0;

//     if (!(titleOk && descOk && categoryOk && locationOk && conditionOk && priceOk && imagesOk)) {
//       return res.status(400).json({ message: "Please fill all required fields" });
//     }
//       const response = await Products.insertOne(product);
//       return res.json({
//         message: "✅ Product added successfully",
//         data: response,
//         product,
//       });
//     } catch (err) {
//       console.error("Add Product Error:", err.message);
//       res.status(500).json({
//         error: "Error adding product",
//         details: err.message,
//       });
//     }
//   }
// );








router.post(
  "/user/product-multi",
  authMiddleware,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const providedUserId = req.body.userId || (req.user && (req.user.id || req.user._id));

      // 🧠 Validate required fields first
      if (
        !req.body.title?.trim() ||
        !req.body.description?.trim() ||
        !req.body.category?.trim() ||
        !req.body.location?.trim() ||
        !req.body.condition?.trim() ||
        !req.body.price 
      ) {
        return res.status(400).json({ message: "Please fill all required fields" });
      }

      const product = {
        title: req.body.title,
        description: req.body.description,
        price: Number(req.body.price),
        category: req.body.category,
        location: req.body.location,
        condition: req.body.condition,
        images: (req.files || []).map(f => `uploads/${f.filename}`),
        createdAt: new Date(),
        userId: String(providedUserId),
      };

      const response = await Products.insertOne(product);
      return res.json({
        message: "✅ Product added successfully",
        data: response,
        product,
      });
    } catch (err) {
      console.error("Add Product Error:", err.message);
      res.status(500).json({
        error: "Error adding product",
        details: err.message,
      });
    }
  }
);


// Ye route alag hona chahiye, upar ke andar nahi
router.get("/user/my-products/:userId", authMiddleware, async (req, res) => {
  try {
    // allow passing 'me' or an id; normalize to string
    let userId = req.params.userId;
    if (userId === "me" && req.user) {
      userId = req.user.id || req.user._id;
    }
    userId = normalizeUserId(userId);

    // build filter to match either string userId or ObjectId userId for backward compatibility
    let filter = {};
    if (userId) {
      try {
        const oid = new ObjectId(userId);
        filter = { $or: [{ userId }, { userId: oid }] };
      } catch (err) {
        // not a valid ObjectId, search by string only
        filter = { userId };
      }
    }

    const products = await Products.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ products });
  } catch (e) {
    res.status(500).json({ message: "Error fetching products", error: e.message });
  }
});

// router.get("/user/products", async (req, res) => {
//   const response = await Products.find().sort({ createdAt: -1 }).toArray();
//   if (response.length > 0) return res.json(response);
//   return res.json([]);
// });

// router.get("/user/product/:id", async (req, res) => {
//   const product = await Products.findOne({ _id: new ObjectId(req.params.id) });
//   if (product) return res.json(product);
//   return res.status(404).json({ message: "Product not found" });
// });

/** Update product (title/description) + optionally replace image */
router.put("/user/product/:id", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const prev = await Products.findOne({ _id: id });
    if (!prev) return res.status(404).json({ message: "Product not found" });

    let image = prev.image;
    if (req.file) {
      // delete old file if exists & it's a local upload path
      if (image && image.startsWith("/uploads/")) {
        const oldPath = path.join(process.cwd(), image);
        fs.existsSync(oldPath) && fs.unlinkSync(oldPath);
      }
      image = `/uploads/${req.file.filename}`;
    }

    const result = await Products.updateOne(
      { _id: id },
      {
        $set: {
          title: req.body.title ?? prev.title,
          description: req.body.description ?? prev.description,
          price: req.body.price ? Number(req.body.price) : prev.price,
          image
        }
      }
    );
    return res.json({ message: "Product updated successfully", data: result });
  } catch (e) {
    return res.status(500).json({ message: "Update failed", error: e.message });
  }
});

router.delete("/user/product/:id", authMiddleware, async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const prev = await Products.findOne({ _id: id });
    if (!prev) return res.status(404).json({ message: "Product not found" });

    if (prev.image && prev.image.startsWith("/uploads/")) {
      const p = path.join(process.cwd(), prev.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const del = await Products.deleteOne({ _id: id });
    return res.json({ message: "Product deleted", data: del });
  } catch (e) {
    return res.status(500).json({ message: "Delete failed", error: e.message });
  }
});

/** Placeholder cart/checkout (as in your original) */
router.post("/user/cart/:productId/:userId", (req, res) => {
  const cart = false; // example placeholder
  if (cart) res.send("removed cart");
  else res.send("added to cart");
});

router.get("/user/cart/:userId", (req, res) => {
  res.send("this is user cart");
});

router.post("/user/checkout/:cartId", (req, res) => {
  res.send("order placed successfully");
});

export default router;
