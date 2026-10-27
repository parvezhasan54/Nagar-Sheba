import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../errors/AppError";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const allowed = (config.frontend_url ?? "").replace(/\/$/, "");

export const originGuard = (req: Request, _res: Response, next: NextFunction) => {
  const hasCookie = req.cookies?.accessToken || req.cookies?.refreshToken;
  if (!UNSAFE.has(req.method) || !hasCookie) return next();
  if (req.originalUrl.startsWith("/api/v1/payments/")) return next(); // gateway callbacks
  const origin = req.headers.origin;
  if (origin && origin !== allowed)
    return next(new AppError(httpStatus.FORBIDDEN, "Cross-site request blocked"));
  next();
};