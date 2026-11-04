import express from "express";

import {
  getStudios,
  getFeaturedStudios,
  getStudioDetails,
  createStudio,
  updateStudio,
  deleteStudio,
  getMyStudios,
} from "../controllers/studioControllers.js";

import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

// Public routes
router.get("/featured", getFeaturedStudios);
router.get("/", getStudios);

// Protected routes
router.get("/owner/mine", verifyToken, getMyStudios);
router.post("/", verifyToken, createStudio);
router.patch("/:id", verifyToken, updateStudio);
router.delete("/:id", verifyToken, deleteStudio);

// Keep this dynamic route after named routes.
router.get("/:id", getStudioDetails);

export default router;
