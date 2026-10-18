import config from "../../config";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";

const getStats = async () => {
	const [totalRequests, resolvedRequests, departments, categories, rating] =
		await Promise.all([
			prisma.serviceRequest.count({ where: { deletedAt: null } }),
			prisma.serviceRequest.count({
				where: { deletedAt: null, status: { in: ["RESOLVED", "CLOSED"] } },
			}),
			prisma.department.count({ where: { deletedAt: null } }),
			prisma.category.count({ where: { deletedAt: null, isActive: true } }),
			prisma.feedback.aggregate({ _avg: { rating: true } }),
		]);

	return {
		totalRequests,
		resolvedRequests,
		departments,
		categories,
		averageRating: rating._avg.rating ?? null,
	};
};

const sendContactMessage = async (payload: {
	name: string;
	email: string;
	subject: string;
	message: string;
}) => {
	await sendMail({
		to: config.mail.contact_to,
		replyTo: payload.email,
		subject: `[Nagar Sheba Contact] ${payload.subject}`,
		text: `From: ${payload.name} <${payload.email}>\n\n${payload.message}`,
	});
	return null;
};

const getResolvedIssues = async () => {
	const items = await prisma.serviceRequest.findMany({
		where: {
			deletedAt: null,
			status: { in: ["RESOLVED", "CLOSED"] },
			resolvedAt: { not: null },
		},
		orderBy: { resolvedAt: "desc" },
		take: 4,
		select: {
			id: true,
			title: true,
			address: true,
			createdAt: true,
			resolvedAt: true,
			category: { select: { name: true } },
			department: { select: { name: true } },
		},
	});

	return items.map((r) => ({
		id: r.id,
		title: r.title,
		category: r.category.name,
		department: r.department.name,
		// last address segment only (city/area), never the full street address
		area: r.address.split(",").pop()?.trim() || "Chattogram",
		resolvedAt: r.resolvedAt,
		hoursToResolve: Math.max(
			1,
			Math.round((r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000),
		),
	}));
};

const getTestimonials = async () => {
	// Latest reviews that have a comment. No rating filter, so the list stays honest.
	const items = await prisma.feedback.findMany({
		where: { comment: { not: null } },
		orderBy: { createdAt: "desc" },
		take: 6,
		select: {
			id: true,
			rating: true,
			comment: true,
			createdAt: true,
			citizen: { select: { citizenProfile: { select: { fullName: true } } } },
			request: { select: { category: { select: { name: true } } } },
		},
	});

	return items.map((f) => ({
		id: f.id,
		rating: f.rating,
		comment: f.comment,
		createdAt: f.createdAt,
		reviewer: f.citizen.citizenProfile?.fullName?.split(" ")[0] ?? "Citizen",
		service: f.request.category.name,
	}));
};

const subscribe = async (email: string) => {
	await Promise.all([
		sendMail({
			to: email,
			subject: "You're subscribed to Nagar Sheba updates",
			text: "Thanks for subscribing. You will receive service updates and guides from Nagar Sheba.",
		}),
		sendMail({
			to: config.mail.contact_to,
			subject: "[Nagar Sheba] New newsletter subscriber",
			text: `New subscriber: ${email}`,
		}),
	]);
	return null;
};

export const PublicService = {
	getStats,
	sendContactMessage,
	getResolvedIssues,
	getTestimonials,
	subscribe,
};
