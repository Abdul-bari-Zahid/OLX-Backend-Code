



import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { client } from "./dbConfig.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoute.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";

dotenv.config();
const app = express();

// app.use(cors(
//   origin ["http://localhost:5173", "https://olx-frontend-code.vercel.app"]
// ));
app.use(cors({
  origin : ["http://localhost:5173", "https://olx-frontend-code.vercel.app"],
  credentials : true
}))
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Register all routes here
app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api", categoryRoutes);
app.use("/api", productRoutes);

// ✅ Root check
app.get("/", (req, res) => res.send("✅ API running fine"));

const PORT = process.env.PORT || 3002;
client.connect().then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  );
});
