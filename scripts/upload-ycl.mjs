#!/usr/bin/env node
/**
 * Optimizes ycl/* images to WebP and uploads to Cloudinary
 * folder: asosc/gallery-prev/youth-creative-lab
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "ycl");
const OUT_DIR = path.join(ROOT, "ycl", ".optimized");
const FOLDER = "asosc/gallery-prev/youth-creative-lab";
const QUALITY = 75;
const MAX_WIDTH = 1600;

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

async function optimizeFile(absInput, absOutput) {
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });
  let pipeline = sharp(absInput).rotate();
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  await pipeline.webp({ quality: QUALITY, effort: 6 }).toFile(absOutput);
  const outMeta = await sharp(absOutput).metadata();
  return {
    width: outMeta.width ?? meta.width ?? 1,
    height: outMeta.height ?? meta.height ?? 1,
    inSize: fs.statSync(absInput).size,
    outSize: fs.statSync(absOutput).size,
  };
}

async function uploadWebp({ absPath, publicId }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary env vars");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: FOLDER, public_id: publicId, timestamp };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(absPath)]), path.basename(absPath));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", FOLDER);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Upload failed for ${publicId}`);
  }
  return data;
}

async function main() {
  loadEnv();

  const sources = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (sources.length === 0) throw new Error(`No images found in ${SOURCE_DIR}`);

  const results = [];

  for (let i = 0; i < sources.length; i++) {
    const file = sources[i];
    const absInput = path.join(SOURCE_DIR, file);
    const publicId = `ycl-2025-${i + 1}`;
    const absWebp = path.join(OUT_DIR, `${publicId}.webp`);

    const opt = await optimizeFile(absInput, absWebp);
    console.log(
      `Optimized ${file}: ${(opt.inSize / 1024).toFixed(0)}KB → ${(opt.outSize / 1024).toFixed(0)}KB (${opt.width}x${opt.height})`,
    );

    const data = await uploadWebp({ absPath: absWebp, publicId });
    results.push({
      file,
      publicId,
      width: opt.width,
      height: opt.height,
      ratio: opt.width / opt.height,
      secure_url: data.secure_url,
      version: data.version,
      public_id: data.public_id,
    });
    console.log(`Uploaded ${publicId}: ${data.secure_url}`);
  }

  const outJson = path.join(ROOT, "scripts/.ycl-upload-results.json");
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outJson}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
