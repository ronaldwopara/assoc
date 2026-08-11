/**
 * End-to-end smoke test for Documents CMS:
 * upload (PDF/DOCX/PPTX), reject bad types, CMS save/load, Cloudinary destroy.
 *
 * Usage:
 *   node --env-file=.env --env-file=.env.local scripts/smoke-documents-upload.mjs
 */
import { createHash } from "node:crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";
const PASSWORD = process.env.UPGRADE_PASSWORD;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

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

/** Minimal valid-enough PDF for upload allowlist testing. */
function makePdf(label = "smoke") {
  const content = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 50 100 Td (${label}) Tj ET
endstream
endobj
trailer<< /Root 1 0 R >>
%%EOF
`;
  return {
    buffer: Buffer.from(content, "utf8"),
    name: `smoke-${label}.pdf`,
    type: "application/pdf",
  };
}

/** Minimal ZIP-shaped DOCX (OOXML is a zip). Cloudinary accepts the bytes; MIME/ext matter for our API. */
function makeDocx() {
  // PK zip local file header + empty central directory — enough for extension/MIME allowlist.
  const bytes = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x50, 0x4b, 0x05, 0x06, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  return {
    buffer: bytes,
    name: "smoke-bylaws.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

function makePptx() {
  const docx = makeDocx();
  return {
    buffer: docx.buffer,
    name: "smoke-plan.pptx",
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
}

async function login() {
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
  return cookieHeader;
}

async function uploadDocument(cookie, file, groupId = "smoke-group") {
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.type }), file.name);
  form.append("groupId", groupId);
  const res = await fetch(`${BASE_URL}/api/upgrade/documents/upload`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const body = await res.json();
  return { res, body };
}

async function cloudinaryRawExists(url) {
  // Public CDN often 401s PDFs; use our download proxy (Admin API stream).
  const proxy = `${BASE_URL}/api/documents/download?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxy);
  return res.ok;
}

async function destroyViaApi(cookie, urls) {
  const res = await fetch(`${BASE_URL}/api/upgrade/documents/media`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ urls }),
  });
  const body = await res.json();
  return { res, body };
}

async function testValidation(cookie) {
  console.log("1) Reject unsupported / oversize uploads");

  const exe = {
    buffer: Buffer.from("MZ"),
    name: "malware.exe",
    type: "application/octet-stream",
  };
  const bad = await uploadDocument(cookie, exe);
  assert(!bad.res.ok, "exe should be rejected");
  assert(
    /pdf|docx|pptx|allowed|unsupported/i.test(bad.body.error ?? ""),
    `unexpected exe error: ${bad.body.error}`,
  );
  console.log("  ✓ rejected .exe");

  const huge = {
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1, 1),
    name: "too-big.pdf",
    type: "application/pdf",
  };
  const oversize = await uploadDocument(cookie, huge);
  assert(!oversize.res.ok, "25MB+ should be rejected");
  assert(/25MB/i.test(oversize.body.error ?? ""), oversize.body.error);
  console.log("  ✓ rejected >25MB");
}

async function testUploads(cookie) {
  console.log("2) Upload PDF + DOCX + PPTX");
  const urls = [];
  for (const sample of [makePdf("a"), makeDocx(), makePptx()]) {
    const { res, body } = await uploadDocument(cookie, sample);
    assert(res.ok && body.url, `${sample.name} upload failed: ${body.error ?? res.status}`);
    assert(body.filename === sample.name, `filename mismatch for ${sample.name}`);
    assert(await cloudinaryRawExists(body.url), `${sample.name} URL not reachable`);
    urls.push(body.url);
    console.log(`  ✓ ${sample.name} → ${body.url}`);
  }
  return urls;
}

async function testDraftDestroy(cookie, urls) {
  console.log("3) Draft Cloudinary destroy via /api/upgrade/documents/media");
  const { res, body } = await destroyViaApi(cookie, urls);
  assert(res.ok, `media destroy failed: ${body.error ?? res.status}`);
  assert(body.deleted?.length === urls.length, `expected ${urls.length} deleted, got ${body.deleted?.length}`);
  for (const url of urls) {
    assert(!(await cloudinaryRawExists(url)), `still reachable after destroy: ${url}`);
  }
  console.log(`  ✓ destroyed ${urls.length} draft assets`);
  console.log("  ✓ download proxy returns 404/500 for deleted assets");
}

