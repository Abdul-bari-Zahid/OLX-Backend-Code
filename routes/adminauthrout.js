import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { client } from "../dbConfig.js";

const router = express.Router();
const db = client.db("myEcommerce");
const Users = db.collection("users");

// ✅ Register (for testing)
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await Users.insertOne({ name, email, password: hash, role: role || "user" });
  res.json({ message: "User registered" });
});

// ✅ Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await Users.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({
    message: "Login successful",
    token,
    user: { name: user.name, email: user.email, role: user.role },
  });
});

export default router;
