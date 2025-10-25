
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { client } from "../dbConfig.js";
dotenv.config();

const router = express.Router();
const Users = client.db("myEcommerce").collection("users");
const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";

// ✅ Register
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password } = req.body;
    if (!firstName || !lastName || !phone || !email || !password)
      return res.status(400).json({ message: "Please fill all fields" });

    const lowerEmail = email.toLowerCase();
    const exist = await Users.findOne({ email: lowerEmail });
    if (exist) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = {
      name: `${firstName} ${lastName}`,
      phone,
      email: lowerEmail,
      password: hashed,
      role: "user",
      createdAt: new Date(),
    };
    const result = await Users.insertOne(newUser);
    res.json({ message: "Registered successfully", data: result });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = email.toLowerCase();
    const user = await Users.findOne({ email: lowerEmail });
    if (!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ Promote user to admin (manual)
router.get("/make-admin/:email", async (req, res) => {
  const result = await Users.updateOne(
    { email: req.params.email.toLowerCase() },
    { $set: { role: "admin" } }
  );
  if (!result.modifiedCount) return res.status(404).json({ message: "User not found" });
  res.json({ message: "✅ User promoted to admin" });
});

export default router;
