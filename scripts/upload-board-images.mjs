#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) throw new Error(".env not found");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

const UPLOADS = [
  {
    file: "Founder:President- Busayo Disu.jpeg",
    publicId: "busayo-disu",
    role: "Founder/President",
    name: "Busayo Disu",
  },
  {
    file: "Tresurer- Bose Osa-Izeko.jpeg",
    publicId: "bose-osa-izeko",
    role: "Treasurer",
    name: "Bose Osa-Izeko",
  },
  {
    file: "director-Omoniyi Fabarebo.jpeg",
    publicId: "omoniyi-fabarebo",
    role: "Director",
    name: "Omoniyi Fabarebo",
  },
  {
    file: "Director at Large-Kayode Disu.jpeg",
    publicId: "kayode-disu",
    role: "Director at Large",
    name: "Kayode Disu",
  },
  {
    file: "Director at Large-Temitope Haastrup.jpeg",
    publicId: "temitope-haastrup",
    role: "Director at Large",
    name: "Temitope Haastrup",
  },
];

async function uploadImage({ file, publicId }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary env vars");
  }

  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${file}`);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "asosc/board";
  const paramsToSign = { folder, public_id: publicId, timestamp };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Upload failed for ${file}`);
  }
  return data;
}

async function main() {
  loadEnv();
  const results = [];

  for (const item of UPLOADS) {
    const data = await uploadImage(item);
    results.push({
      ...item,
      secure_url: data.secure_url,
      version: data.version,
    });
    console.log(`Uploaded ${item.name}: ${data.secure_url}`);
  }

  fs.writeFileSync(
    path.join(ROOT, "scripts/.board-upload-results.json"),
    JSON.stringify(results, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
