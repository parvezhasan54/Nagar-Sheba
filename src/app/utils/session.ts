import { redisClient } from "../lib/redis";

const key = (id: string) => `auth:revoked-at:${id}`;

export const revokeSessions = (userId: string) =>
	redisClient.set(key(userId), String(Math.floor(Date.now() / 1000)), {
		expiration: { type: "EX", value: 7 * 24 * 3600 },
	});

// Tokens issued before the revoke timestamp are rejected.
export const isRevoked = async (userId: string, iat?: number) => {
	const v = await redisClient.get(key(userId));
	return !!v && (iat ?? 0) < Number(v);
};