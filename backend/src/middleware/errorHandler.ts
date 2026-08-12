import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response
  } from "express";
  
  export const errorHandler: ErrorRequestHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    console.error(error);
  
    res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  };