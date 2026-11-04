export const STUDIO_CATEGORIES_LIST = [
  "Photography",
  "Film & Video",
  "Podcast",
  "Music",
  "Art & Creative",
  "Workshop",
  "Other",
];

export const STUDIO_AMENITIES_LIST = [
  "Natural light",
  "Lighting",
  "Changing room",
  "Video equipment",
  "Soundproof",
  "Green screen",
  "Microphones",
  "Audio mixer",
  "Instruments",
  "Art supplies",
  "Open space",
  "Parking",
  "Air conditioning",
  "Wi-Fi",
  "Backdrop",
];

export const createStudioDocument = (data, user) => {
  const title = String(data.title || "").trim();
  const category = String(data.category || "").trim();
  const location = String(data.location || "").trim();
  const overview = String(data.overview || "").trim();
  const image = String(data.image || "").trim();

  const hourlyRate = Number(data.hourlyRate);
  const securityDeposit = Number(data.securityDeposit || 0);
  const capacity = Number(data.capacity);

  const amenities = Array.isArray(data.amenities)
    ? [...new Set(data.amenities.map((item) => String(item).trim()).filter(Boolean))]
    : [];

  if (!title || !category || !location || !overview || !image) {
    throw new Error("Please provide all required studio information.");
  }

  if (!STUDIO_CATEGORIES_LIST.includes(category)) {
    throw new Error("Please select a valid studio category.");
  }

  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    throw new Error("Hourly rate must be greater than zero.");
  }

  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
    throw new Error("Security deposit cannot be negative.");
  }

  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Capacity must be at least one person.");
  }

  if (!user?._id || !user?.email) {
    throw new Error("Authenticated user information is missing.");
  }

  const now = new Date();

  return {
    title,
    category,
    location,
    hourlyRate,
    securityDeposit,
    capacity,
    image,
    amenities,
    overview,

    featured: false,
    rating: 0,
    reviewCount: 0,

    ownerId: user._id,
    ownerName: user.name || "",
    ownerEmail: user.email,
    ownerPhotoURL: user.photoURL || "",

    status: "Available",
    createdAt: now,
    updatedAt: now,
  };
};
