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
    console.error(error);

    if (error instanceof multer.MulterError) {
      const isTooLarge = error.code === "LIMIT_FILE_SIZE";

      res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge
          ? "Profile image must be smaller than 5MB"
          : error.message
      });
      return;
    }

    if (
      [
        "Please choose a JPG, PNG or WEBP image",
        "Marketplace images must be JPG, PNG or WEBP"
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
