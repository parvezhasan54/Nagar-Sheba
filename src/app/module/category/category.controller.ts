import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { CategoryService } from "./category.service";

// CREATE CATEGORY

const createCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await CategoryService.createCategory(req.body, actor);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Category created successfully",
		data: result,
	});
});

// GET ALL CATEGORIES

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser | undefined;

	const result = await CategoryService.getAllCategories(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			departmentId: req.query.departmentId as string | undefined,
			includeInactive: req.query.includeInactive === "true",
			search: req.query.search as string | undefined,
			feeType:
				req.query.feeType === "FREE" || req.query.feeType === "PAID"
					? req.query.feeType
					: undefined,
			maxSla: req.query.maxSla ? Number(req.query.maxSla) : undefined,
			sortBy: req.query.sortBy as string | undefined,
			sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
			minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
			maxFee: req.query.maxFee ? Number(req.query.maxFee) : undefined,
			status:
				req.query.status === "active" ||
				req.query.status === "inactive" ||
				req.query.status === "deleted"
					? req.query.status
					: undefined,
		},
		user?.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Categories fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

// GET SINGLE CATEGORY

const getSingleCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await CategoryService.getSingleCategory(
		req.params.id as string,
		req.user?.role as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category fetched successfully",
		data: result,
	});
});

// UPDATE CATEGORY

const updateCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await CategoryService.updateCategory(
		req.params.id as string,
		req.body,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category updated successfully",
		data: result,
	});
});

// DELETE (SOFT) CATEGORY

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await CategoryService.deleteCategory(
		req.params.id as string,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category deleted successfully",
		data: result,
	});
});

const getCategoryReviews = catchAsync(async (req: Request, res: Response) => {
	const result = await CategoryService.getCategoryReviews(
		req.params.id as string,
		{ page: Number(req.query.page), limit: Number(req.query.limit) },
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Category reviews fetched successfully",
		data: result,
	});
});

const getTrendingCategories = catchAsync(
	async (req: Request, res: Response) => {
		const result = await CategoryService.getTrendingCategories(
			Number(req.query.limit),
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Trending categories fetched successfully",
			data: result,
		});
	},
);

const getRecommendedCategories = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user as IRequestUser;
		const result = await CategoryService.getRecommendedCategories(
			user.userId,
			Number(req.query.limit),
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Recommended categories fetched successfully",
			data: result,
		});
	},
);
export const CategoryController = {
	createCategory,
	getAllCategories,
	getSingleCategory,
	getCategoryReviews,
	getTrendingCategories,
	getRecommendedCategories,
	updateCategory,
	deleteCategory,
};
