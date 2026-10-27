import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../errors/AppError";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const allowed = (config.frontend_url ?? "").replace(/\/$/, "");

// Only the gateway callbacks are cross-site by design.
const CALLBACK_PREFIXES = [
	"/api/v1/payments/sslcommerz/",
	"/api/v1/payments/bkash/",
];

export const originGuard = (req: Request, _res: Response, next: NextFunction) => {
	const hasCookie = req.cookies?.accessToken || req.cookies?.refreshToken;
	if (!UNSAFE.has(req.method) || !hasCookie) return next();
	if (CALLBACK_PREFIXES.some((p) => req.originalUrl.startsWith(p))) return next();
	const origin = req.headers.origin;
	if (origin && origin !== allowed)
		return next(new AppError(httpStatus.FORBIDDEN, "Cross-site request blocked"));
	next();
};