import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const COOKIE_NAME = "studiospace_token";

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to continue.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!ObjectId.isValid(decoded.sub)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await getDB()
      .collection("users")
      .findOne(
        { _id: new ObjectId(decoded.sub) },
        { projection: { passwordHash: 0 } }
      );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Your account could not be found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please sign in again.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify your session.",
    });
  }
};
