export const OVERLAY_DEFAULTS = {
  tiles: false,
  chat: true,
  backgroundColor: "transparent",
  backgroundHex: "00000000",
  tileColor: "5091A933",
  maxAvatars: 50,
  roomHeight: 266
} as const;

export const OVERLAY_LIMITS = {
  maxAvatars: { min: 1, max: OVERLAY_DEFAULTS.maxAvatars },
  roomHeight: { min: 38, max: 500, sliderMax: 494, step: 38 }
} as const;
