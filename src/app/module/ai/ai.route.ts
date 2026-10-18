import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { aiLimiter } from "../../middleware/rateLimiter";
import { validateRequestBody } from "../../middleware/validateRequest";
import { AiController } from "./ai.controller";
import { aiValidationSchemas } from "./ai.validation";

const router = Router();

router.post(
	"/chat",
	aiLimiter,
	validateRequestBody(aiValidationSchemas.ChatZodSchema),
	AiController.chat,
);

router.post(
	"/suggest-category",
	aiLimiter,
	auth(Role.CITIZEN),
	validateRequestBody(aiValidationSchemas.SuggestCategoryZodSchema),
	AiController.suggestCategory,
);

router.get("/search-suggest", aiLimiter, AiController.searchSuggest);
router.get("/admin-insights", auth(Role.ADMIN), AiController.getAdminInsights);

export const AiRoutes = router;
