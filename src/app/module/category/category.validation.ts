import * as z from "zod";

const FeeTypeEnum = z.enum(["FREE", "PAID"], "feeType must be FREE or PAID");

// CREATE CATEGORY
const CreateCategoryZodSchema = z
	.object({
		departmentId: z.uuid("departmentId must be a valid UUID"),

		name: z
			.string("Category name is required")
			.min(2, "Category name must be at least 2 characters long")
			.max(100, "Category name must not exceed 100 characters"),

		description: z
			.string("Description must be a string")
			.max(500, "Description must not exceed 500 characters")
			.optional(),

		images: z
			.array(z.url("Each image must be a valid URL"))
			.max(5, "At most 5 images are allowed")
			.optional(),

		feeType: FeeTypeEnum,

		feeAmount: z
			.number("Fee amount must be a number")
			.positive("Fee amount must be greater than 0")
			.optional(),

		slaHours: z
			.number("SLA hours must be a number")
			.int("SLA hours must be a whole number")
			.min(1, "SLA hours must be at least 1")
			.max(720, "SLA hours must not exceed 720 (30 days)"),
	})
	.refine(
		(data) => (data.feeType === "PAID" ? data.feeAmount !== undefined : true),
		{
			message: "feeAmount is required when feeType is PAID",
			path: ["feeAmount"],
		},
	)
	.refine(
		(data) => (data.feeType === "FREE" ? data.feeAmount === undefined : true),
		{
			message: "feeAmount must not be provided when feeType is FREE",
			path: ["feeAmount"],
		},
	);

// UPDATE CATEGORY
const UpdateCategoryZodSchema = z
	.object({
		name: z
			.string("Category name must be a string")
			.min(2, "Category name must be at least 2 characters long")
			.max(100, "Category name must not exceed 100 characters")
			.optional(),

		description: z
			.string("Description must be a string")
			.max(500, "Description must not exceed 500 characters")
			.optional(),

		images: z
			.array(z.url("Each image must be a valid URL"))
			.max(5, "At most 5 images are allowed")
			.optional(),

		feeType: FeeTypeEnum.optional(),

		feeAmount: z
			.number("Fee amount must be a number")
			.positive("Fee amount must be greater than 0")
			.optional(),

		slaHours: z
			.number("SLA hours must be a number")
			.int("SLA hours must be a whole number")
			.min(1, "SLA hours must be at least 1")
			.max(720, "SLA hours must not exceed 720 (30 days)")
			.optional(),

		isActive: z.boolean("isActive must be a boolean").optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided to update.",
	})
	.refine(
		(data) => !(data.feeType === "FREE" && data.feeAmount !== undefined),
		{
			message: "feeAmount must not be provided when setting feeType to FREE",
			path: ["feeAmount"],
		},
	);

export const categoryValidationSchemas = {
	CreateCategoryZodSchema,
	UpdateCategoryZodSchema,
};
