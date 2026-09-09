import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../types/JwtPayload.js";

export default function authorize(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  const token = req.header("x-auth-token");
  if (!token) {
    return res.status(401).send("Access denied. No token provided.");
  }

  if (!process.env.JWT_PRIVATE_KEY) {
    console.error("JWT_PRIVATE_KEY is not configured.");

    return res.status(500).send("Authentication configuration error.");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_PRIVATE_KEY
    ) as JwtPayload;

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !decoded._id ||
      !decoded.companyId
    ) {
      return res.status(401).send("Invalid authentication context.");
    }

    req.user = decoded;
    return next();
  } catch (error) {
    console.error("AN ERROR OCCURRED WHILE AUTHORIZING ADMIN USER:", error);

    return res.status(401).send("Invalid or expired token.");
  }
}
