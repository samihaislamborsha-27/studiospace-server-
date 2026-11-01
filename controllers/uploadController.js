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
            console.error("IMGBB_API_KEY is missing.");

            return res.status(500).json({
                success: false,
                message: "Image upload service is not configured.",
            });
        }

        if (!req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: "Unable to read the selected image.",
            });
        }

        const formData = new FormData();

        formData.append(
            "image",
            req.file.buffer.toString("base64")
        );

        const response = await fetch(
            `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                body: formData,
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success || !result.data?.url) {
            console.error("ImgBB upload failed:", {
                status: response.status,
                statusText: response.statusText,
                error: result.error || result,
            });

            return res.status(502).json({
                success: false,
                message:
                    result.error?.message ||
                    "ImgBB could not upload this image.",
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
            message: error.message ||
                "Something went wrong while uploading your image.",
        });
    }
};