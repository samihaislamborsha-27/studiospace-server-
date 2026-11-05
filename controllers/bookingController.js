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
// GET /api/bookings/owner
export const getOwnerBookings = async (req, res) => {
  try {
    const ownerIds = [req.user._id, String(req.user._id)];

    if (ObjectId.isValid(String(req.user._id))) {
      ownerIds.push(new ObjectId(String(req.user._id)));
    }

    const bookings = await bookingsCollection()
      .find({ ownerId: { $in: ownerIds } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve booking requests.");
  }
};

// PATCH /api/bookings/:id/confirm
export const confirmBooking = async (req, res) => {
  let lockToken = null;
  let studioId = null;

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const ownerIds = [req.user._id, String(req.user._id)];

    if (ObjectId.isValid(String(req.user._id))) {
      ownerIds.push(new ObjectId(String(req.user._id)));
    }

    const collection = bookingsCollection();
    const bookingId = new ObjectId(id);

    const booking = await collection.findOne({
      _id: bookingId,
      ownerId: { $in: ownerIds },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking request not found.",
      });
    }

    if (booking.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending booking requests can be confirmed.",
      });
    }

    if (!ObjectId.isValid(String(booking.studioId))) {
      return res.status(400).json({
        success: false,
        message: "The associated studio is invalid.",
      });
    }

    studioId = new ObjectId(String(booking.studioId));

    const studio = await studiosCollection().findOne({
      _id: studioId,
    });

    if (!studio || String(studio.ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to confirm this booking.",
      });
    }

    // Acquire a short-lived atomic lock so two owners' requests
    // for the same studio cannot be confirmed simultaneously.
    lockToken = `${String(req.user._id)}-${new ObjectId().toString()}`;

    const lockResult = await studiosCollection().updateOne(
      {
        _id: studioId,
        $or: [
          { bookingConfirmationLockUntil: { $exists: false } },
          { bookingConfirmationLockUntil: null },
          { bookingConfirmationLockUntil: { $lt: new Date() } },
        ],
      },
      {
        $set: {
          bookingConfirmationLockToken: lockToken,
          bookingConfirmationLockUntil: new Date(Date.now() + 30000),
        },
      }
    );

    if (lockResult.modifiedCount !== 1) {
      return res.status(409).json({
        success: false,
        message: "Another booking is being confirmed for this studio. Please try again.",
      });
    }

    const latestBooking = await collection.findOne({
      _id: bookingId,
      ownerId: { $in: ownerIds },
      status: "Pending",
    });

    if (!latestBooking) {
      return res.status(409).json({
        success: false,
        message: "This booking request has already been processed.",
      });
    }

    const conflictingBooking = await collection.findOne({
      studioId,
      _id: { $ne: bookingId },
      status: "Confirmed",
      startAt: { $lt: latestBooking.endAt },
      endAt: { $gt: latestBooking.startAt },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: "This booking overlaps with another confirmed booking.",
      });
    }

    const updateResult = await collection.updateOne(
      {
        _id: bookingId,
        ownerId: { $in: ownerIds },
        status: "Pending",
      },
      {
        $set: {
          status: "Confirmed",
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.modifiedCount !== 1) {
      return res.status(409).json({
        success: false,
        message: "This booking request has already been processed.",
      });
    }

    const updatedBooking = await collection.findOne({
      _id: bookingId,
    });

    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully.",
      data: updatedBooking,
    });
  } catch (error) {
    return sendError(res, error, "Unable to confirm booking.");
  } finally {
    if (lockToken && studioId) {
      try {
        await studiosCollection().updateOne(
          {
            _id: studioId,
            bookingConfirmationLockToken: lockToken,
          },
          {
            $unset: {
              bookingConfirmationLockToken: "",
              bookingConfirmationLockUntil: "",
            },
          }
        );
      } catch (releaseError) {
        console.error("Unable to release booking confirmation lock:", releaseError);
      }
    }
  }
};

// PATCH /api/bookings/:id/reject
export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const ownerIds = [req.user._id, String(req.user._id)];

    if (ObjectId.isValid(String(req.user._id))) {
      ownerIds.push(new ObjectId(String(req.user._id)));
    }

    const result = await bookingsCollection().updateOne(
      {
        _id: new ObjectId(id),
        ownerId: { $in: ownerIds },
        status: "Pending",
      },
      {
        $set: {
          status: "Rejected",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending booking request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking request rejected successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Unable to reject booking.");
  }
};
