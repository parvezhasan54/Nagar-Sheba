import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PublicService } from "./public.service";

const getStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await PublicService.getStats();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Public stats fetched successfully",
		data: result,
	});
});

const sendContactMessage = catchAsync(async (req: Request, res: Response) => {
	await PublicService.sendContactMessage(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Message sent successfully",
		data: null,
	});
});
const getResolvedIssues = catchAsync(async (_req: Request, res: Response) => {
	const result = await PublicService.getResolvedIssues();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Resolved issues fetched successfully",
		data: result,
	});
});

const getTestimonials = catchAsync(async (_req: Request, res: Response) => {
	const result = await PublicService.getTestimonials();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Testimonials fetched successfully",
		data: result,
	});
});

const subscribe = catchAsync(async (req: Request, res: Response) => {
	await PublicService.subscribe(req.body.email);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Subscribed successfully",
		data: null,
	});
});

export const PublicController = {
	getStats,
	sendContactMessage,
	getResolvedIssues,
	getTestimonials,
	subscribe,
};
