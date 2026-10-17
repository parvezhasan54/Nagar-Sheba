export type TFeeType = "FREE" | "PAID";

export interface ICreateCategoryPayload {
	departmentId: string;
	name: string;
	description?: string;
	images?: string[];
	feeType: TFeeType;
	feeAmount?: number;
	slaHours: number;
}

export interface IUpdateCategoryPayload {
	name?: string;
	description?: string;
	images?: string[];
	feeType?: TFeeType;
	feeAmount?: number;
	slaHours?: number;
	isActive?: boolean;
}

export interface ICategoryQuery {
	page?: number;
	limit?: number;
	departmentId?: string;
	includeInactive?: boolean;
	search?: string;
	feeType?: TFeeType;
	maxSla?: number; // only services resolved within N hours
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
