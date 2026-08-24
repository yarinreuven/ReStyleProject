import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response
  } from "express";
  import multer from "multer";
  
  export const errorHandler: ErrorRequestHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.error("Unhandled request error:", error.message);

    const requestError = error as Error & { status?: number; type?: string };
    if (requestError.status === 413) {
      res.status(413).json({
        success: false,
        message: "Request body is too large"
      });
      return;
    }
    if (requestError.status === 400 && requestError.type === "entity.parse.failed") {
      res.status(400).json({
        success: false,
        message: "Request body is invalid"
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      const isTooLarge = error.code === "LIMIT_FILE_SIZE";

      res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge
          ? "Image must be smaller than 5MB"
          : error.message
      });
      return;
    }

    if (
      [
        "Please choose a JPG, PNG or WEBP image",
        "Marketplace images must be JPG, PNG or WEBP",
        "The virtual model must be a JPG, PNG or WEBP image"
      ].includes(error.message)
    ) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
  
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  };
