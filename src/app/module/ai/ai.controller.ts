import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AiService } from "./ai.service";

const chat = catchAsync(async (req: Request, res: Response) => {
	const result = await AiService.chat(req.body.messages);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Reply generated",
		data: result,
	});
});

const suggestCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await AiService.suggestCategory(req.body.text);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Service suggested",
		data: result,
	});
});

const getAdminInsights = catchAsync(async (_req: Request, res: Response) => {
	const result = await AiService.getAdminInsights();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Insights generated",
		data: result,
	});
});

const searchSuggest = catchAsync(async (req: Request, res: Response) => {
	const result = await AiService.searchSuggest(String(req.query.q ?? ""));
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Suggestions generated",
		data: result,
	});
});

export const AiController = {
	chat,
	suggestCategory,
	getAdminInsights,
	searchSuggest,
};
