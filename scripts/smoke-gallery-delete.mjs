/**
 * Verify Cloudinary gallery-preview assets are destroyed after delete.
 *
 * Usage:
 *   node --env-file=.env --env-file=.env.local scripts/smoke-gallery-delete.mjs
 */
import { createHash } from "node:crypto";
import sharp from "sharp";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:4001";
const PASSWORD = process.env.UPGRADE_PASSWORD;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sign(params) {
  const signatureBase = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");
}

function publicIdFromUrl(url) {
  const parsed = new URL(url);
  const marker = "/asosc/gallery-prev/";
  const at = parsed.pathname.indexOf(marker);
  assert(at !== -1, `expected gallery-prev url, got ${url}`);
  return parsed.pathname.slice(at + 1).replace(/\.[^.]+$/, "");
}

async function uploadSmokeImage() {
  const optimized = await sharp({
    create: {
      width: 120,
      height: 90,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .webp({ quality: 70 })
    .toBuffer();

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "asosc/gallery-prev/_smoke";
  const publicId = `smoke-delete-${Date.now()}`;
  const paramsToSign = { folder, public_id: publicId, timestamp };
  const form = new FormData();
  form.append("file", new Blob([optimized], { type: "image/webp" }), "smoke.webp");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("signature", sign(paramsToSign));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const data = await res.json();
  assert(res.ok && data.secure_url, data.error?.message ?? "upload failed");
  return data.secure_url;
}

async function resourceExists(publicId) {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  return res.status === 200;
}

async function destroyViaApi(url) {
  const loginRes = await fetch(`${BASE_URL}/api/upgrade/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert(loginRes.ok, "login failed");
  const cookie =
    (loginRes.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ") || loginRes.headers.get("set-cookie")?.split(";")[0];

  const res = await fetch(`${BASE_URL}/api/upgrade/media`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ urls: [url] }),
  });
  const body = await res.json();
  assert(res.ok, body.error ?? `media delete failed (${res.status})`);
  assert(body.deleted?.includes(url), `expected deleted to include url: ${JSON.stringify(body)}`);
}

async function main() {
  assert(cloudName && apiKey && apiSecret && PASSWORD, "missing env");
  console.log("Gallery Cloudinary delete smoke\n");

  const url = await uploadSmokeImage();
  const publicId = publicIdFromUrl(url);
  console.log("1) uploaded", url);
  assert(await resourceExists(publicId), "uploaded asset missing");
  console.log("2) confirmed asset exists");

  await destroyViaApi(url);
  console.log("3) /api/upgrade/media deleted it");

  // Cloudinary can be briefly eventually consistent; retry a few times.
  let gone = false;
  for (let i = 0; i < 5; i++) {
    gone = !(await resourceExists(publicId));
    if (gone) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  assert(gone, "asset still present after destroy");
  console.log("4) confirmed asset gone from Cloudinary");
  console.log("\nDelete flow passed.");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
