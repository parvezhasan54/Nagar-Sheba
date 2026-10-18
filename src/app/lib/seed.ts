import bcrypt from "bcryptjs";
import { AccountStatus, Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "./prisma";

const SALT_ROUNDS = config.bcrypt_salt_rounds;

const ADMIN_EMAIL = config.admin.email;
const ADMIN_PASSWORD = config.admin.password;
const STAFF_PASSWORD = config.staff_password;

// Departments

const DEPARTMENTS = [
	{
		name: "Roads & Infrastructure",
		description: "Potholes, road damage, streetlights, footpaths",
	},
	{
		name: "Waste Management",
		description: "Garbage collection, illegal dumping, bin repairs",
	},
	{
		name: "Water Supply",
		description: "Water leakage, supply interruptions, drainage",
	},
	{
		name: "Licensing & Permits",
		description: "Trade licences, noise permits, tree-cutting permits",
	},
] as const;

// Categories

type CategorySeed = {
	department: (typeof DEPARTMENTS)[number]["name"];
	name: string;
	description: string;
	images: string[];
	feeType: "FREE" | "PAID";
	feeAmount?: number;
	slaHours: number;
};


const CATEGORIES: CategorySeed[] = [
  {
    department: "Roads & Infrastructure",
    name: "Pothole",
    description:
      "Report damaged road surfaces and potholes. A crew inspects the site and repairs it within the stated resolution time.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324638/nagar-sheba/services/pothole.jpg",
    ],
    feeType: "FREE",
    slaHours: 72,
  },
  {
    department: "Roads & Infrastructure",
    name: "Streetlight Outage",
    description:
      "Report streetlights that are dark, flickering, or damaged so the roads in your area stay safe at night.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324630/nagar-sheba/services/Streetlight%20Outage.jpg",
    ],
    feeType: "FREE",
    slaHours: 48,
  },
  {
    department: "Waste Management",
    name: "Missed Garbage Collection",
    description:
      "Tell us when scheduled waste collection was skipped in your street and we will dispatch a collection team.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324623/nagar-sheba/services/Missed%20Garbage%20Collection.jpg",
    ],
    feeType: "FREE",
    slaHours: 24,
  },
  {
    department: "Water Supply",
    name: "Water Leakage",
    description:
      "Report burst pipes and leaks in public water lines to reduce wastage and restore normal supply.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324634/nagar-sheba/services/Water%20Leakage.jpg",
    ],
    feeType: "FREE",
    slaHours: 24,
  },
  {
    department: "Licensing & Permits",
    name: "Trade Licence Renewal",
    description:
      "Renew your annual trade licence online. Pay the fee securely and track the approval until it is issued.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324632/nagar-sheba/services/Trade%20Licence%20Renewal.jpg",
    ],
    feeType: "PAID",
    feeAmount: 1500,
    slaHours: 168,
  },
  {
    department: "Licensing & Permits",
    name: "Noise Permit",
    description:
      "Apply for a temporary permit to use sound equipment at weddings, events, and community gatherings.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324624/nagar-sheba/services/Noise%20Permit.jpg",
    ],
    feeType: "PAID",
    feeAmount: 800,
    slaHours: 120,
  },
  {
    department: "Licensing & Permits",
    name: "Tree Cutting Permit",
    description:
      "Request approval to remove a damaged or dangerous tree safely, with an officer’s review.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324632/nagar-sheba/services/Tree%20Cutting%20Permit.jpg",
    ],
    feeType: "PAID",
    feeAmount: 500,
    slaHours: 96,
  },
  {
    department: "Roads & Infrastructure",
    name: "Broken Footpath",
    description:
      "Report cracked, uneven or collapsed footpaths that are unsafe for pedestrians.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324637/nagar-sheba/services/broken%20Footpath.jpg",
    ],
    feeType: "FREE",
    slaHours: 96,
  },
  {
    department: "Roads & Infrastructure",
    name: "Damaged Traffic Signal",
    description:
      "Report traffic signals that are not working or show the wrong sequence at a junction.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324618/nagar-sheba/services/Damaged%20Traffic%20Signal.jpg",
    ],
    feeType: "FREE",
    slaHours: 24,
  },
  {
    department: "Waste Management",
    name: "Illegal Dumping",
    description:
      "Report waste dumped in public places so a clean-up crew can remove it.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324622/nagar-sheba/services/Illegal%20Dumping.jpg",
    ],
    feeType: "FREE",
    slaHours: 48,
  },
  {
    department: "Waste Management",
    name: "Dead Animal Removal",
    description:
      "Request prompt removal of dead animals from roads and public spaces.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324619/nagar-sheba/services/Dead%20Animal%20Removal.jpg",
    ],
    feeType: "FREE",
    slaHours: 12,
  },
  {
    department: "Water Supply",
    name: "Drain Blockage",
    description:
      "Report blocked drains that cause waterlogging in your street or neighbourhood.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324621/nagar-sheba/services/Drain%20Blockage.jpg",
    ],
    feeType: "FREE",
    slaHours: 48,
  },
  {
    department: "Water Supply",
    name: "Sewage Overflow",
    description:
      "Report overflowing sewage lines that create a health hazard in public areas.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324626/nagar-sheba/services/Sewage%20Overflow.jpg",
    ],
    feeType: "FREE",
    slaHours: 24,
  },
  {
    department: "Licensing & Permits",
    name: "Signboard Permit",
    description:
      "Apply for approval to install a business signboard on or near a public road.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324628/nagar-sheba/services/Signboard%20Permit.jpg",
    ],
    feeType: "PAID",
    feeAmount: 1200,
    slaHours: 120,
  },
  {
    department: "Licensing & Permits",
    name: "Street Vending Permit",
    description:
      "Apply for a permit to operate a vending stall in an approved public location.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324629/nagar-sheba/services/Street%20Vending%20Permit.jpg",
    ],
    feeType: "PAID",
    feeAmount: 600,
    slaHours: 96,
  },
  {
    department: "Licensing & Permits",
    name: "Road Cutting Permit",
    description:
      "Request permission to cut a public road for utility or construction work.",
    images: [
      "https://res.cloudinary.com/kgsnvyd3/image/upload/v1792324625/nagar-sheba/services/Road%20Cutting%20Permit.jpg",
    ],
    feeType: "PAID",
    feeAmount: 2500,
    slaHours: 168,
  },
];
// Staff

