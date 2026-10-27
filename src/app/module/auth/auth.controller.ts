
import { Request, Response } from "express";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";

import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { jwtUtils } from "../../utils/jwt";
import { revokeSessions } from "../../utils/session";

import { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";
import { authValidationSchemas } from "./auth.validation";

import config from "../../config";
import { isDemoEmail } from "../../utils/demo";

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
	httpOnly: true,
	secure: isProd,
	sameSite: (isProd ? "none" : "lax") as "none" | "lax",
};

const accessTokenCookieOptions = {
	...baseCookieOptions,
	maxAge: 1000 * 60 * 60 * 24,
};

const refreshTokenCookieOptions = {
	...baseCookieOptions,
	maxAge: 1000 * 60 * 60 * 24 * 7,
};

// Return tokens in the response body only for API clients (e.g. Postman).
// Browser clients receive tokens through httpOnly cookies.
const tokenBody = (
	req: Request,
	tokens: { accessToken: string; refreshToken: string },
) => (req.headers["x-client"] === "api" ? tokens : null);

const registerUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	await AuthService.registerUser(payload);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Check Your Email",
		data: null,
	});
});

const verifyCitizenEmail = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;
		const result = await AuthService.verifyRegistrationEmail(payload);

		const { accessToken, refreshToken, user } = result;

		res.cookie("accessToken", accessToken, accessTokenCookieOptions);
		res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Citizen registered successfully",
			data: {
				user,
				...(
					tokenBody(req, { accessToken, refreshToken }) ?? {}
				),
			},
		});
	},
);

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.googleLogin(payload);

	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, accessTokenCookieOptions);
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Google Login Successfully",
		data: tokenBody(req, { accessToken, refreshToken }),
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.loginUser(payload);

	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, accessTokenCookieOptions);
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: tokenBody(req, { accessToken, refreshToken }),
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	// Prefer the httpOnly cookie for browsers.
	// Fall back to the request body for API clients such as Postman.
	const token = req.cookies?.refreshToken || req.body?.refreshToken;

	if (!token) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Refresh token is missing. Provide it via cookie or request body.",
		);
	}

	const result = await AuthService.refreshToken(token);
	const { accessToken, refreshToken: newRefreshToken } = result;

	res.cookie("accessToken", accessToken, accessTokenCookieOptions);
	res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: tokenBody(req, {
			accessToken,
			refreshToken: newRefreshToken,
		}),
	});
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
	const token = req.cookies?.refreshToken;

	if (token) {
		const verified = jwtUtils.verifyToken(
			token,
			config.jwt_refresh_secret,
		);

		if (verified.success) {
	const data = verified.data as JwtPayload;
	// Shared demo accounts: only clear this browser's cookies.
	if (!isDemoEmail(data.email)) {
		await revokeSessions(data.userId);
	}
}
	}

	res.clearCookie("accessToken", baseCookieOptions);
	res.clearCookie("refreshToken", baseCookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged out successfully",
		data: null,
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.forgotPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.resetPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const updateProfileImage = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;

		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User information is missing in the request",
			);
		}

		if (!req.file) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Profile image file is required",
			);
		}

		const parsed =
			authValidationSchemas.ProfileImageZodSchema.safeParse({
				mimetype: req.file.mimetype,
				size: req.file.size,
			});

		if (!parsed.success) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				parsed.error.issues
					.map((issue) => issue.message)
					.join(", "),
			);
		}

		const result = await AuthService.updateProfileImage({
			userId: user.userId,
			file: req.file,
		});

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Profile image updated successfully",
			data: result,
		});
	},
);

const updateMyProfile = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;

		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User information is missing in the request",
			);
		}

		const result = await AuthService.updateMyProfile(user, req.body);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Profile updated successfully",
			data: result,
		});
	},
);

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await AuthService.changePassword(user, req.body);

	res.cookie(
		"accessToken",
		result.accessToken,
		accessTokenCookieOptions,
	);
	res.cookie(
		"refreshToken",
		result.refreshToken,
		refreshTokenCookieOptions,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.resendRegistrationOtp(req.body.email);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

export const AuthController = {
	registerUser,
	googleLogin,
	loginUser,
	getMe,
	refreshToken,
	logoutUser,
	forgotPassword,
	resetPassword,
	verifyCitizenEmail,
	updateProfileImage,
	updateMyProfile,
	changePassword,
	resendOtp,
};
