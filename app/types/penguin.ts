export type PenguinDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PenguinAction = "std" | "wlk" | "snowball";

export interface PenguinAppearance {
  head: number | null;
  face: number | null;
  neck: number | null;
  body: number | null;
  hand: number | null;
  feet: number | null;
  color: string;
}

export interface PenguinCatalogItem {
  paper_item_id: number;
  type: number;
  cost: number;
  is_member: boolean;
  label: string;
  prompt: string;
  layer: number;
}

export interface PenguinClothingCategory {
  type: number;
  label: string;
}
