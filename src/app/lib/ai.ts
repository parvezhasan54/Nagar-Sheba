import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../errors/AppError";

export type TAiMessage = { role: "user" | "model"; text: string };

export const generateText = async (
	system: string,
	messages: TAiMessage[],
	json = false,
): Promise<string> => {
	if (!config.ai.api_key) {
		throw new AppError(httpStatus.SERVICE_UNAVAILABLE, "AI is not configured");
	}

	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${config.ai.model}:generateContent?key=${config.ai.api_key}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: system }] },
				contents: messages.map((m) => ({
					role: m.role,
					parts: [{ text: m.text }],
				})),
				generationConfig: {
					temperature: 0.3,
					maxOutputTokens: 600,
					...(json ? { responseMimeType: "application/json" } : {}),
				},
			}),
		},
	);

	if (!res.ok) {
		throw new AppError(httpStatus.BAD_GATEWAY, "AI service unavailable");
	}

	const data = await res.json();
	return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};