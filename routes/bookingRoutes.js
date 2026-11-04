import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
} from "../controllers/bookingController.js";

import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", createBooking);
router.get("/mine", getMyBookings);
router.patch("/:id/cancel", cancelBooking);

export default router;