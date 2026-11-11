import { Buffer } from "node:buffer";
import { resolveMediaAssetPath } from "../../../shared/mediaAssets";

const DAY_SECONDS = 24 * 60 * 60;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

async function fetchMedia (url: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000)
    });
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: "The media provider could not be reached.",
      cause: error
    });
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `The media provider returned HTTP ${response.status}.`
    });
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
    throw createError({ statusCode: 502, statusMessage: "Media asset exceeds the allowed size." });
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > MAX_MEDIA_BYTES) {
    throw createError({ statusCode: 502, statusMessage: "Media asset exceeds the allowed size." });
  }
  return data.toString("base64");
}

const getCachedMedia = defineCachedFunction(async (cdnUrl: string, sourceUrl: string) => {
  let cdnError: unknown;
  try {
    const cachedBase64 = await fetchMedia(cdnUrl);
    if (cachedBase64 !== null) return cachedBase64;
  }
  catch (error) {
    cdnError = error;
  }

  try {
    const sourceBase64 = await fetchMedia(sourceUrl);
    if (sourceBase64 !== null) return sourceBase64;
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: "The media CDN and fallback provider could not serve this asset.",
      cause: { cdnError, sourceError: error }
    });
  }

  if (cdnError) {
    throw createError({
      statusCode: 502,
      statusMessage: "The media CDN is unavailable and the fallback provider does not have this asset.",
      cause: cdnError
    });
  }
  throw createError({ statusCode: 404, statusMessage: "Media asset not found." });
}, {
  maxAge: DAY_SECONDS,
  swr: false,
  group: "api",
  name: "media",
  getKey: (cdnUrl, sourceUrl) => `${cdnUrl}|${sourceUrl}`
});

export default defineEventHandler(async (event) => {
  const asset = getRouterParam(event, "asset");
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: "Media asset not found." });
  }

  const mediaPath = resolveMediaAssetPath(asset);
  if (!mediaPath) {
    throw createError({ statusCode: 404, statusMessage: "Media asset not found." });
  }

  const config = useRuntimeConfig(event);
  const cdnUrl = new URL(`${config.public.mediaCdnUrl.replace(/\/+$/, "")}/${mediaPath}`);
  const sourceUrl = new URL(`${config.mediaSourceUrl.replace(/\/+$/, "")}/${mediaPath}`);
  for (const url of [cdnUrl, sourceUrl]) {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw createError({ statusCode: 500, statusMessage: "Invalid media URL configuration." });
    }
  }

  const cachedBase64 = await getCachedMedia(cdnUrl.toString(), sourceUrl.toString());
  const contentType = asset.endsWith(".json") ? "application/json; charset=utf-8" : "image/webp";
  setResponseHeader(event, "Cache-Control", `public, max-age=${DAY_SECONDS}, s-maxage=${DAY_SECONDS}`);
  setResponseHeader(event, "Content-Type", contentType);
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  return send(event, Buffer.from(cachedBase64, "base64"));
});
