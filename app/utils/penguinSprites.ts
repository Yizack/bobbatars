import { orderedClothingParts } from "#shared/clothing";
import { resolveMediaAssetPath } from "#shared/mediaAssets";
import type { AvatarDanceAction } from "../types/avatar";
import type { PenguinAction, PenguinAppearance, PenguinDirection } from "../types/penguin";

interface SpriteRect {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
}

interface AtlasFrame {
  filename?: string;
  name?: string;
  frame?: SpriteRect;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  spriteSourceSize?: { x: number, y: number, w: number, h: number };
  sourceSize?: { w: number, h: number };
  rotated?: boolean;
}

interface AtlasJson {
  frames?: AtlasFrame[] | Record<string, AtlasFrame>;
  textures?: Array<{ frames?: AtlasFrame[] | Record<string, AtlasFrame> }>;
}

export interface SpriteEntry {
  key: string;
  frame: { x: number, y: number, w: number, h: number };
  off: { x: number, y: number };
  size: { w: number, h: number };
  rotated: boolean;
}

export interface SpriteLayer {
  name: string;
  path: string;
  img: HTMLImageElement;
  frames: Record<string, SpriteEntry>;
  byShort: Record<string, string[]>;
  names: string[];
}

export interface LoadedClothingLayer {
  id: number;
  placement: "back" | "front";
  layer: SpriteLayer;
}

export interface PenguinRenderResources {
  body: SpriteLayer;
  base: SpriteLayer;
  clothing: LoadedClothingLayer[];
  failedClothingIds: number[];
}

export interface SpriteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PenguinFrameBounds extends SpriteBounds {
  content: SpriteBounds;
}

interface StaticRenderInfo {
  baseEntry: SpriteEntry;
  groups: Record<string, string[]>;
  bounds: SpriteBounds;
}

type PenguinPoseAction = PenguinAction | AvatarDanceAction | "sit";

const danceSpriteId = 26;
// The atlas has throw poses for directions 0, 2, 4 and 6; odd directions use the next pose.
const snowballSpriteByDirection: Record<PenguinDirection, number> = {
  0: 28,
  1: 29,
  2: 30,
  3: 30,
  4: 30,
  5: 27,
  6: 27,
  7: 28
};
const layerRequests = new Map<string, Promise<SpriteLayer>>();
let renderResourcesRequest: Promise<Pick<PenguinRenderResources, "body" | "base">> | undefined;
const clothingLayerRequests = new Map<number, Promise<SpriteLayer>>();
const MAX_CACHED_CLOTHING_LAYERS = 64;
const MAX_CACHED_LAYERS = MAX_CACHED_CLOTHING_LAYERS + 2;
const PENGUIN_CANVAS_PADDING = {
  horizontal: 40,
  top: 72,
  bottom: 40
};
const groupsByLayer = new WeakMap<SpriteLayer, Record<string, string[]>>();
const staticRenderInfoByResources = new WeakMap<PenguinRenderResources, StaticRenderInfo>();
const danceSpriteIds = new Set([danceSpriteId]);
const spriteStarts: Record<Exclude<PenguinPoseAction, "snowball">, number> = {
  std: 1,
  wlk: 9,
  sit: 17,
  dance1: danceSpriteId,
  dance2: danceSpriteId,
  dance3: danceSpriteId,
  dance4: danceSpriteId
};
let tintCanvas: HTMLCanvasElement | undefined;
let tintContext: CanvasRenderingContext2D | null = null;

function normalizeFrames (json: AtlasJson): Record<string, AtlasFrame> {
  const frames: Record<string, AtlasFrame> = {};
  const add = (value: AtlasJson["frames"]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const name = entry.filename || entry.name;
        if (name) frames[name] = entry;
      });
    }
    else if (value) {
      Object.assign(frames, value);
    }
  };
  add(json.frames);
  json.textures?.forEach(texture => add(texture.frames));
  return frames;
}

function normalizeEntry (key: string, entry: AtlasFrame): SpriteEntry {
  const sourceFrame = entry.frame ?? entry;
  const x = sourceFrame.x;
  const y = sourceFrame.y;
  const w = sourceFrame.w ?? sourceFrame.width;
  const h = sourceFrame.h ?? sourceFrame.height;
  if (
    typeof x !== "number" || !Number.isFinite(x)
    || typeof y !== "number" || !Number.isFinite(y)
    || typeof w !== "number" || !Number.isFinite(w)
    || typeof h !== "number" || !Number.isFinite(h)
  ) {
    throw new Error(`Sprite frame "${key}" has invalid dimensions.`);
  }

  const off = entry.spriteSourceSize ?? { x: 0, y: 0, w, h };
  const size = entry.sourceSize ?? { w, h };
  return {
    key,
    frame: { x, y, w, h },
    off: { x: off.x, y: off.y },
    size: { w: size.w, h: size.h },
    rotated: entry.rotated ?? false
  };
}