const STAFF = [
	{
		email: "staff.roads@nagar-sheba.com",
		fullName: "Rahim Uddin",
		title: "Field Technician",
		department: "Roads & Infrastructure",
	},
	{
		email: "staff.waste@nagar-sheba.com",
		fullName: "Karim Ahmed",
		title: "Sanitation Officer",
		department: "Waste Management",
	},
	{
		email: "staff.water@nagar-sheba.com",
		fullName: "Nusrat Jahan",
		title: "Water Supply Inspector",
		department: "Water Supply",
	},
	{
		email: "staff.licensing@nagar-sheba.com",
		fullName: "Farhana Islam",
		title: "Licensing Officer",
		department: "Licensing & Permits",
	},
] as const;

// Seed

export const seed = async (): Promise<void> => {
	console.log(" Starting Nagar-Sheba database seed...");

	const tx = prisma; // no longer wrapped in an interactive transaction

	{
		// 1. Departments
		const departmentIdByName = new Map<string, string>();

		for (const department of DEPARTMENTS) {
			const record = await tx.department.upsert({
				where: {
					name: department.name,
				},
				update: {
					description: department.description,
				},
				create: {
					name: department.name,
					description: department.description,
				},
			});

			departmentIdByName.set(department.name, record.id);
		}

		// 2. Categories

		for (const category of CATEGORIES) {
			const departmentId = departmentIdByName.get(category.department);

			if (!departmentId) {
				throw new Error(`Department not found: ${category.department}`);
			}

			await tx.category.upsert({
				where: {
					departmentId_name: {
						departmentId,
						name: category.name,
					},
				},
				update: {
					description: category.description,
					// only overwrite images when the seed has some,
					// so re-seeding never wipes images an admin added
					...(category.images.length > 0 ? { images: category.images } : {}),
					feeType: category.feeType,
					feeAmount: category.feeType === "PAID" ? category.feeAmount : null,
					slaHours: category.slaHours,
				},
				create: {
					departmentId,
					name: category.name,
					description: category.description,
					images: category.images,
					feeType: category.feeType,
					feeAmount: category.feeType === "PAID" ? category.feeAmount : null,
					slaHours: category.slaHours,
				},
			});
		}

		// 3. Admin

		const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

		await tx.user.upsert({
			where: { email: ADMIN_EMAIL },
			update: {
				passwordHash: adminPasswordHash,
				role: Role.ADMIN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
				mustChangePassword: false,
			},
			create: {
				email: ADMIN_EMAIL,
				passwordHash: adminPasswordHash,
				role: Role.ADMIN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
				mustChangePassword: false,
				adminProfile: {
					create: { fullName: "Nagar-Sheba Platform Admin" },
				},
			},
		});

		// 3b. Demo admin (only seeded when a password is configured)
		if (config.demo_admin.password) {
			const demoAdminHash = await bcrypt.hash(
				config.demo_admin.password,
				SALT_ROUNDS,
			);

			await tx.user.upsert({
				where: { email: config.demo_admin.email },
				update: {
					passwordHash: demoAdminHash,
					role: Role.ADMIN,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
				},
				create: {
					email: config.demo_admin.email,
					passwordHash: demoAdminHash,
					role: Role.ADMIN,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
					adminProfile: {
						create: { fullName: "Demo Administrator" },
					},
				},
			});
		}

		// 4. Staff

		const staffPasswordHash = await bcrypt.hash(STAFF_PASSWORD, SALT_ROUNDS);

		for (const staff of STAFF) {
			const departmentId = departmentIdByName.get(staff.department);

			if (!departmentId) {
				throw new Error(`Department not found: ${staff.department}`);
			}

			await tx.user.upsert({
				where: { email: staff.email },
				update: {
					passwordHash: staffPasswordHash,
					role: Role.STAFF,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
					staffProfile: {
						upsert: {
							create: {
								departmentId,
								fullName: staff.fullName,
								title: staff.title,
							},
							update: {
								departmentId,
								fullName: staff.fullName,
								title: staff.title,
							},
						},
					},
				},
				create: {
					email: staff.email,
					passwordHash: staffPasswordHash,
					role: Role.STAFF,
					status: AccountStatus.ACTIVE,
					isEmailVerified: true,
					mustChangePassword: false,
					staffProfile: {
						create: {
							departmentId,
							fullName: staff.fullName,
							title: staff.title,
						},
					},
				},
			});
		}

		// 5. Demo citizen

		const citizenHash = await bcrypt.hash(
			config.demo_citizen.password,
			SALT_ROUNDS,
		);

		await tx.user.upsert({
			where: { email: config.demo_citizen.email },
			update: {
				passwordHash: citizenHash,
				role: Role.CITIZEN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
			},
			create: {
				email: config.demo_citizen.email,
				passwordHash: citizenHash,
				role: Role.CITIZEN,
				status: AccountStatus.ACTIVE,
				isEmailVerified: true,
				citizenProfile: {
					create: {
						fullName: "Demo Citizen",
						phone: "01700000001",
						address: "Agrabad, Chattogram",
					},
				},
			},
		});
	}

	console.log(
		` Nagar-Sheba seed completed successfully. ` +
			`${DEPARTMENTS.length} departments, ` +
			`${CATEGORIES.length} categories, ` +
			`1 admin, ${STAFF.length} staff.`,
	);
};
