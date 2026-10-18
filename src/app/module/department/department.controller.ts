import { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { DepartmentService } from "./department.service";

// Create department
const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;
	const result = await DepartmentService.createDepartment(
		req.body,
		actor,
		req.file,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Department created successfully",
		data: result,
	});
});

// Get all departments
const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser | undefined;

	const result = await DepartmentService.getAllDepartments(
		{
			page: Number(req.query.page),
			limit: Number(req.query.limit),
			includeInactive: req.query.includeInactive === "true",
			search: req.query.search as string | undefined,
			status:
				req.query.status === "active" || req.query.status === "deleted"
					? req.query.status
					: undefined,
		},
		user?.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Departments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

// Get single department
const getSingleDepartment = catchAsync(async (req: Request, res: Response) => {
	const result = await DepartmentService.getSingleDepartment(
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department fetched successfully",
		data: result,
	});
});

// Update department
const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await DepartmentService.updateDepartment(
		req.params.id as string,
		req.body,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department updated successfully",
		data: result,
	});
});

// Update department image
const updateDepartmentImage = catchAsync(
	async (req: Request, res: Response) => {
		const actor = req.user as IRequestUser;

		if (!req.file) {
			throw new AppError(httpStatus.BAD_REQUEST, "Image file is required");
		}

		const result = await DepartmentService.updateDepartmentImage(
			req.params.id as string,
			req.file,
			actor,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Department image updated successfully",
			data: result,
		});
	},
);

// Soft delete department
const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user as IRequestUser;

	const result = await DepartmentService.deleteDepartment(
		req.params.id as string,
		actor,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department deleted successfully",
		data: result,
	});
});

export const DepartmentController = {
	createDepartment,
	getAllDepartments,
	getSingleDepartment,
	updateDepartment,
	updateDepartmentImage,
	deleteDepartment,
};
