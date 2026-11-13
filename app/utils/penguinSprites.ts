import { CLOTHING_RENDER_ORDER, type ClothingPartKey, orderedClothingParts } from "#shared/clothing";
import penguinCatalogJson from "../data/avatar-generator/penguin-catalog.json";
import { resolveMediaAssetPath } from "#shared/mediaAssets";
import type { AvatarDanceAction } from "../types/avatar";
import type { PenguinAction, PenguinAppearance, PenguinCatalogItem, PenguinDirection } from "../types/penguin";

const penguinMediaCDN = () => useRuntimeConfig().public.penguinMediaCDN;

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
  key: ClothingPartKey;
  catalogLayer: number;
  layer: SpriteLayer;
}

export interface PenguinRenderResources {
  body: SpriteLayer;
  base: SpriteLayer;
  cleanBodyAction?: SpriteLayer;
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

export const PENGUIN_CLEAN_HAND_ITEM_ID = 5084;
export const PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID = 71;
export const PENGUIN_CLEAN_BODY_ACTION_ID = 71;

interface StaticRenderInfo {
  baseEntry: SpriteEntry;
  groups: Record<string, string[]>;
  bounds: SpriteBounds;
}

type PenguinPoseAction = PenguinAction | AvatarDanceAction | "sit";

const danceSpriteId = 26;
const PENGUIN_BODY_RENDER_LAYER = 2000;
const penguinCatalogLayerByItemId = new Map<number, number>(
  (penguinCatalogJson as PenguinCatalogItem[]).map(item => [item.paper_item_id, item.layer] as const)
);
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

function mediaAssetUrls (path: string, extension: "json" | "webp") {
  const apiUrl = `${path}.${extension}`;
  const asset = path.replace(/^\/api\/media\//, "");
  const cdnAssetPath = resolveMediaAssetPath(`${asset}.${extension}`);
  if (!cdnAssetPath) throw new Error(`Unsupported sprite asset path: ${apiUrl}`);
  const cdnBaseUrl = `${penguinMediaCDN().replace(/\/+$/, "")}/`;
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

export function loadLayer (spec: { name: string, path: string }): Promise<SpriteLayer> {
  const cached = layerRequests.get(spec.path);
  if (cached) {
    layerRequests.delete(spec.path);
    layerRequests.set(spec.path, cached);
    return cached;
  }

  const request = (async () => {
    const jsonUrls = mediaAssetUrls(spec.path, "json");
    const imageUrls = mediaAssetUrls(spec.path, "webp");
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

export function loadClothingLayer (id: number): Promise<SpriteLayer> {
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
  }).catch((error: unknown) => {
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
  appearance: PenguinAppearance
): Promise<PenguinRenderResources> {
  if (!renderResourcesRequest) {
    renderResourcesRequest = Promise.all([
      loadLayer({ name: "body", path: "/api/media/penguin/body" }),
      loadLayer({ name: "base", path: "/api/media/penguin/base" })
    ]).then(([body, base]) => ({ body, base })).catch((error: unknown) => {
      renderResourcesRequest = undefined;
      throw error;
    });
  }

  return renderResourcesRequest.then(async ({ body, base }) => {
    const clothing = orderedClothingParts(appearance)
      .map((part) => {
        const catalogLayer = penguinCatalogLayerByItemId.get(part.id);
        if (catalogLayer === undefined) {
          throw new Error(`Penguin catalog layer is missing for clothing item ${part.id}.`);
        }
        return { ...part, catalogLayer };
      })
      .sort((first, second) =>
        first.catalogLayer - second.catalogLayer
        || CLOTHING_RENDER_ORDER.indexOf(first.key) - CLOTHING_RENDER_ORDER.indexOf(second.key)
      );
    const results = await Promise.all(clothing.map(async (part) => {
      try {
        return { part, layer: await loadClothingLayer(part.id) };
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
        layer ? [{ id: part.id, key: part.key, catalogLayer: part.catalogLayer, layer }] : []
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

export function spriteEntryDimensions (entry: SpriteEntry): { width: number, height: number } {
  if (entry.rotated) return { width: entry.frame.h, height: entry.frame.w };
  return { width: entry.frame.w, height: entry.frame.h };
}

export function prepareSpriteCanvas (
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser does not support canvas rendering.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  return context;
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
    const { width, height } = spriteEntryDimensions(entry);
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
  if (!tintCanvas) tintCanvas = document.createElement("canvas");
  const tintContext = prepareSpriteCanvas(tintCanvas, entry.size.w, entry.size.h);
  tintContext.globalCompositeOperation = "source-over";
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
  return spriteSequenceForGroup(body, spriteId);
}

export function spriteSequenceForGroup (layer: SpriteLayer, spriteId: number): string[] {
  const sequence = groupsForLayer(layer)[String(spriteId)];
  if (!sequence?.length) {
    throw new Error(`Penguin sprite group ${spriteId} is missing from layer "${layer.name}".`);
  }
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
  const cleanItemEntries = resources.clothing
    .filter(({ id }) => id === PENGUIN_CLEAN_HAND_ITEM_ID)
    .flatMap(({ layer }) => {
      const animationFrames = groupsForLayer(layer)[String(PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID)] ?? [];
      return animationFrames.flatMap(name => framesFor(layer, name));
    });
  let cleanBodyActionEntries: SpriteEntry[] = [];
  if (resources.cleanBodyAction) {
    const cleanBodyAction = resources.cleanBodyAction;
    cleanBodyActionEntries = spriteSequenceForGroup(cleanBodyAction, PENGUIN_CLEAN_BODY_ACTION_ID)
      .flatMap(name => framesFor(cleanBodyAction, name));
  }
  const boundEntries = [
    ...allFrameNames.flatMap(name => framesFor(resources.body, name)),
    ...cleanBodyActionEntries,
    ...cleanItemEntries,
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
  frameIndex = 0,
  cleanItemFrameIndex: number | null = null
): PenguinFrameBounds {
  const { baseEntry, bounds } = staticRenderInfo(resources);

  const cleanBodyLayer = cleanItemFrameIndex === null ? undefined : resources.cleanBodyAction;
  if (cleanItemFrameIndex !== null && !cleanBodyLayer) {
    throw new Error("The penguin clean body action is missing from the sprite resources.");
  }
  let sequence: string[];
  if (cleanBodyLayer) {
    sequence = spriteSequenceForGroup(cleanBodyLayer, PENGUIN_CLEAN_BODY_ACTION_ID);
  }
  else {
    sequence = spriteSequenceForPose(resources.body, direction, action);
  }
  const frameName = sequence[frameIndex % sequence.length];
  if (!frameName) throw new Error("The penguin animation has no current frame.");
  let cleanFallbackFrameName: string | null = null;
  if (cleanBodyLayer) {
    cleanFallbackFrameName = spriteSequenceForPose(resources.body, direction, "std")[0] ?? null;
  }
  let cleanItemLayer: SpriteLayer | undefined;
  if (cleanItemFrameIndex !== null) {
    cleanItemLayer = resources.clothing.find(({ id }) => id === PENGUIN_CLEAN_HAND_ITEM_ID)?.layer;
  }
  let cleanItemSequence: string[] = [];
  if (cleanItemLayer) {
    cleanItemSequence = spriteSequenceForGroup(cleanItemLayer, PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID);
  }
  let cleanItemFrameName: string | null = null;
  if (cleanItemFrameIndex !== null && cleanItemSequence.length > 0) {
    cleanItemFrameName = cleanItemSequence[cleanItemFrameIndex % cleanItemSequence.length] ?? null;
  }
  const clothingEntries = (id: number, layer: SpriteLayer) => {
    if (cleanItemFrameIndex !== null && id === PENGUIN_CLEAN_HAND_ITEM_ID) {
      return cleanItemFrameName ? framesFor(layer, cleanItemFrameName) : [];
    }
    const actionEntries = framesFor(layer, frameName);
    if (actionEntries.length || !cleanFallbackFrameName) return actionEntries;
    return framesFor(layer, cleanFallbackFrameName);
  };
  const bodyEntries = framesFor(cleanBodyLayer ?? resources.body, frameName);
  const bodyLayer = cleanBodyLayer ?? resources.body;
  if (!bodyEntries.length) throw new Error(`Penguin sprite frame "${frameName}" is missing.`);
  const clothing = resources.clothing.filter(({ id }) => cleanItemFrameIndex === null || id == PENGUIN_CLEAN_HAND_ITEM_ID);
  const backFrames = clothing
    .filter(({ catalogLayer }) => catalogLayer < PENGUIN_BODY_RENDER_LAYER)
    .map(({ id, layer }) => ({ layer, entries: clothingEntries(id, layer) }));
  const frontFrames = clothing
    .filter(({ catalogLayer }) => catalogLayer >= PENGUIN_BODY_RENDER_LAYER)
    .map(({ id, layer }) => ({ layer, entries: clothingEntries(id, layer) }));
  const contentBounds = boundsForEntries([
    baseEntry,
    ...backFrames.flatMap(({ entries }) => entries),
    ...bodyEntries,
    ...frontFrames.flatMap(({ entries }) => entries)
  ]);

  const context = prepareSpriteCanvas(canvas, bounds.width, bounds.height);
  context.save();
  context.translate(-bounds.x, -bounds.y);
  drawFrame(context, resources.base.img, baseEntry);
  backFrames.forEach(({ layer, entries }) => entries.forEach(entry => drawFrame(context, layer.img, entry)));
  bodyEntries.forEach((entry) => {
    if (isPenguinBodyFrame(entry)) drawTintedFrame(context, bodyLayer.img, entry, appearance.color);
    else drawFrame(context, bodyLayer.img, entry);
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
