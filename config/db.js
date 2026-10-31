import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing from environment variables");
}

const client = new MongoClient(uri);

let database;

export const connectDB = async () => {
  try {
    await client.connect();

    database = client.db("StudioSpace");

    await database.command({ ping: 1 });

    // Enforce unique email addresses for user accounts.
    await database.collection("users").createIndex(
      { email: 1 },
      { unique: true }
    );

    console.log("MongoDB connected successfully!");
    console.log("User email index is ready.");

    return database;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export const getDB = () => {
  if (!database) {
    throw new Error("Database has not been initialized");
  }

  return database;
};
