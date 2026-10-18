import httpStatus from "http-status";
import { AppError } from "../../errors/AppError";
import { generateText } from "../../lib/ai";
import { prisma } from "../../lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

const loadCatalog = () =>
	prisma.category.findMany({
		where: { deletedAt: null, isActive: true },
		select: {
			id: true,
			name: true,
			description: true,
			feeType: true,
			feeAmount: true,
			slaHours: true,
			department: { select: { name: true } },
		},
	});

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

// Keyword fallback so the feature still works if the AI provider is down.
const rank = (text: string, catalog: Catalog) => {
	const words = text
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length > 2);
	return catalog
		.map((c) => {
			const hay =
				`${c.name} ${c.description ?? ""} ${c.department.name}`.toLowerCase();
			return { c, score: words.filter((w) => hay.includes(w)).length };
		})
		.sort((a, b) => b.score - a.score);
};

// 1) CHAT ASSISTANT
const chat = async (messages: { role: "user" | "assistant"; content: string }[]) => {
	const catalog = await loadCatalog();
	const services = catalog
		.map(
			(c) =>
				`- ${c.name} (${c.department.name}): ${
					c.feeType === "PAID" ? `BDT ${c.feeAmount}` : "free"
				}, resolved within ${c.slaHours} hours`,
		)
		.join("\n");

	const system = `You are the Nagar Sheba assistant, a city service platform in Chattogram, Bangladesh.
Answer only about this platform. Be short (max 4 sentences) and practical.
Facts: citizens file requests (up to 5 photos, 5 MB each); paid services are paid via SSLCommerz or bKash;
the SLA clock starts when a request is assigned; a resolved request can be reopened within 3 days, then it auto-closes;
cancelling a paid request triggers an automatic refund; tracking refs look like NS-2026-000001.
If asked something unrelated or unknown, say you can only help with Nagar Sheba services.
Available services:\n${services}`;

	try {
		const reply = await generateText(
			system,
			messages.map((m) => ({
				role: m.role === "user" ? ("user" as const) : ("model" as const),
				text: m.content,
			})),
		);
		if (reply.trim()) return { reply: reply.trim() };
	} catch (error) {
		console.error("[AI chat] failed:", error);
	}

	const last = messages[messages.length - 1].content;
	const top = rank(last, catalog)
		.filter((r) => r.score > 0)
		.slice(0, 3);
	return {
		reply: top.length
			? `These services may help: ${top.map((t) => t.c.name).join(", ")}. Open the Services page for fees and deadlines.`
			: "The assistant is busy right now. Please browse the Services page or use the Contact page.",
	};
};

// 2) AI SERVICE PICKER
const suggestCategory = async (text: string) => {
	const catalog = await loadCatalog();
	const list = catalog
		.map(
			(c) => `${c.id} | ${c.name} | ${c.department.name} | ${c.description ?? ""}`,
		)
		.join("\n");

	try {
		const raw = await generateText(
			`Choose the single best service for the citizen's problem. Use ONLY an id from the list.
Reply as JSON: {"categoryId": "<id>", "reason": "<one short sentence>"}`,
			[{ role: "user", text: `Services:\n${list}\n\nProblem: ${text}` }],
			true,
		);
		const parsed = JSON.parse(raw);
		const match = catalog.find((c) => c.id === parsed.categoryId);
		if (match) {
			return {
				categoryId: match.id,
				name: match.name,
				reason: String(parsed.reason ?? "").slice(0, 200),
				source: "ai" as const,
			};
		}
	} catch (error) {
		console.error("[AI suggest] failed:", error);
	}

	const best = rank(text, catalog)[0];
	if (!best || best.score === 0) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"No matching service found. Please choose one manually.",
		);
	}
	return {
		categoryId: best.c.id,
		name: best.c.name,
		reason: "Matched by keywords in your description.",
		source: "keyword" as const,
	};
};

// 3) ADMIN ANOMALY DETECTION + SUMMARY
type Anomaly = { severity: "high" | "medium"; title: string; detail: string };

const getAdminInsights = async () => {
	const now = Date.now();
	const [recent, departments, totals, overdue, rating, refundFails] =
		await Promise.all([
			prisma.serviceRequest.findMany({
				where: { deletedAt: null, createdAt: { gte: new Date(now - 14 * DAY) } },
				select: { createdAt: true },
			}),
			prisma.department.findMany({
				where: { deletedAt: null },
				select: { id: true, name: true },
			}),
			prisma.serviceRequest.groupBy({
				by: ["departmentId"],
				where: { deletedAt: null },
				_count: { _all: true },
			}),
			prisma.serviceRequest.groupBy({
				by: ["departmentId"],
				where: { deletedAt: null, isOverdue: true },
				_count: { _all: true },
			}),
			prisma.feedback.aggregate({
				where: { createdAt: { gte: new Date(now - 30 * DAY) } },
				_avg: { rating: true },
				_count: { _all: true },
			}),
			prisma.auditLog.count({
				where: {
					action: "PAYMENT_REFUND_FAILED",
					createdAt: { gte: new Date(now - 7 * DAY) },
				},
			}),
		]);

	const anomalies: Anomaly[] = [];

	// Volume spike: last 24h vs average of the 13 days before
	const last24 = recent.filter((r) => r.createdAt.getTime() >= now - DAY).length;
	const prevAvg = (recent.length - last24) / 13;
	if (last24 >= 5 && last24 > prevAvg * 2) {
		anomalies.push({
			severity: "medium",
			title: "Unusual request volume",
			detail: `${last24} requests in the last 24h, versus a daily average of ${prevAvg.toFixed(1)}.`,
		});
	}

	// Department overdue ratio
	for (const d of departments) {
		const total = totals.find((t) => t.departmentId === d.id)?._count._all ?? 0;
		const late = overdue.find((t) => t.departmentId === d.id)?._count._all ?? 0;
		if (total >= 5 && late / total > 0.3) {
			anomalies.push({
				severity: late / total > 0.5 ? "high" : "medium",
				title: `${d.name}: high overdue rate`,
				detail: `${late} of ${total} requests (${Math.round((late / total) * 100)}%) are overdue.`,
			});
		}
	}

	if (rating._count._all >= 3 && (rating._avg.rating ?? 5) < 3) {
		anomalies.push({
			severity: "high",
			title: "Citizen satisfaction is low",
			detail: `Average rating is ${rating._avg.rating?.toFixed(1)}/5 over ${rating._count._all} reviews in 30 days.`,
		});
	}

	if (refundFails > 0) {
		anomalies.push({
			severity: "high",
			title: "Failed refunds need attention",
			detail: `${refundFails} refund attempt(s) failed in the last 7 days. Retry them from Payments.`,
		});
	}

	let summary: string | null = null;
	try {
		summary = (
			await generateText(
				"You are an operations analyst for a city service platform. In max 3 sentences, summarise the findings for an administrator and name the first action to take. If there are no findings, say operations look healthy.",
				[
					{
						role: "user",
						text: `Findings: ${JSON.stringify(anomalies)}. Requests in last 24h: ${last24}.`,
					},
				],
			)
		).trim();
	} catch (error) {
		console.error("[AI insights] summary failed:", error);
	}

	return { anomalies, summary };
};

export const AiService = { chat, suggestCategory, getAdminInsights };