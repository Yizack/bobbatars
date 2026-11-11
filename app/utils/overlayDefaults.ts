export const OVERLAY_DEFAULTS = {
  tiles: false,
  chat: true,
  backgroundColor: "transparent",
  backgroundHex: "00000000",
  tileColor: "5091A933",
  maxAvatars: 50,
  timeout: 15,
  roomHeight: 266,
  defaultAvatarType: "habbo"
} as const;

export const OVERLAY_LIMITS = {
  maxAvatars: { min: 1, max: OVERLAY_DEFAULTS.maxAvatars },
  timeout: { min: 1, max: 1440 },
  roomHeight: { min: 38, max: 500, sliderMax: 494, step: 38 }
} as const;
