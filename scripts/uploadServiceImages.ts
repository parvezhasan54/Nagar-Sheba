import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import cloudinary from "../src/app/lib/cloudinary";

const dir = path.join(process.cwd(), "seed-images");
const out: Record<string, string> = {};

for (const file of fs.readdirSync(dir)) {
	const res = await cloudinary.uploader.upload(path.join(dir, file), {
		folder: "nagar-sheba/services",
		public_id: path.parse(file).name,
		overwrite: true,
	});
	out[path.parse(file).name] = res.secure_url;
}
console.log(JSON.stringify(out, null, 2));