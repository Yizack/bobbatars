export type AvatarType = "habbo" | "penguin";
export type DefaultAvatarType = AvatarType | "random";
export type AvatarGender = "M" | "F";
export type AvatarDanceAction = "dance1" | "dance2" | "dance3" | "dance4";
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

export interface AvatarCommand {
  command: string;
  description: string;
  alias?: string[];
}

export type AvatarChatCommand
  = | { type: "dance", action: AvatarDanceAction | null }
    | { type: "sit" | "stand" }
    | { type: "snowball", target: string | null }
    | { type: "clean", action: "start" | "stop" }
    | { type: "refresh-avatar", target: string | null };

export interface AvatarChatCommandDefinition {
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => AvatarChatCommand;
}
