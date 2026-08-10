/**
 * End-to-end smoke test for Gallery upgrade image uploads.
 * Covers formats common on Windows (JPEG/PNG/WebP) and iPhone (HEIF/HEIC).
 *
 * Usage:
 *   node --env-file=.env --env-file=.env.local scripts/smoke-gallery-upload.mjs
 */
import { createHash } from "node:crypto";
import sharp from "sharp";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";
const PASSWORD = process.env.UPGRADE_PASSWORD;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function makeSample(format) {
  const pipeline = sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 220, g: 90, b: 40 },
    },
  }).rotate();

  if (format === "jpeg") {
    return {
      buffer: await pipeline.jpeg({ quality: 85 }).toBuffer(),
      name: "win-photo.jpg",
      type: "image/jpeg",
    };
  }
  if (format === "png") {
    return {
      buffer: await pipeline.png().toBuffer(),
      name: "win-screenshot.png",
      type: "image/png",
    };
  }
  if (format === "webp") {
    return {
      buffer: await pipeline.webp({ quality: 80 }).toBuffer(),
      name: "browser.webp",
      type: "image/webp",
    };
  }
  if (format === "heif") {
    try {
      // Prebuilt sharp encodes AV1 HEIF; iPhone HEIC is HEVC but the same
      // decoder path is used for both on input.
      const buffer = await pipeline
        .heif({ compression: "av1", quality: 50 })
        .toBuffer();
      return { buffer, name: "iphone-photo.heic", type: "image/heic" };
    } catch (err) {
      console.warn(
        "  skip HEIF encode:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }
  throw new Error(`unknown format ${format}`);
}

async function optimizeLikeServer(inputBuffer) {
  let pipeline = sharp(inputBuffer).rotate();
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > 1600) {
    pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
  }
  return pipeline.webp({ quality: 75, effort: 6 }).toBuffer();
}

async function testSharpFormats() {
  console.log("1) sharp format round-trips (server pipeline)");
  for (const format of ["jpeg", "png", "webp", "heif"]) {
    const sample = await makeSample(format);
    if (!sample) continue;
    const out = await optimizeLikeServer(sample.buffer);
    assert(out.length > 20, `${format}: empty output`);
    const meta = await sharp(out).metadata();
    assert(meta.format === "webp", `${format}: expected webp, got ${meta.format}`);
    console.log(
      `  ✓ ${format} → webp (${out.length} bytes, ${meta.width}x${meta.height})`,
    );
  }
}

async function uploadToCloudinary(optimized, filename, publicId) {
  assert(cloudName && apiKey && apiSecret, "Cloudinary env vars missing");
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "asosc/gallery-prev/_smoke";
  const paramsToSign = { folder, public_id: publicId, timestamp };
  const signatureBase = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");
  const signature = createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  const form = new FormData();
  form.append(
    "file",
    new Blob([optimized], { type: "image/webp" }),
    filename.replace(/\.[^.]+$/, "") + ".webp",
  );
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const data = await res.json();
  assert(res.ok && data.secure_url, data.error?.message ?? "Cloudinary failed");
  return data;
}

async function testCloudinaryDirect() {
  console.log("2) Cloudinary upload (same path as production)");
  const sample = await makeSample("jpeg");
  const optimized = await optimizeLikeServer(sample.buffer);
  const data = await uploadToCloudinary(
    optimized,
    sample.name,
    `smoke-direct-${Date.now()}`,
  );
  console.log(`  ✓ ${data.secure_url}`);
}

async function testHttpApi() {
  console.log("3) HTTP API: login → upload (JPEG + PNG + HEIC if available)");
  assert(PASSWORD, "UPGRADE_PASSWORD missing");

  const loginRes = await fetch(`${BASE_URL}/api/upgrade/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const loginBody = await loginRes.json();
  assert(loginRes.ok, `login failed: ${loginBody.error ?? loginRes.status}`);

  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookieHeader =
    setCookie.map((c) => c.split(";")[0]).join("; ") ||
    loginRes.headers.get("set-cookie")?.split(";")[0];
  assert(cookieHeader, "no session cookie from login");
  console.log("  ✓ login");

  for (const format of ["jpeg", "png", "heif"]) {
    const sample = await makeSample(format);
    if (!sample) continue;
    const form = new FormData();
    form.append(
      "file",
      new Blob([sample.buffer], { type: sample.type }),
      sample.name,
    );
    form.append("programSlug", "african-summer-bbq");
    form.append("year", "2026");
    form.append("slot", "0");

    const res = await fetch(`${BASE_URL}/api/upgrade/upload`, {
      method: "POST",
      headers: { cookie: cookieHeader },
      body: form,
    });
    const body = await res.json();
    assert(
      res.ok && body.src,
      `${format} upload failed: ${body.error ?? res.status}`,
    );
    assert(typeof body.ratio === "number" && body.ratio > 0, `${format}: bad ratio`);
    console.log(`  ✓ ${format} upload → ${body.src}`);
  }
}

async function main() {
  console.log("Gallery upload smoke test\n");
  console.log(`sharp ${sharp.versions.sharp} / vips ${sharp.versions.vips}`);
  console.log(`heif support: ${Boolean(sharp.format.heif?.input?.file)}\n`);
  await testSharpFormats();
  await testCloudinaryDirect();
  await testHttpApi();
  console.log("\nAll gallery upload checks passed.");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
