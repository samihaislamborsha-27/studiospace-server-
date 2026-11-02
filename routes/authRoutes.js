import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);
router.patch("/profile", verifyToken, updateProfile);

export default router;