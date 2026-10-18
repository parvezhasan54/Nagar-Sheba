import * as z from "zod";

const ChatZodSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().trim().min(1).max(1000),
			}),
		)
		.min(1)
		.max(12)
		.refine((m) => m[m.length - 1].role === "user", {
			message: "The last message must come from the user",
		}),
});

const SuggestCategoryZodSchema = z.object({
	text: z
		.string("Describe the problem")
		.trim()
		.min(10, "Please describe the problem in at least 10 characters")
		.max(1000),
});

export const aiValidationSchemas = { ChatZodSchema, SuggestCategoryZodSchema };
