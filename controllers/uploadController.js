export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a profile image.",
      });
    }

    if (!req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Unable to read the selected image.",
      });
    }

    const apiKey = process.env.IMGBB_API_KEY?.trim();

    if (!apiKey) {
      console.error("ImgBB API key is missing.");

      return res.status(500).json({
        success: false,
        message: "Image upload service is not configured. Check your backend .env file.",
      });
    }

    console.log("ImgBB configuration:", {
      keyExists: true,
      keyLength: apiKey.length,
      keyHasWhitespace: apiKey !== process.env.IMGBB_API_KEY,
    });

    const formData = new FormData();

    formData.append(
      "image",
      req.file.buffer.toString("base64")
    );

    const uploadURL = new URL("https://api.imgbb.com/1/upload");
    uploadURL.searchParams.set("key", apiKey);

    const response = await fetch(uploadURL, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.data?.url) {
      console.error("ImgBB upload rejected:", {
        httpStatus: response.status,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
      });

      const errorCode = result.error?.code;

      let message = "Image upload failed. Please try again.";

      if (
        errorCode === 100 ||
        errorCode === 101 ||
        errorCode === 105
      ) {
        message = "ImgBB rejected the API key. Check that you copied the actual API key from your ImgBB account.";
      } else if (result.error?.message) {
        message = result.error.message;
      }

      return res.status(502).json({
        success: false,
        message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      imageURL: result.data.url,
    });

  } catch (error) {
    console.error("Profile image upload error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        error.name === "TimeoutError"
          ? "Image upload timed out. Please try again."
          : "Something went wrong while uploading your profile image.",
    });
  }
};