function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error(`Timed out loading sprite image: ${url}`));
    }, 10_000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Could not load sprite image: ${url}`));
    };
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

function mediaAssetUrls (path: string, extension: "json" | "webp", penguinMediaCDN: string) {
  const apiUrl = `${path}.${extension}`;
  const asset = path.replace(/^\/api\/media\//, "");
  const cdnAssetPath = resolveMediaAssetPath(`${asset}.${extension}`);
  if (!cdnAssetPath) throw new Error(`Unsupported sprite asset path: ${apiUrl}`);
  const cdnBaseUrl = `${penguinMediaCDN.replace(/\/+$/, "")}/`;
  return { cdnUrl: new URL(cdnAssetPath, cdnBaseUrl).toString(), apiUrl };
}

async function loadWithFallback<T> (
  cdnUrl: string,
  apiUrl: string,
  load: (url: string) => Promise<T>
): Promise<T> {
  try {
    return await load(cdnUrl);
  }
  catch (cdnError) {
    try {
      return await load(apiUrl);
    }
    catch (apiError) {
      const cdnFailure = cdnError instanceof Error ? cdnError.message : String(cdnError);
      throw new Error(`Could not load sprite asset from the CDN or API: ${apiUrl}. CDN error: ${cdnFailure}`, {
        cause: apiError
      });
    }
  }
}

export function loadLayer (spec: { name: string, path: string }, penguinMediaCDN: string): Promise<SpriteLayer> {
  const cached = layerRequests.get(spec.path);
  if (cached) {
    layerRequests.delete(spec.path);
    layerRequests.set(spec.path, cached);
    return cached;
  }

  const request = (async () => {
    const jsonUrls = mediaAssetUrls(spec.path, "json", penguinMediaCDN);
    const imageUrls = mediaAssetUrls(spec.path, "webp", penguinMediaCDN);
    const json = await loadWithFallback(jsonUrls.cdnUrl, jsonUrls.apiUrl, async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
      return await response.json() as AtlasJson;
    });
    const img = await loadWithFallback(imageUrls.cdnUrl, imageUrls.apiUrl, loadImage);
    const frames: Record<string, SpriteEntry> = {};
    Object.entries(normalizeFrames(json)).forEach(([key, entry]) => {
      frames[key] = normalizeEntry(key, entry);
    });
    const names = Object.keys(frames);
    const byShort: Record<string, string[]> = {};
    names.forEach((name) => {
      const short = name.slice(name.lastIndexOf("/") + 1);
      (byShort[short] ||= []).push(name);
    });
    Object.values(byShort).forEach(keys => keys.sort());
    return { ...spec, img, frames, byShort, names };
  })().catch((error: unknown) => {
    layerRequests.delete(spec.path);
    throw error;
  });
  layerRequests.set(spec.path, request);
  if (layerRequests.size > MAX_CACHED_LAYERS) {
    const oldestPath = layerRequests.keys().next().value;
    if (oldestPath !== undefined) layerRequests.delete(oldestPath);
  }
  return request;
}

export function loadClothingLayer (id: number, penguinMediaCDN: string): Promise<SpriteLayer> {
  if (!Number.isSafeInteger(id) || id < 1) {
    return Promise.reject(new Error(`Invalid clothing sprite ID: ${id}`));
  }
  const cached = clothingLayerRequests.get(id);
  if (cached) {
    clothingLayerRequests.delete(id);
    clothingLayerRequests.set(id, cached);
    return cached;
  }
  const request = loadLayer({
    name: `clothing-${id}`,
    path: `/api/media/clothing/sprites/${id}`
  }, penguinMediaCDN).catch((error: unknown) => {
    clothingLayerRequests.delete(id);
    throw error;
  });
  clothingLayerRequests.set(id, request);
  if (clothingLayerRequests.size > MAX_CACHED_CLOTHING_LAYERS) {
    const oldestId = clothingLayerRequests.keys().next().value;
    if (oldestId !== undefined) {
      clothingLayerRequests.delete(oldestId);
      layerRequests.delete(`/api/media/clothing/sprites/${oldestId}`);
    }
  }
  return request;
}

export function loadPenguinRenderResources (
  appearance: PenguinAppearance,
  penguinMediaCDN: string
): Promise<PenguinRenderResources> {
  if (!renderResourcesRequest) {
    renderResourcesRequest = Promise.all([
      loadLayer({ name: "body", path: "/api/media/penguin/body" }, penguinMediaCDN),
      loadLayer({ name: "base", path: "/api/media/penguin/base" }, penguinMediaCDN)
    ]).then(([body, base]) => ({ body, base })).catch((error: unknown) => {
      renderResourcesRequest = undefined;
      throw error;
    });
  }

  return renderResourcesRequest.then(async ({ body, base }) => {
    const clothing = orderedClothingParts(appearance);
    const results = await Promise.all(clothing.map(async (part) => {
      try {
        return { part, layer: await loadClothingLayer(part.id, penguinMediaCDN) };
      }
      catch (error) {
        console.info(`Could not load penguin clothing sprite ${part.id}.`, error);
        return { part, layer: null };
      }
    }));
    return {
      body,
      base,
      clothing: results.flatMap(({ part, layer }) =>
        layer ? [{ id: part.id, placement: part.placement, layer }] : []
      ),
      failedClothingIds: results.flatMap(({ part, layer }) => layer ? [] : [part.id])
    };
  });
}

export function frameGroup (name: string): string {
  return name.replace(/[-_/.]?\d+(\.\w+)?$/, "");
}

export function buildGroups (names: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const ids = [...new Set(names.map(name => name.slice(name.lastIndexOf("/") + 1)))];
  ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  ids.forEach((name) => {
    (groups[frameGroup(name)] ||= []).push(name);
  });
  return groups;
}

export function framesFor (layer: SpriteLayer, name: string): SpriteEntry[] {
  const short = name.slice(name.lastIndexOf("/") + 1);
  return (layer.byShort[short] || []).flatMap((key) => {
    const frame = layer.frames[key];
    return frame ? [frame] : [];
  });
}

export function isPenguinBodyFrame (entry: SpriteEntry): boolean {
  return /(?:^|\/)body\//i.test(entry.key);
}

export function penguinSpriteForPose (direction: PenguinDirection, action: PenguinPoseAction): number {
  if (action === "snowball") return snowballSpriteByDirection[direction];
  const spriteStart = spriteStarts[action];
  if (action === "std" || action === "wlk" || action === "sit") {
    return spriteStart + ((direction + 5) % 8);
  }
  return spriteStart;
}

export function drawAt (
  context: CanvasRenderingContext2D,
  img: HTMLImageElement,
  entry: SpriteEntry,
  dx: number,
  dy: number
): void {
  const { x, y, w, h } = entry.frame;
  if (!entry.rotated) {
    context.drawImage(img, x, y, w, h, dx, dy, w, h);
    return;
  }
  context.save();
  context.translate(dx, dy + w);
  context.rotate(-Math.PI / 2);
  context.drawImage(img, x, y, w, h, 0, 0, w, h);
  context.restore();
}

export function drawFrame (context: CanvasRenderingContext2D, img: HTMLImageElement, entry: SpriteEntry): void {
  drawAt(context, img, entry, entry.off.x, entry.off.y);
}

function boundsForEntries (entries: SpriteEntry[]): SpriteBounds {
  if (!entries.length) throw new Error("No penguin sprite frames were found.");
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const width = entry.rotated ? entry.frame.h : entry.frame.w;
    const height = entry.rotated ? entry.frame.w : entry.frame.h;
    left = Math.min(left, entry.off.x);
    top = Math.min(top, entry.off.y);
    right = Math.max(right, entry.off.x + width);
    bottom = Math.max(bottom, entry.off.y + height);
  }
  const x = Math.floor(left) - 1;
  const y = Math.floor(top) - 1;
  return {
    x,
    y,
    width: Math.ceil(right) - x + 1,
    height: Math.ceil(bottom) - y + 1
  };
}

function drawTintedFrame (
  context: CanvasRenderingContext2D,
  img: HTMLImageElement,
  entry: SpriteEntry,
  color: string
): void {
  if (!tintCanvas) {
    tintCanvas = document.createElement("canvas");
    tintContext = tintCanvas.getContext("2d");
  }
  if (!tintContext) throw new Error("This browser does not support penguin color rendering.");
  if (tintCanvas.width !== entry.size.w) tintCanvas.width = entry.size.w;
  if (tintCanvas.height !== entry.size.h) tintCanvas.height = entry.size.h;
  tintContext.globalCompositeOperation = "source-over";
  tintContext.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  drawFrame(tintContext, img, entry);
  tintContext.globalCompositeOperation = "multiply";
  tintContext.fillStyle = color;
  tintContext.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintContext.globalCompositeOperation = "destination-in";
  drawFrame(tintContext, img, entry);
  tintContext.globalCompositeOperation = "source-over";
  context.drawImage(tintCanvas, 0, 0);
}

export function spriteSequenceForPose (
  body: SpriteLayer,
  direction: PenguinDirection,
  action: PenguinPoseAction
): string[] {
  const spriteId = penguinSpriteForPose(direction, action);
  const sequence = groupsForLayer(body)[String(spriteId)];
  if (!sequence?.length) throw new Error(`Penguin sprite ${spriteId} is missing from the atlas.`);
  return sequence;
}

function groupsForLayer (layer: SpriteLayer): Record<string, string[]> {
  let groups = groupsByLayer.get(layer);
  if (!groups) {
    groups = buildGroups(layer.names);
    groupsByLayer.set(layer, groups);
  }
  return groups;
}

function staticRenderInfo (resources: PenguinRenderResources): StaticRenderInfo {
  let info = staticRenderInfoByResources.get(resources);
  if (info) return info;

  const baseSpriteName = resources.base.names[1];
  const baseEntry = baseSpriteName ? resources.base.frames[baseSpriteName] : undefined;
  if (!baseEntry) throw new Error("The penguin base atlas does not contain sprite 1.");
  const groups = groupsForLayer(resources.body);
  const allFrameNames = Object.entries(groups)
    .filter(([id]) => {
      const spriteId = Number(id);
      return (spriteId >= 1 && spriteId <= 24) || danceSpriteIds.has(spriteId);
    })
    .flatMap(([, names]) => names);
  const boundEntries = [
    ...allFrameNames.flatMap(name => framesFor(resources.body, name)),
    baseEntry
  ];
  const contentBounds = boundsForEntries(boundEntries);
  info = {
    baseEntry,
    groups,
    bounds: {
      x: contentBounds.x - PENGUIN_CANVAS_PADDING.horizontal,
      y: contentBounds.y - PENGUIN_CANVAS_PADDING.top,
      width: contentBounds.width + PENGUIN_CANVAS_PADDING.horizontal * 2,
      height: contentBounds.height + PENGUIN_CANVAS_PADDING.top + PENGUIN_CANVAS_PADDING.bottom
    }
  };
  staticRenderInfoByResources.set(resources, info);
  return info;
}

export function drawPenguinFrame (
  canvas: HTMLCanvasElement,
  resources: PenguinRenderResources,
  appearance: PenguinAppearance,
  direction: PenguinDirection,
  action: PenguinPoseAction,
  frameIndex = 0
): PenguinFrameBounds {
  const { baseEntry, bounds } = staticRenderInfo(resources);

  const sequence = spriteSequenceForPose(resources.body, direction, action);
  const frameName = sequence[frameIndex % sequence.length];
  if (!frameName) throw new Error("The penguin animation has no current frame.");
  const bodyEntries = framesFor(resources.body, frameName);
  if (!bodyEntries.length) throw new Error(`Penguin sprite frame "${frameName}" is missing.`);
  const backFrames = resources.clothing
    .filter(({ placement }) => placement === "back")
    .map(({ layer }) => ({ layer, entries: framesFor(layer, frameName) }));
  const frontFrames = resources.clothing
    .filter(({ placement }) => placement === "front")
    .map(({ layer }) => ({ layer, entries: framesFor(layer, frameName) }));
  const contentBounds = boundsForEntries([
    baseEntry,
    ...backFrames.flatMap(({ entries }) => entries),
    ...bodyEntries,
    ...frontFrames.flatMap(({ entries }) => entries)
  ]);

  if (canvas.width !== bounds.width) canvas.width = bounds.width;
  if (canvas.height !== bounds.height) canvas.height = bounds.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser does not support canvas rendering.");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(-bounds.x, -bounds.y);
  drawFrame(context, resources.base.img, baseEntry);
  backFrames.forEach(({ layer, entries }) => entries.forEach(entry => drawFrame(context, layer.img, entry)));
  bodyEntries.forEach((entry) => {
    if (isPenguinBodyFrame(entry)) drawTintedFrame(context, resources.body.img, entry, appearance.color);
    else drawFrame(context, resources.body.img, entry);
  });
  frontFrames.forEach(({ layer, entries }) => entries.forEach(entry => drawFrame(context, layer.img, entry)));
  context.restore();
  return {
    ...bounds,
    content: {
      x: contentBounds.x - bounds.x,
      y: contentBounds.y - bounds.y,
      width: contentBounds.width,
      height: contentBounds.height
    }
  };
}