async function testCmsRoundTrip(cookie) {
  console.log("4) CMS JSON get → save smoke item → get → remove → Cloudinary gone");

  const getRes = await fetch(`${BASE_URL}/api/upgrade/documents`, {
    headers: { cookie },
  });
  assert(getRes.ok, `GET documents failed: ${getRes.status}`);
  const original = await getRes.json();
  assert(Array.isArray(original.groups), "CMS missing groups");
  assert(original.groups.length >= 2, "seed should have Financial + Governance groups");
  console.log(`  ✓ GET CMS (${original.groups.length} groups)`);

  const smokeFile = makePdf("cms");
  const uploaded = await uploadDocument(cookie, smokeFile, "financial-reports");
  assert(uploaded.res.ok && uploaded.body.url, uploaded.body.error ?? "upload failed");
  const smokeUrl = uploaded.body.url;

  const withSmoke = structuredClone(original);
  const group =
    withSmoke.groups.find((g) => g.id === "financial-reports") ?? withSmoke.groups[0];
  group.items = [
    ...group.items,
    {
      id: `smoke-item-${Date.now()}`,
      label: "Smoke Test Document",
      url: smokeUrl,
      filename: smokeFile.name,
      contentType: "application/pdf",
    },
  ];

  const putRes = await fetch(`${BASE_URL}/api/upgrade/documents`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(withSmoke),
  });
  const putBody = await putRes.json();
  assert(putRes.ok, `PUT with smoke failed: ${putBody.error ?? putRes.status}`);
  assert(
    putBody.groups.some((g) => g.items.some((i) => i.url === smokeUrl)),
    "saved CMS missing smoke item",
  );
  console.log("  ✓ PUT CMS with smoke document");

  const get2 = await fetch(`${BASE_URL}/api/upgrade/documents`, {
    headers: { cookie },
  });
  const loaded = await get2.json();
  assert(
    loaded.groups.some((g) => g.items.some((i) => i.url === smokeUrl)),
    "GET after save missing smoke item",
  );
  console.log("  ✓ GET retrieves smoke document");

  // Public about page should include the label when CMS is live
  const aboutRes = await fetch(`${BASE_URL}/about`);
  assert(aboutRes.ok, `/about failed: ${aboutRes.status}`);
  const aboutHtml = await aboutRes.text();
  assert(
    aboutHtml.includes("Smoke Test Document") || aboutHtml.includes("Financial Reports"),
    "About page missing documents content",
  );
  console.log("  ✓ /about renders documents section");

  // Restore original CMS — save should destroy smokeUrl from Cloudinary
  const restoreRes = await fetch(`${BASE_URL}/api/upgrade/documents`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(original),
  });
  const restoreBody = await restoreRes.json();
  assert(restoreRes.ok, `restore failed: ${restoreBody.error ?? restoreRes.status}`);
  assert(
    !restoreBody.groups.some((g) => g.items.some((i) => i.url === smokeUrl)),
    "smoke item still in CMS after restore",
  );
  console.log("  ✓ restored original CMS JSON");

  // Allow Cloudinary a moment; destroy is sequential after JSON write
  await new Promise((r) => setTimeout(r, 800));
  assert(
    !(await cloudinaryRawExists(smokeUrl)),
    `Cloudinary asset still exists after CMS remove: ${smokeUrl}`,
  );
  console.log("  ✓ removed document deleted from Cloudinary");
}

async function testUpgradePages() {
  console.log("5) Upgrade hub pages respond");
  for (const path of [
    "/upgrade",
    "/upgrade?tool=gallery",
    "/upgrade?tool=announcement",
    "/upgrade?tool=documents",
  ]) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert(res.ok, `${path} → ${res.status}`);
    console.log(`  ✓ ${path}`);
  }

  const about = await fetch(`${BASE_URL}/about`);
  assert(about.ok, `/about → ${about.status}`);
  const html = await about.text();
  assert(html.includes("Documents"), "About missing Documents heading");
  assert(html.includes("Financial Reports") || html.includes("Financial"), "missing financial group");
  console.log("  ✓ /about documents seed content");
}

async function testPublicIdHelperShape() {
  console.log("0) Env + Cloudinary raw URL parsing prerequisites");
  assert(cloudName && apiKey && apiSecret, "Missing Cloudinary env vars");
  assert(PASSWORD, "UPGRADE_PASSWORD missing");
  // Sanity: sign helper works
  const sig = sign({ timestamp: 1, public_id: "x" });
  assert(sig.length === 40, "bad sha1 signature length");
  console.log("  ✓ env ready");
}

async function main() {
  console.log("Documents CMS smoke test\n");
  console.log(`BASE_URL=${BASE_URL}\n`);
  await testPublicIdHelperShape();
  await testUpgradePages();
  const cookie = await login();
  console.log("  ✓ login\n");
  await testValidation(cookie);
  const urls = await testUploads(cookie);
  await testDraftDestroy(cookie, urls);
  await testCmsRoundTrip(cookie);
  console.log("\nAll documents CMS checks passed.");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
