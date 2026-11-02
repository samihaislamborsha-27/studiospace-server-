import { MongoClient } from "mongodb";
import "dotenv/config";

const client = new MongoClient(process.env.MONGODB_URI);

let database;

export const connectDB = async () => {
  try {
    await client.connect();

    database = client.db("StudioSpace");

    await database.command({ ping: 1 });

    await database.collection("users").createIndex(
      { email: 1 },
      { unique: true }
    );

    await database.collection("studios").createIndexes([
      {
        key: {
          status: 1,
          featured: -1,
          createdAt: -1,
        },
        name: "studio_featured_listing",
      },
      {
        key: {
          ownerId: 1,
          createdAt: -1,
        },
        name: "studio_owner_listing",
      },
      {
        key: {
          category: 1,
          status: 1,
        },
        name: "studio_category_listing",
      },
    ]);

    console.log("MongoDB connected successfully.");

    return database;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export const getDB = () => {
  if (!database) {
    throw new Error("Database is not initialized.");
  }

  return database;
};