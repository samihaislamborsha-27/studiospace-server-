import { ObjectId } from "mongodb";

import { getDB } from "../config/db.js";
import { createStudioDocument } from "../models/studioModel.js";

const getCollection = () => getDB().collection("studios");

const isValidId = (id) => ObjectId.isValid(id);

const sendError = (res, error, fallback = "Something went wrong.") => {
  console.error("Studio API error:", error);

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || fallback,
  });
};

// GET /api/studios
export const getStudios = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      location = "",
      maxPrice,
      sortBy = "recommended",
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {
      status: "Available",
    };

    if (category && category !== "All categories") {
      filter.category = category;
    }

    if (location) {
      filter.location = {
        $regex: String(location),
        $options: "i",
      };
    }

    if (search) {
      const searchRegex = {
        $regex: String(search),
        $options: "i",
      };

      filter.$or = [
        { title: searchRegex },
        { category: searchRegex },
        { location: searchRegex },
        { overview: searchRegex },
        { amenities: searchRegex },
      ];
    }

    if (maxPrice !== undefined && Number.isFinite(Number(maxPrice))) {
      filter.hourlyRate = {
        $lte: Number(maxPrice),
      };
    }

    const sortOptions = {
      recommended: { featured: -1, createdAt: -1 },
      newest: { createdAt: -1 },
      "price-low": { hourlyRate: 1 },
      "price-high": { hourlyRate: -1 },
      rating: { rating: -1, reviewCount: -1 },
    };

    const sort = sortOptions[sortBy] || sortOptions.recommended;

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageLimit = Math.min(
      50,
      Math.max(1, Number.parseInt(limit, 10) || 12)
    );

    const collection = getCollection();

    const [studios, total] = await Promise.all([
      collection
        .find(filter)
        .sort(sort)
        .skip((currentPage - 1) * pageLimit)
        .limit(pageLimit)
        .toArray(),

      collection.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: studios,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve studios.");
  }
};

// GET /api/studios/featured
export const getFeaturedStudios = async (_req, res) => {
  try {
    const studios = await getCollection()
      .find({ status: "Available" })
      .sort({ featured: -1, rating: -1, createdAt: -1 })
      .limit(6)
      .toArray();

    return res.status(200).json({
      success: true,
      data: studios,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve featured studios.");
  }
};

// GET /api/studios/:id
export const getStudioDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const studio = await getCollection().findOne({
      _id: new ObjectId(id),
      status: { $ne: "Deleted" },
    });

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: studio,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve studio details.");
  }
};

// POST /api/studios
export const createStudio = async (req, res) => {
  try {
    const studio = createStudioDocument(req.body, req.user);

    const result = await getCollection().insertOne(studio);

    return res.status(201).json({
      success: true,
      message: "Studio created successfully.",
      data: {
        ...studio,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    return sendError(res, error, "Unable to create studio.");
  }
};

// GET /api/studios/owner/mine
export const getMyStudios = async (req, res) => {
  try {
    const studios = await getCollection()
      .find({
        ownerId: req.user._id,
        status: { $ne: "Deleted" },
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: studios,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve your studios.");
  }
};

// PATCH /api/studios/:id
export const updateStudio = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const collection = getCollection();

    const existingStudio = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!existingStudio || existingStudio.status === "Deleted") {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    if (String(existingStudio.ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this studio.",
      });
    }

    const mergedData = {
      ...existingStudio,
      ...req.body,
    };

    const updatedStudio = createStudioDocument(mergedData, {
      _id: existingStudio.ownerId,
      name: existingStudio.ownerName,
      email: existingStudio.ownerEmail,
      photoURL: existingStudio.ownerPhotoURL,
    });

    delete updatedStudio.createdAt;

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updatedStudio,
          updatedAt: new Date(),
        },
      }
    );

    const studio = await collection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Studio updated successfully.",
      data: studio,
    });
  } catch (error) {
    return sendError(res, error, "Unable to update studio.");
  }
};

// DELETE /api/studios/:id
export const deleteStudio = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const collection = getCollection();

    const studio = await collection.findOne({
      _id: new ObjectId(id),
    });

    if (!studio || studio.status === "Deleted") {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    if (String(studio.ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this studio.",
      });
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "Deleted",
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Studio deleted successfully.",
    });
  } catch (error) {
    return sendError(res, error, "Unable to delete studio.");
  }
};
