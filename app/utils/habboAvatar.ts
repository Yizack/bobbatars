import { withQuery } from "ufo";
import { DEFAULT_OUTFIT_FIGURES } from "../data/avatar-generator/habbo-default-outfit";
import type { AvatarAction } from "../types/sceneAvatar";
import type {
  AvatarColor,
  AvatarGender,
  FigureSetType,
  OutfitPart
} from "../types/habboAvatar";

export const habboImagingUrl = "https://habbohistory.com/habbo-imaging/avatarimage.webp";
export const DEFAULT_HABBO_FIGURE = "hd-180-1.hr-100-61.ch-210-66.lg-270-82.sh-290-80";
export const MAX_PRELOADED_IMAGES = 128;

const danceHeadDirectionOverrides: Partial<Record<number, number>> = {
  3: 2,
  4: 5,
  6: 5,
  7: 0
};

export interface PreloadedImage {
  image: HTMLImageElement;
  promise: Promise<HTMLImageElement | null>;
  loaded: boolean;
}

export function parseFigureString (figureString: string): Record<string, OutfitPart> {
  const parts: Record<string, OutfitPart> = {};

  for (const token of figureString.split(".")) {
    const [type, setId, ...colorIds] = token.split("-");
    if (!type || !setId) continue;

    parts[type] = { setId, colorIds };
  }

  return parts;
}

export function copyOutfitParts (parts: Record<string, OutfitPart>): Record<string, OutfitPart> {
  const copy: Record<string, OutfitPart> = {};
  for (const [type, part] of Object.entries(parts)) {
    copy[type] = { setId: part.setId, colorIds: [...part.colorIds] };
  }
  return copy;
}

export function figureForParts (parts: Record<string, OutfitPart>): string {
  return Object.entries(parts)
    .map(([type, part]) => {
      if (!part?.setId) return "";
      const colors = part.colorIds.length ? `-${part.colorIds.join("-")}` : "";
      return `${type}-${part.setId}${colors}`;
    })
    .filter(Boolean)
    .join(".");
}

const defaultPartsByGender = {
  M: parseFigureString(DEFAULT_OUTFIT_FIGURES.M),
  F: parseFigureString(DEFAULT_OUTFIT_FIGURES.F)
};

export function colorsForType (gender: AvatarGender, type: string): string[] {
  return defaultPartsByGender[gender][type]?.colorIds ?? [];
}

export function paletteForType (
  palettes: Record<string, AvatarColor[]>,
  type: FigureSetType | undefined
): [string, AvatarColor][] {
  if (!type) return [];

  return [...(palettes[type.paletteId] || [])]
    .sort((left, right) => left.index - right.index)
    .map((color): [string, AvatarColor] => [color.id, color]);
}

export function habboImageUrl (
  direction: number,
  action: AvatarAction,
  gesture = "std",
  figure = DEFAULT_HABBO_FIGURE,
  effect: number | null = null
) {
  let headDirection = direction;
  if (action === "dance3" || action === "dance4") {
    headDirection = danceHeadDirectionOverrides[direction] ?? direction;
  }

  return withQuery(habboImagingUrl, {
    figure,
    direction,
    head_direction: headDirection,
    gesture,
    action,
    size: "fm",
    format: "webp",
    rv: 55,
    animv: 28,
    position: "bottom",
    ...(effect === null ? {} : { effect: String(effect) })
  });
}

function trimPreloadedImages (preloadedImages: Map<string, PreloadedImage>) {
  while (preloadedImages.size > MAX_PRELOADED_IMAGES) {
    let oldestLoadedUrl: string | null = null;
    for (const [url, cached] of preloadedImages) {
      if (cached.loaded) {
        oldestLoadedUrl = url;
        break;
      }
    }
    if (oldestLoadedUrl === null) return;
    preloadedImages.delete(oldestLoadedUrl);
  }
}

export function preloadHabboAvatar (
  preloadedImages: Map<string, PreloadedImage>,
  direction: number,
  action: AvatarAction,
  gesture = "std",
  figure = DEFAULT_HABBO_FIGURE,
  effect: number | null = null
): Promise<HTMLImageElement | null> {
  const url = habboImageUrl(direction, action, gesture, figure, effect);
  const cached = preloadedImages.get(url);
  if (cached) {
    preloadedImages.delete(url);
    preloadedImages.set(url, cached);
    return cached.promise;
  }

  const image = new Image();
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    image.addEventListener("load", () => {
      const cachedImage = preloadedImages.get(url);
      if (cachedImage?.image === image) {
        cachedImage.loaded = true;
        trimPreloadedImages(preloadedImages);
      }
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      if (preloadedImages.get(url)?.image === image) preloadedImages.delete(url);
      console.warn("No se pudo precargar la animación del avatar.");
      resolve(null);
    }, { once: true });
  });
  preloadedImages.set(url, { image, promise, loaded: false });
  image.src = url;
  return promise;
}
