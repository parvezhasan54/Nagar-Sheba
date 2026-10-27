import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import {
	ICategoryQuery,
	ICreateCategoryPayload,
	IUpdateCategoryPayload,
} from "./category.interface";

// create category
const createCategory = async (
	payload: ICreateCategoryPayload,
	actor: IRequestUser,
) => {
	const department = await prisma.department.findUnique({
		where: { id: payload.departmentId },
	});

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	const existing = await prisma.category.findUnique({
		where: {
			departmentId_name: {
				departmentId: payload.departmentId,
				name: payload.name,
			},
		},
	});

	if (existing) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A category with this name already exists in this department",
		);
	}

	const [category] = await prisma.$transaction([
		prisma.category.create({
			data: {
				departmentId: payload.departmentId,
				name: payload.name,
				description: payload.description,
				images: payload.images ?? [],
				feeType: payload.feeType,
				feeAmount: payload.feeType === "PAID" ? payload.feeAmount : null,
				slaHours: payload.slaHours,
			},
		}),
	]);

	await prisma.auditLog.create({
		data: {
			actorId: actor.userId,
			action: "CATEGORY_CREATED",
			entityType: "Category",
			entityId: category.id,
			previousValue: undefined,
			newValue: {
				name: category.name,
				departmentId: category.departmentId,
				feeType: category.feeType,
				feeAmount: category.feeAmount,
				slaHours: category.slaHours,
			},
		},
	});

	return category;
};

// GET ALL CATEGORIES (paginated, filterable by department)

const ALLOWED_SORT_FIELDS = ["createdAt", "name", "slaHours", "feeAmount"];

const getAllCategories = async (
	query: ICategoryQuery,
	requesterRole?: Role,
) => {
	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(
		Number(query.limit) > 0 ? Number(query.limit) : 10,
		100,
	);
	const skip = (page - 1) * limit;

	const includeInactive =
		requesterRole === Role.ADMIN && !!query.includeInactive;

	const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy as string)
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
	const search = query.search?.trim();

	// Filter categories by their average rating.
	let ratedIds: string[] | undefined;

	if (query.minRating && Number(query.minRating) > 0) {
		const rows = await prisma.$queryRaw<{ categoryId: string }[]>`
      SELECT sr."categoryId" AS "categoryId"
      FROM feedbacks f
      JOIN service_requests sr ON sr.id = f."requestId"
      GROUP BY sr."categoryId"
      HAVING AVG(f.rating) >= ${Number(query.minRating)}::float8
    `;

		ratedIds = rows.map((row) => row.categoryId);
	}

	// Public users only see active, non-deleted categories.
	// Admins can optionally filter by category status.
	const statusWhere: Prisma.CategoryWhereInput = !includeInactive
		? { deletedAt: null, isActive: true }
		: query.status === "active"
			? { deletedAt: null, isActive: true }
			: query.status === "inactive"
				? { deletedAt: null, isActive: false }
				: query.status === "deleted"
					? { deletedAt: { not: null } }
					: {};

	const where: Prisma.CategoryWhereInput = {
		...statusWhere,
		...(query.departmentId ? { departmentId: query.departmentId } : {}),
		...(query.feeType ? { feeType: query.feeType } : {}),
		...(query.maxSla ? { slaHours: { lte: Number(query.maxSla) } } : {}),
		...(ratedIds ? { id: { in: ratedIds } } : {}),
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: "insensitive" } },
						{ description: { contains: search, mode: "insensitive" } },
						{
							department: {
								name: { contains: search, mode: "insensitive" },
							},
						},
					],
				}
			: {}),
			...(query.maxFee
  ? { AND: [{ OR: [{ feeAmount: null }, { feeAmount: { lte: Number(query.maxFee) } }] }] }
  : {}),
	};

	const orderBy: Prisma.CategoryOrderByWithRelationInput =
		sortBy === "feeAmount"
			? { feeAmount: { sort: sortOrder, nulls: "last" } }
			: { [sortBy]: sortOrder };

	const [categories, total] = await Promise.all([
		prisma.category.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: {
				department: {
					select: { id: true, name: true },
				},
			},
		}),
		prisma.category.count({ where }),
	]);

	// Fetch rating summaries for the current page only.
	const ids = categories.map((category) => category.id);

	const stats = ids.length
		? await prisma.$queryRaw<
				{ categoryId: string; avg: number; count: bigint }[]
			>`
        SELECT
          sr."categoryId" AS "categoryId",
          AVG(f.rating)::float8 AS avg,
          COUNT(*) AS count
        FROM feedbacks f
        JOIN service_requests sr ON sr.id = f."requestId"
        WHERE sr."categoryId" IN (${Prisma.join(ids)})
        GROUP BY sr."categoryId"
      `
		: [];

	const byCategory = new Map(stats.map((stat) => [stat.categoryId, stat]));

	return {
		data: categories.map((category) => {
			const stat = byCategory.get(category.id);

			return {
				...category,
				averageRating: stat ? Math.round(stat.avg * 10) / 10 : null,
				reviewCount: stat ? Number(stat.count) : 0,
			};
		}),
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit) || 1,
		},
	};
};

