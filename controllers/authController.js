import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const COOKIE_NAME = "studiospace_token";
const TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: COOKIE_MAX_AGE,
  path: "/",
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from environment variables.");
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
};

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  photoURL: user.photoURL || "",
  role: user.role,
  createdAt: user.createdAt,
});

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPassword = (password) =>
  password.length >= 6 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password);

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, password, photoURL = "" } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof photoURL !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid registration details.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhotoURL = photoURL.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain between 2 and 80 characters.",
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters, one uppercase letter and one lowercase letter.",
      });
    }

    if (cleanPhotoURL) {
      try {
        const parsedURL = new URL(cleanPhotoURL);

        if (!["http:", "https:"].includes(parsedURL.protocol)) {
          throw new Error("Invalid URL protocol");
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid profile photo URL.",
        });
      }
    }

    const users = getDB().collection("users");

    const existingUser = await users.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const newUser = {
      name: cleanName,
      email: cleanEmail,
      photoURL: cleanPhotoURL,
      passwordHash,
      role: "user",
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(newUser);

    const savedUser = {
      ...newUser,
      _id: result.insertedId,
    };

    const token = createToken(savedUser);

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "Your StudioSpace account has been created successfully!",
      user: publicUser(savedUser),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create your account. Please try again.",
    });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const users = getDB().collection("users");
    const user = await users.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Welcome back to StudioSpace!",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to sign in. Please try again.",
    });
  }
};

// POST /api/auth/logout
export const logout = async (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "You have been signed out successfully.",
  });
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: publicUser(req.user),
  });
};
