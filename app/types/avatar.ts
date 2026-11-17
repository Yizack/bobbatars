import type { AvatarGender } from "./habboAvatar";
import type { PenguinAppearance } from "./penguin";

export type AvatarType = "habbo" | "penguin";
export type DefaultAvatarType = AvatarType | "random";
export type AvatarDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AvatarDanceAction = "dance1" | "dance2" | "dance3" | "dance4";
export type AvatarSaveState = "idle" | "saving" | "saved" | "error";

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

export type AvatarMenuAction
  = | { type: "dance", action: AvatarDanceAction | null }
    | { type: "toggle-sitting" }
    | { type: "clean", action: "start" | "stop" }
    | { type: "refresh" };

export interface AvatarChatCommandDefinition {
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => AvatarChatCommand;
}

export type AvatarPreviewState
  = | { avatarType: "habbo", gender: AvatarGender, figure: string, effect: number | null }
    | ({ avatarType: "penguin" } & PenguinAppearance);
