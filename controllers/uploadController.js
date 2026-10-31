export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a profile image.",
      });
    }

    const apiKey = process.env.IMGBB_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Image upload service is not configured.",
      });
    }

    const base64Image = req.file.buffer.toString("base64");

    const formData = new FormData();

    formData.append("image", base64Image);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("ImgBB upload failed:", result);

      return res.status(502).json({
        success: false,
        message: "Unable to upload image. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      imageURL: result.data.url,
    });
  } catch (error) {
    console.error("Profile image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while uploading your image.",
    });
  }
};