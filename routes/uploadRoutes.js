import express from "express";
import { uploadProfileImage } from "../controllers/uploadController.js";
import uploadImage from "../middlewares/uploadImage.js";

const router = express.Router();

router.post(
  "/profile-image",
  (req, res, next) => {
    uploadImage.single("image")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next();
    });
  },
  uploadProfileImage
);

export default router;
