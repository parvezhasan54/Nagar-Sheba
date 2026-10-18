import { Router } from "express";
import { contactLimiter } from "../../middleware/rateLimiter";
import { validateRequestBody } from "../../middleware/validateRequest";
import { PublicController } from "./public.controller";
import { publicValidationSchemas } from "./public.validation";

const router = Router();

router.get("/stats", PublicController.getStats);
router.post(
	"/contact",
	contactLimiter,
	validateRequestBody(publicValidationSchemas.ContactZodSchema),
	PublicController.sendContactMessage,
);

router.get("/resolved", PublicController.getResolvedIssues);
router.get("/testimonials", PublicController.getTestimonials);
router.post(
	"/subscribe",
	contactLimiter,
	validateRequestBody(publicValidationSchemas.SubscribeZodSchema),
	PublicController.subscribe,
);

export const PublicRoutes = router;
