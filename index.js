// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { client } from "./dbConfig.js";
// import authRoutes from "./routes/authRoutes.js";
// import productRoutes from "./routes/productRoute.js";
// import userRoutes from "./routes/userRoutes.js";
// import categoryRoutes from "./routes/categoryRoutes.js";

// dotenv.config();
// const app = express();

// app.use(cors({
//   origin: ["http://localhost:5173", "http://localhost:5174", "https://olx-admin-code.vercel.app", "https://olx-frontend-code.vercel.app"],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(express.json());
// app.use("/uploads", express.static("uploads"));

// // ✅ Register all routes here
// app.use("/api/auth", authRoutes);
// app.use("/api", userRoutes);
// app.use("/api", categoryRoutes);
// app.use("/api", productRoutes);

// // ✅ Root check
// app.get("/", (req, res) => res.send("✅ API running fine"));

// const PORT = process.env.PORT || 3002;

// // Add error handling
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
//   res.status(500).json({ message: "Internal server error", error: err.message });
// });

// // Connect to DB then start server
// client.connect()
//   .then(() => {
//     console.log('Connected to MongoDB');
//     app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
//   })
//   .catch(err => {
//     console.error('MongoDB connection error:', err);
//     process.exit(1);
//   });







import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { client } from "./dbConfig.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoute.js";
import usersRoutes from "./routes/usersRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Register all routes here
app.use("/api/auth", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", userRoutes);
app.use("/api", categoryRoutes);
app.use("/api", productRoutes);
app.use("/api", adminRoutes);

// ✅ Root check
app.get("/", (req, res) => res.send("✅ API running fine"));

const PORT = process.env.PORT || 3002;

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

// Connect to DB then start server
client.connect()
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
