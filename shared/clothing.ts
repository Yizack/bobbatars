export const CLOTHING_PARTS = [
  { key: "head", type: 2, label: "Head" },
  { key: "face", type: 3, label: "Face" },
  { key: "neck", type: 4, label: "Neck" },
  { key: "body", type: 5, label: "Body" },
  { key: "hand", type: 6, label: "Hand" },
  { key: "feet", type: 7, label: "Feet" }
] as const;

export const CLOTHING_RENDER_ORDER = [
  "feet",
  "body",
  "neck",
  "face",
  "head",
  "hand"
] as const;

export type ClothingPartKey = typeof CLOTHING_PARTS[number]["key"];
export type ClothingParts = Record<ClothingPartKey, number | null>;

export const EMPTY_CLOTHING_PARTS: ClothingParts = {
  head: null,
  face: null,
  neck: null,
  body: null,
  hand: null,
  feet: null
};

export interface OrderedClothingPart {
  key: ClothingPartKey;
  id: number;
}

export function orderedClothingParts (parts: ClothingParts): OrderedClothingPart[] {
  return CLOTHING_RENDER_ORDER.flatMap((key) => {
    const id = parts[key];
    if (id === null) return [];
    return [{ key, id }];
  });
}

export function clothingPartsFromSelection (selection: Readonly<Record<number, number>>): ClothingParts {
  const parts = { ...EMPTY_CLOTHING_PARTS };
  for (const { key, type } of CLOTHING_PARTS) {
    parts[key] = selection[type] ?? null;
  }
  return parts;
}

export function clothingSelectionFromParts (parts: ClothingParts): Record<number, number> {
  const selection: Record<number, number> = {};
  for (const { key, type } of CLOTHING_PARTS) {
    const id = parts[key];
    if (id !== null) selection[type] = id;
  }
  return selection;
}
