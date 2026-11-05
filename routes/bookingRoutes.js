import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getOwnerBookings,
  confirmBooking,
  rejectBooking,
} from "../controllers/bookingController.js";

import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", createBooking);
router.get("/mine", getMyBookings);
router.get("/owner", getOwnerBookings);
router.patch("/:id/cancel", cancelBooking);
router.patch("/:id/confirm", confirmBooking);
router.patch("/:id/reject", rejectBooking);

export default router;
