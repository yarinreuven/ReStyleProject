import type {
    NextFunction,
    Request,
    Response
  } from "express";
  import jwt from "jsonwebtoken";
  
  export interface AuthRequest extends Request {
    userId?: string;
  }
  
  interface TokenPayload {
    userId: string;
    email: string;
  }
  
  export function authenticateToken(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    const authorizationHeader = req.headers.authorization;
  
    if (
      !authorizationHeader ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      res.status(401).json({
        success: false,
        message: "Authentication is required"
      });
      return;
    }
  
    const token = authorizationHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;
  
    if (!jwtSecret) {
      next(new Error("JWT_SECRET is missing"));
      return;
    }
  
    try {
      const payload = jwt.verify(
        token,
        jwtSecret
      ) as TokenPayload;
  
      req.userId = payload.userId;
      next();
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
  }