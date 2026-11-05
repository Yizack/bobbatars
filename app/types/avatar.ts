import type { AvatarDanceAction } from "../utils/avatarCommands";

export type AvatarGender = "M" | "F";
export type AvatarPreviewAction = "std" | "sit" | AvatarDanceAction;
export type AvatarSaveState = "idle" | "saving" | "saved" | "error";
export type HabboHotel = "com" | "es";
export type AvatarLookupState = "idle" | "loading" | "queued" | "success" | "error";

export interface AvatarColor {
  id: string;
  index: number;
  club: number;
  selectable: boolean;
  hex: string;
}

export interface FigureSet {
  id: string;
  label: string;
  gender: AvatarGender | "U";
  colorCount: number;
  nft?: boolean;
}

export interface FigureSetType {
  type: string;
  label: string;
  icon: string;
  paletteId: string;
  sets: FigureSet[];
}

export interface AvatarEffect {
  id: string;
  name: string;
}

export interface AvatarCatalog {
  schemaVersion: number;
  build: string;
  palettes: Record<string, AvatarColor[]>;
  categories: FigureSetType[];
  effects: AvatarEffect[];
}

export interface OutfitPart {
  setId: string;
  colorIds: string[];
}
