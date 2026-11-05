import { DEFAULT_OUTFIT_FIGURES } from "../data/avatar-generator/default-outfit";
import type { AvatarColor, AvatarGender, FigureSetType, OutfitPart } from "../types/avatar";

export const avatarImagingUrl = "https://habbohistory.com/habbo-imaging/avatarimage.webp";

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
