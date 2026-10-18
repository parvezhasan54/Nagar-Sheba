
import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
} from "../../utils/uploadToCloudinary";
import { IRequestUser } from "../auth/auth.interface";
import {
  ICreateDepartmentPayload,
  IDepartmentQuery,
  IUpdateDepartmentPayload,
} from "./department.interface";

const FOLDER = "nagar-sheba/departments";

// Create a new department
const createDepartment = async (
  payload: ICreateDepartmentPayload,
  actor: IRequestUser,
  file?: Express.Multer.File,
) => {
  const existingDepartment = await prisma.department.findUnique({
    where: { name: payload.name },
  });

  if (existingDepartment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A department with this name already exists",
    );
  }

  const image = file
    ? await uploadBufferToCloudinary(file.buffer, FOLDER)
    : null;

  try {
    const [department] = await prisma.$transaction([
      prisma.department.create({
        data: {
          name: payload.name,
          description: payload.description,
          imageUrl: image?.secure_url,
          imagePublicId: image?.public_id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "DEPARTMENT_CREATED",
          entityType: "Department",
          entityId: "",
          previousValue: undefined,
          newValue: {
            name: payload.name,
            description: payload.description,
            imageUrl: image?.secure_url ?? null,
          },
        },
      }),
    ]);

    return department;
  } catch (error) {
    if (image?.public_id) {
      await deleteFromCloudinary(image.public_id).catch(() => undefined);
    }

    throw error;
  }
};

// Get all departments (paginated)
const getAllDepartments = async (
  query: IDepartmentQuery,
  requesterRole?: Role,
) => {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 10;
  const skip = (page - 1) * limit;

  // Only an admin may request soft-deleted departments.
  const includeInactive =
    requesterRole === Role.ADMIN && !!query.includeInactive;

  const search = query.search?.trim();

  const where: Prisma.DepartmentWhereInput = {
    ...(!includeInactive || query.status === "active"
      ? { deletedAt: null }
      : query.status === "deleted"
        ? { deletedAt: { not: null } }
        : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" } }
      : {}),
  };

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.count({ where }),
  ]);

  return {
    data: departments,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// Get a single department
const getSingleDepartment = async (id: string) => {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department || department.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  return department;
};

// Update department details
const updateDepartment = async (
  id: string,
  payload: IUpdateDepartmentPayload,
  actor: IRequestUser,
) => {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department || department.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  if (payload.name && payload.name !== department.name) {
    const nameTaken = await prisma.department.findUnique({
      where: { name: payload.name },
    });

    if (nameTaken) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "A department with this name already exists",
      );
    }
  }

  const previousValue = {
    name: department.name,
    description: department.description,
  };

  const [updated] = await prisma.$transaction([
    prisma.department.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "DEPARTMENT_UPDATED",
        entityType: "Department",
        entityId: id,
        previousValue,
        newValue: JSON.parse(JSON.stringify(payload)),
      },
    }),
  ]);

  return updated;
};

// Update department image
const updateDepartmentImage = async (
  id: string,
  file: Express.Multer.File,
  actor: IRequestUser,
) => {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department || department.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const image = await uploadBufferToCloudinary(file.buffer, FOLDER);

  let updated;

  try {
    [updated] = await prisma.$transaction([
      prisma.department.update({
        where: { id },
        data: {
          imageUrl: image.secure_url,
          imagePublicId: image.public_id,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "DEPARTMENT_IMAGE_UPDATED",
          entityType: "Department",
          entityId: id,
          previousValue: {
            imageUrl: department.imageUrl,
          },
          newValue: {
            imageUrl: image.secure_url,
          },
        },
      }),
    ]);
  } catch (error) {
    await deleteFromCloudinary(image.public_id).catch(() => undefined);
    throw error;
  }

  // Remove the old image only after the database update succeeds.
  if (
    department.imagePublicId &&
    department.imagePublicId !== image.public_id
  ) {
    await deleteFromCloudinary(department.imagePublicId).catch(() => undefined);
  }

  return updated;
};

// Soft-delete department
const deleteDepartment = async (id: string, actor: IRequestUser) => {
  const department = await prisma.department.findUnique({
    where: { id },
  });

  if (!department || department.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const [categories, staff, openRequests] = await Promise.all([
    prisma.category.count({
      where: {
        departmentId: id,
        deletedAt: null,
      },
    }),
    prisma.staffProfile.count({
      where: {
        departmentId: id,
      },
    }),
    prisma.serviceRequest.count({
      where: {
        departmentId: id,
        deletedAt: null,
        status: {
          in: ["PENDING_PAYMENT", "SUBMITTED", "ASSIGNED", "IN_PROGRESS"],
        },
      },
    }),
  ]);

  if (categories || staff || openRequests) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot delete: ${categories} active categories, ${staff} staff, ${openRequests} open requests still belong to this department`,
    );
  }

  const deletedAt = new Date();

  const [deleted] = await prisma.$transaction([
    prisma.department.update({
      where: { id },
      data: { deletedAt },
    }),
    prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "DEPARTMENT_DELETED",
        entityType: "Department",
        entityId: id,
        previousValue: { deletedAt: null },
        newValue: { deletedAt },
      },
    }),
  ]);

  return deleted;
};

export const DepartmentService = {
  createDepartment,
  getAllDepartments,
  getSingleDepartment,
  updateDepartment,
  updateDepartmentImage,
  deleteDepartment,
};
