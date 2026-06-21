#!/usr/bin/env node
/**
 * Converts PNG/JPEG assets to WebP with size-aware quality presets.
 * Originals are backed up under public/.originals/ (and root .originals/ for root-level source assets).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const IMAGE_RE = /\.(png|jpe?g)$/i;

/** @type {Record<string, { quality: number; maxWidth?: number }>} */
const PRESETS = {
  texture: { quality: 50, maxWidth: 1200 },
  logo: { quality: 85, maxWidth: 512 },
  hero: { quality: 80, maxWidth: 1920 },
  photo: { quality: 75, maxWidth: 1600 },
};

function presetFor(relPath) {
  const base = path.basename(relPath).toLowerCase();
  const norm = relPath.replace(/\\/g, "/").toLowerCase();

  if (base === "about-pattern.png") return PRESETS.texture;
  if (base === "logo.png" || base === "asosc-logo.png") return PRESETS.logo;
  if (norm.includes("/caurosel/")) return PRESETS.hero;
  if (base === "programs image.png") return PRESETS.photo;
  return PRESETS.photo;
}

function collectImages(dir, baseDir = dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".originals" || entry.name === "node_modules") continue;
      files.push(...collectImages(full, baseDir));
    } else if (IMAGE_RE.test(entry.name)) {
      files.push(path.relative(baseDir, full));
    }
  }
  return files;
}

async function convertFile(absInput, relFromPublic, backupRoot) {
  const preset = presetFor(relFromPublic);
  const outRel = relFromPublic.replace(IMAGE_RE, ".webp");
  const absOutput = path.join(PUBLIC, outRel);
  const absBackup = path.join(backupRoot, relFromPublic);

  fs.mkdirSync(path.dirname(absBackup), { recursive: true });
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  if (!fs.existsSync(absBackup)) {
    fs.copyFileSync(absInput, absBackup);
  }

  let pipeline = sharp(absInput).rotate();
  const meta = await pipeline.metadata();
  if (preset.maxWidth && meta.width && meta.width > preset.maxWidth) {
    pipeline = pipeline.resize({ width: preset.maxWidth, withoutEnlargement: true });
  }

  await pipeline.webp({ quality: preset.quality, effort: 6 }).toFile(absOutput);

  const inSize = fs.statSync(absInput).size;
  const outSize = fs.statSync(absOutput).size;
  fs.unlinkSync(absInput);

  return { rel: outRel, inSize, outSize };
}

async function convertRootLogo() {
  const input = path.join(ROOT, "Asosc-Logo.png");
  if (!fs.existsSync(input)) return null;

  const backupDir = path.join(ROOT, ".originals");
  const backup = path.join(backupDir, "Asosc-Logo.png");
  const output = path.join(ROOT, "Asosc-Logo.webp");

  fs.mkdirSync(backupDir, { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(input, backup);

  const preset = PRESETS.logo;
  await sharp(input)
    .rotate()
    .resize({ width: preset.maxWidth, withoutEnlargement: true })
    .webp({ quality: preset.quality, effort: 6 })
    .toFile(output);

  const inSize = fs.statSync(input).size;
  const outSize = fs.statSync(output).size;
  fs.unlinkSync(input);
  return { rel: "Asosc-Logo.webp", inSize, outSize };
}

async function main() {
  const backupRoot = path.join(PUBLIC, ".originals");
  const publicImages = collectImages(PUBLIC);
  const results = [];

  for (const rel of publicImages) {
    const abs = path.join(PUBLIC, rel);
    results.push(await convertFile(abs, rel, backupRoot));
  }

  const logoResult = await convertRootLogo();
  if (logoResult) results.push(logoResult);

  let totalIn = 0;
  let totalOut = 0;
  for (const r of results) {
    totalIn += r.inSize;
    totalOut += r.outSize;
    const pct = ((1 - r.outSize / r.inSize) * 100).toFixed(1);
    console.log(`${r.rel}: ${(r.inSize / 1024).toFixed(0)}KB → ${(r.outSize / 1024).toFixed(0)}KB (${pct}% smaller)`);
  }
  console.log(`\nTotal: ${(totalIn / 1024 / 1024).toFixed(2)}MB → ${(totalOut / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