// GET SINGLE CATEGORY

const getSingleCategory = async (id: string) => {
	const category = await prisma.category.findUnique({
		where: { id },
		include: {
			department: {
				select: { id: true, name: true },
			},
		},
	});

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	const stats = await prisma.$queryRaw<{ avg: number; count: bigint }[]>`
    SELECT
      AVG(f.rating)::float8 AS avg,
      COUNT(*) AS count
    FROM feedbacks f
    JOIN service_requests sr ON sr.id = f."requestId"
    WHERE sr."categoryId" = ${id}
  `;

	const stat = stats[0];

	return {
		...category,
		averageRating: stat?.avg != null ? Math.round(stat.avg * 10) / 10 : null,
		reviewCount: stat ? Number(stat.count) : 0,
	};
};

// UPDATE CATEGORY

const updateCategory = async (
	id: string,
	payload: IUpdateCategoryPayload,
	actor: IRequestUser,
) => {
	const category = await prisma.category.findUnique({ where: { id } });

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	const nextFeeType = payload.feeType ?? category.feeType;
	const nextFeeAmount =
		nextFeeType === "FREE" ? null : (payload.feeAmount ?? category.feeAmount);

	if (
		nextFeeType === "PAID" &&
		(!nextFeeAmount || Number(nextFeeAmount) <= 0)
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"feeAmount is required and must be greater than 0 for a PAID category",
		);
	}

	if (payload.name && payload.name !== category.name) {
		const nameTaken = await prisma.category.findUnique({
			where: {
				departmentId_name: {
					departmentId: category.departmentId,
					name: payload.name,
				},
			},
		});

		if (nameTaken) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"A category with this name already exists in this department",
			);
		}
	}

	const previousValue = {
		name: category.name,
		feeType: category.feeType,
		feeAmount: category.feeAmount,
		slaHours: category.slaHours,
		isActive: category.isActive,
	};

	const [updated] = await prisma.$transaction([
		prisma.category.update({
			where: { id },
			data: {
				name: payload.name,
				description: payload.description,
				images: payload.images,
				feeType: payload.feeType,
				feeAmount: nextFeeAmount,
				slaHours: payload.slaHours,
				isActive: payload.isActive,
			},
		}),
		prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "CATEGORY_UPDATED",
				entityType: "Category",
				entityId: id,
				previousValue,
				newValue: JSON.parse(JSON.stringify(payload)),
			},
		}),
	]);

	return updated;
};

// SOFT DELETE CATEGORY
const deleteCategory = async (id: string, actor: IRequestUser) => {
	const category = await prisma.category.findUnique({ where: { id } });

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	const [deleted] = await prisma.$transaction([
		prisma.category.update({
			where: { id },
			data: { deletedAt: new Date(), isActive: false },
		}),
		prisma.auditLog.create({
			data: {
				actorId: actor.userId,
				action: "CATEGORY_DELETED",
				entityType: "Category",
				entityId: id,
				previousValue: { deletedAt: null, isActive: category.isActive },
				newValue: { deletedAt: new Date(), isActive: false },
			},
		}),
	]);

	return deleted;
};

const getCategoryReviews = async (
	id: string,
	query: { page?: number; limit?: number },
) => {
	const category = await prisma.category.findUnique({
		where: { id },
		select: { id: true, deletedAt: true },
	});

	if (!category || category.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Category not found");
	}

	const page = Number(query.page) > 0 ? Number(query.page) : 1;
	const limit = Math.min(Number(query.limit) > 0 ? Number(query.limit) : 6, 50);
	const skip = (page - 1) * limit;

	const where: Prisma.FeedbackWhereInput = { request: { categoryId: id } };

	const [items, total, avg, groups] = await Promise.all([
		prisma.feedback.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				rating: true,
				comment: true,
				createdAt: true,
				citizen: {
					select: { citizenProfile: { select: { fullName: true } } },
				},
			},
		}),
		prisma.feedback.count({ where }),
		prisma.feedback.aggregate({ where, _avg: { rating: true } }),
		prisma.feedback.groupBy({
			by: ["rating"],
			where,
			_count: { _all: true },
		}),
	]);

	const distribution: Record<string, number> = {
		"1": 0,
		"2": 0,
		"3": 0,
		"4": 0,
		"5": 0,
	};
	for (const g of groups) distribution[String(g.rating)] = g._count._all;

	return {
		summary: { average: avg._avg.rating ?? null, total, distribution },
		reviews: items.map((f) => ({
			id: f.id,
			rating: f.rating,
			comment: f.comment,
			createdAt: f.createdAt,
			// first name only, so public pages never expose full names
			reviewer: f.citizen.citizenProfile?.fullName?.split(" ")[0] ?? "Citizen",
		})),
	};
};

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = { deletedAt: null, isActive: true } as const;
const WITH_DEPT = {
	department: { select: { id: true, name: true } },
} as const;

