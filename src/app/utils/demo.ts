import config from "../config";

export const DEMO_EMAILS = [
	config.demo_admin.email,
	config.demo_citizen.email,
	"staff.roads@nagar-sheba.com",
	"staff.waste@nagar-sheba.com",
	"staff.water@nagar-sheba.com",
	"staff.licensing@nagar-sheba.com",
].map((e) => e.toLowerCase());

export const isDemoEmail = (email?: string) =>
	!!email && DEMO_EMAILS.includes(email.toLowerCase());
