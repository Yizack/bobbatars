import type { ComponentPublicInstance } from "vue";
import type { AvatarDanceAction, AvatarDirection, AvatarType } from "./avatar";
import type { PenguinAppearance } from "./penguin";
import type { HabboAvatarResponse } from "./habboAvatar";
import type { PenguinRenderResources } from "../utils/penguinSprites";

export interface Tile {
  column: number;
  row: number;
}

export interface RoomTile extends Tile {
  x: number;
  y: number;
}

export interface ActiveUser {
  login: string;
  displayName: string;
  activity: number;
  lastActivity: number;
  lastMessage: string;
  lastMessageEmoteOffsets: Map<string, string[]>;
  lastMessageAt: number;
  isStreamer: boolean;
  isSitting: boolean;
  danceAction: AvatarDanceAction | null;
  cleaning: boolean;
}

export interface AvatarElements {
  shadow: HTMLElement | null;
  image: HTMLImageElement | HTMLCanvasElement | null;
  clickTarget: HTMLElement | null;
  label: HTMLElement | null;
  popoverAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;
  labelWidth: number;
  labelHeight: number;
}

export type AvatarElementRef = Element | ComponentPublicInstance | null;
export type AvatarPart = "shadow" | "image" | "clickTarget" | "label" | "popoverAnchor" | "menuAnchor";
export type AvatarAction = "std" | "wlk" | "sit" | "snowball" | AvatarDanceAction;
export type AvatarFigureResponse
  = HabboAvatarResponse
    | ({ avatarType: "penguin" } & PenguinAppearance);

export interface AvatarState {
  login: string;
  displayName: string;
  activity: number;
  avatarType: AvatarType;
  profileStatus: "pending" | "registered" | "unregistered";
  fallbackAvatarType: AvatarType;
  figure: string;
  effect: number | null;
  penguinAppearance: PenguinAppearance;
  figureRequestVersion: number;
  avatarFigureReady: boolean;
  cleaning: boolean;
  cleanVersion: number;
  cleanOriginalHand: number | null;
  cleanOriginalResources: PenguinRenderResources | null;
  menuVisible: boolean;
  movementPaused: boolean;
  isSitting: boolean;
  current: Tile | null;
  visual: Tile | null;
  destination: Tile | null;
  direction: AvatarDirection;
  action: AvatarAction;
  danceAction: AvatarDanceAction | null;
  gesture: "std" | "spk";
  currentImage: string;
  imageWidth: number;
  imageHeight: number;
  bubbleMessage: string;
  bubbleEmoteOffsets: Map<string, string[]>;
  bubbleVisible: boolean;
  shadowRef: (element: AvatarElementRef) => void;
  imageRef: (element: AvatarElementRef) => void;
  clickTargetRef: (element: AvatarElementRef) => void;
  labelRef: (element: AvatarElementRef) => void;
  popoverAnchorRef: (element: AvatarElementRef) => void;
  menuAnchorRef: (element: AvatarElementRef) => void;
  isWalking: boolean;
  nextStep: Tile | null;
  animationStartedAt: number | null;
  movementVersion: number;
  randomTimer: number | null;
  waitTimer: number | null;
  snowballTimer: number | null;
  bubbleTimer: number | null;
  gestureTimer: number | null;
  speechVersion: number;
  removed: boolean;
  clearTimers: () => void;
  markRemoved: () => void;
  showChatMessage: (message: string, emoteOffsets: Map<string, string[]>) => Promise<void>;
}