// Same rating fields the explore page returns, so CategoryCard works unchanged.
const attachRatings = async <T extends { id: string }>(categories: T[]) => {
	const ids = categories.map((c) => c.id);

	const stats = ids.length
		? await prisma.$queryRaw<
				{ categoryId: string; avg: number; count: bigint }[]
			>`
        SELECT sr."categoryId" AS "categoryId",
               AVG(f.rating)::float8 AS avg,
               COUNT(*) AS count
        FROM feedbacks f
        JOIN service_requests sr ON sr.id = f."requestId"
        WHERE sr."categoryId" IN (${Prisma.join(ids)})
        GROUP BY sr."categoryId"
      `
		: [];

	const byCategory = new Map(stats.map((s) => [s.categoryId, s]));

	return categories.map((c) => {
		const stat = byCategory.get(c.id);
		return {
			...c,
			averageRating: stat ? Math.round(stat.avg * 10) / 10 : null,
			reviewCount: stat ? Number(stat.count) : 0,
		};
	});
};

// Most requested services in the last 30 days, skipping `exclude`.
const rankByPopularity = async (exclude: string[], limit: number) => {
	const groups = await prisma.serviceRequest.groupBy({
		by: ["categoryId"],
		where: {
			deletedAt: null,
			createdAt: { gte: new Date(Date.now() - 30 * DAY) },
			categoryId: { notIn: exclude },
		},
		_count: { _all: true },
		orderBy: { _count: { categoryId: "desc" } },
		take: limit * 3,
	});

	const counts = new Map(groups.map((g) => [g.categoryId, g._count._all]));

	const found = await prisma.category.findMany({
		where: { ...ACTIVE, id: { in: [...counts.keys()] } },
		include: WITH_DEPT,
	});

	const ranked = found
		.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
		.slice(0, limit)
		.map((c) => ({ ...c, requestCount: counts.get(c.id) ?? 0 }));

	// Not enough recent activity: fill with the newest active services.
	if (ranked.length < limit) {
		const filler = await prisma.category.findMany({
			where: {
				...ACTIVE,
				id: { notIn: [...exclude, ...ranked.map((r) => r.id)] },
			},
			include: WITH_DEPT,
			orderBy: { createdAt: "desc" },
			take: limit - ranked.length,
		});
		ranked.push(...filler.map((c) => ({ ...c, requestCount: 0 })));
	}

	return ranked;
};

const clampLimit = (n: number) => (n > 0 ? Math.min(n, 12) : 4);

const getTrendingCategories = async (limit?: number) => {
	const size = clampLimit(Number(limit));
	return attachRatings(await rankByPopularity([], size));
};

const getRecommendedCategories = async (userId: string, limit?: number) => {
	const size = clampLimit(Number(limit));

	const used = await prisma.serviceRequest.groupBy({
		by: ["categoryId"],
		where: { citizenId: userId, deletedAt: null },
		_count: { _all: true },
	});

	// New citizen: nothing to personalize on yet.
	if (used.length === 0) {
		return {
			reason: "Popular with citizens in your city",
			items: await attachRatings(await rankByPopularity([], size)),
		};
	}

	const usedIds = used.map((u) => u.categoryId);
	const usedCounts = new Map(used.map((u) => [u.categoryId, u._count._all]));

	const usedCategories = await prisma.category.findMany({
		where: { id: { in: usedIds } },
		select: { id: true, name: true, departmentId: true },
	});

	const top = [...usedCategories].sort(
		(a, b) => (usedCounts.get(b.id) ?? 0) - (usedCounts.get(a.id) ?? 0),
	)[0];
	const departmentIds = [...new Set(usedCategories.map((c) => c.departmentId))];

	// Services from the same departments that this citizen hasn't used yet.
	const related = await prisma.category.findMany({
		where: {
			...ACTIVE,
			id: { notIn: usedIds },
			departmentId: { in: departmentIds },
		},
		include: WITH_DEPT,
	});

	const popularity = related.length
		? await prisma.serviceRequest.groupBy({
				by: ["categoryId"],
				where: {
					deletedAt: null,
					categoryId: { in: related.map((r) => r.id) },
				},
				_count: { _all: true },
			})
		: [];
	const popMap = new Map(popularity.map((p) => [p.categoryId, p._count._all]));

	const items = related
		.map((c) => ({ ...c, requestCount: popMap.get(c.id) ?? 0 }))
		.sort((a, b) => b.requestCount - a.requestCount)
		.slice(0, size);

	if (items.length < size) {
		const more = await rankByPopularity(
			[...usedIds, ...items.map((i) => i.id)],
			size - items.length,
		);
		items.push(...more);
	}

	return {
		reason: `Because you used ${top?.name ?? "our services"}`,
		items: await attachRatings(items),
	};
};

export const CategoryService = {
	createCategory,
	getAllCategories,
	getSingleCategory,
	updateCategory,
	deleteCategory,
	getCategoryReviews,
	getTrendingCategories,
	getRecommendedCategories,
};
