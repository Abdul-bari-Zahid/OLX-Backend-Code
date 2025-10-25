

import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error("❌ Please set MONGO_URI in your .env file");
}

export const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});






