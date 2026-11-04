import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const bookingsCollection = () => getDB().collection("bookings");
const studiosCollection = () => getDB().collection("studios");

const sendError = (res, error, fallback = "Something went wrong.") => {
  console.error("Booking API error:", error);

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
};

const isValidId = (id) => ObjectId.isValid(id);

const overlaps = (startA, endA, startB, endB) =>
  new Date(startA) < new Date(endB) &&
  new Date(endA) > new Date(startB);

// POST /api/bookings
export const createBooking = async (req, res) => {
  try {
    const {
      studioId,
      bookingDate,
      startTime,
      duration,
      notes = "",
    } = req.body;

    if (!studioId || !isValidId(studioId)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid studio.",
      });
    }

    if (!bookingDate || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: "Date, start time, and duration are required.",
      });
    }

    const durationHours = Number(duration);

    if (
      !Number.isFinite(durationHours) ||
      durationHours < 1 ||
      durationHours > 24
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking duration must be between 1 and 24 hours.",
      });
    }

    if (typeof startTime !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid start time.",
      });
    }

    if (typeof bookingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid booking date.",
      });
    }

    const [year, month, day] = bookingDate.split("-").map(Number);
    const [hours, minutes] = startTime.split(":").map(Number);

    // Store booking times as UTC timestamps.
    const startAt = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    const endAt = new Date(startAt.getTime() + durationHours * 60 * 60 * 1000);

    if (
      startAt.getUTCFullYear() !== year ||
      startAt.getUTCMonth() !== month - 1 ||
      startAt.getUTCDate() !== day
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid calendar date.",
      });
    }

    if (startAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Choose a future date and time.",
      });
    }

    const studio = await studiosCollection().findOne({
      _id: new ObjectId(studioId),
      status: "Available",
    });

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "This studio is no longer available.",
      });
    }

    if (String(studio.ownerId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own studio.",
      });
    }

    const existingBookings = await bookingsCollection()
      .find({
        studioId: new ObjectId(studioId),
        status: "Confirmed",
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      })
      .toArray();

    const hasConflict = existingBookings.some((booking) =>
      overlaps(startAt, endAt, booking.startAt, booking.endAt)
    );

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: "This time slot is already booked. Please choose another time.",
      });
    }

    const hourlyRate = Number(studio.hourlyRate);
    const securityDeposit = Number(studio.securityDeposit || 0);
    const totalPrice = hourlyRate * durationHours + securityDeposit;

    const booking = {
      studioId: new ObjectId(studioId),
      studioTitle: studio.title,
      studioImage: studio.image || "",
      studioLocation: studio.location || "",
      ownerId: studio.ownerId,
      ownerName: studio.ownerName || "",
      ownerEmail: studio.ownerEmail || "",
      userId: req.user._id,
      userName: req.user.name || req.user.displayName || "",
      userEmail: req.user.email,
      bookingDate,
      startTime,
      duration: durationHours,
      startAt,
      endAt,
      hourlyRate,
      securityDeposit,
      totalPrice,
      notes: String(notes).trim().slice(0, 1000),
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await bookingsCollection().insertOne(booking);

    return res.status(201).json({
      success: true,
      message: "Booking request submitted successfully.",
      data: {
        ...booking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    return sendError(res, error, "Unable to create booking.");
  }
};

// GET /api/bookings/mine
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await bookingsCollection()
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve your bookings.");
  }
};

// PATCH /api/bookings/:id/cancel
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const collection = bookingsCollection();

    const booking = await collection.findOne({
      _id: new ObjectId(id),
      userId: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be cancelled.",
      });
    }

    await collection.updateOne(
      {
        _id: new ObjectId(id),
        userId: req.user._id,
        status: "Pending",
      },
      {
        $set: {
          status: "Cancelled",
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Unable to cancel booking.");
  }
};