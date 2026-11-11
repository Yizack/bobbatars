import { loadEnvFile } from "node:process";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createStorage } from "unstorage";
import s3Driver from "unstorage/drivers/s3";

loadEnvFile();

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 4;
const mediaSourceUrl = (process.env.NUXT_MEDIA_SOURCE_URL || "https://media.cplegacy.com/assets/media").replace(/\/+$/, "");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucketName = process.env.R2_BUCKET_NAME?.trim() || "penguin-assets";

if (!accountId) {
  throw new Error("Set CLOUDFLARE_ACCOUNT_ID to your Cloudflare account ID.");
}
if (!accessKeyId || !secretAccessKey) {
  throw new Error("Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY to an R2 S3 API token.");
}

const r2Storage = createStorage({
  driver: s3Driver({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
    bucket: bucketName
  })
});

const catalogPath = new URL("../app/data/avatar-generator/penguin-catalog.json", import.meta.url);
const catalog = JSON.parse(await readFile(fileURLToPath(catalogPath), "utf8"));
const itemIds = [...new Set(catalog
  .map(item => item.paper_item_id)
  .filter(id => Number.isSafeInteger(id) && id > 0))];
const assets = [
  {
    label: "penguin body atlas",
    files: [
      { path: "penguin/penguin.json", source: "penguin/penguin.json", type: "application/json" },
      { path: "penguin/penguin-0.webp", source: "penguin/penguin-0.webp", type: "image/webp" }
    ],
    required: true
  },
  {
    label: "penguin base atlas",
    files: [
      { path: "penguin/penguin_base.json", source: "penguin/penguin_base.json", type: "application/json" },
      { path: "penguin/penguin_base-0.webp", source: "penguin/penguin_base-0.webp", type: "image/webp" }
    ],
    required: true
  },
  {
    label: "penguin actions 71 atlas",
    files: [
      { path: "penguin/actions/71.json", source: "penguin/actions/71.json", type: "application/json" },
      { path: "penguin/actions/71-0.webp", source: "penguin/actions/71-0.webp", type: "image/webp" }
    ],
    required: true
  },
  ...itemIds.map(id => ({
    label: `catalog item ${id}`,
    files: [
      { path: `clothing/sprites/${id}.json`, source: `clothing/sprites/${id}.json`, type: "application/json" },
      { path: `clothing/sprites/${id}-0.webp`, source: `clothing/sprites/${id}-0.webp`, type: "image/webp" }
    ],
    required: false
  }))
];

function pause (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry (url, init, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(30_000)
      });
      if (response.status === 404) return null;
      if (response.ok) return response;
      const error = new Error(`${label} returned HTTP ${response.status}.`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
    }
    catch (error) {
      if (error instanceof Error && /returned HTTP 4\d\d/.test(error.message)) throw error;
      lastError = error;
    }
    if (attempt < MAX_ATTEMPTS) await pause(250 * 2 ** (attempt - 1));
  }
  throw lastError ?? new Error(`${label} failed.`);
}

async function existsInR2 (path) {
  try {
    return await r2Storage.hasItem(path);
  }
  catch (error) {
    throw new Error(`Could not check ${path} in R2: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

async function uploadToR2 (path, data, contentType) {
  await r2Storage.setItemRaw(path, new Blob([data], { type: contentType }));
}

async function syncAssetGroup (assetGroup) {
  const existing = await Promise.all(assetGroup.files.map(file => existsInR2(file.path)));
  if (existing.every(Boolean)) return { uploaded: 0, skipped: 1, missing: 0 };

  const filesToFetch = assetGroup.files.filter((_, index) => !existing[index]);
  const results = await Promise.all(filesToFetch.map(async file => ({
    file,
    response: await fetchWithRetry(`${mediaSourceUrl}/${file.source}`, {}, `Source fetch ${file.source}`)
  })));
  const missingFiles = results.filter(result => !result.response);
  if (missingFiles.length) {
    if (assetGroup.required) {
      throw new Error(`Required ${assetGroup.label} is missing from the source: ${missingFiles.map(result => result.file.source).join(", ")}.`);
    }
    return { uploaded: 0, skipped: 0, missing: 1 };
  }

  const downloaded = await Promise.all(results.map(async ({ file, response }) => {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
      throw new Error(`${file.source} exceeds the ${MAX_MEDIA_BYTES} byte limit.`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > MAX_MEDIA_BYTES) throw new Error(`${file.source} exceeds the ${MAX_MEDIA_BYTES} byte limit.`);
    if (file.type === "application/json") {
      try {
        JSON.parse(data.toString("utf8"));
      }
      catch (error) {
        throw new Error(`${file.source} is not valid JSON.`, { cause: error });
      }
    }
    else if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
      throw new Error(`${file.source} is not a valid WebP image.`);
    }
    return { file, data };
  }));
  await Promise.all(downloaded.map(({ file, data }) => uploadToR2(file.path, data, file.type)));
  return { uploaded: downloaded.length, skipped: 0, missing: 0 };
}

let cursor = 0;
let completed = 0;
let uploadedCount = 0;
let skippedCount = 0;
let missingCount = 0;
const failures = [];

await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < assets.length) {
    const current = assets[cursor++];
    try {
      const result = await syncAssetGroup(current);
      uploadedCount += result.uploaded;
      skippedCount += result.skipped;
      missingCount += result.missing;
    }
    catch (error) {
      failures.push({ label: current.label, message: error instanceof Error ? error.message : String(error) });
    }
    completed++;
    if (completed % 100 === 0 || completed === assets.length) {
      console.info(`Processed ${completed}/${assets.length} asset groups.`);
    }
  }
}));

console.info(`Uploaded ${uploadedCount} files; skipped ${skippedCount} existing groups; unavailable catalog items ${missingCount}; failed groups ${failures.length}.`);
if (failures.length) {
  failures.slice(0, 20).forEach(failure => console.warn(`${failure.label}: ${failure.message}`));
  if (failures.length > 20) console.warn(`${failures.length - 20} additional failures omitted.`);
  process.exitCode = 1;
}
