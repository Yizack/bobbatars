export const DEFAULT_PENGUIN_APPEARANCE: PenguinAppearance = {
  ...EMPTY_CLOTHING_PARTS,
  color: "#003366"
};
export const PENGUIN_DANCE_FRAME_INTERVAL = 1000 / 24;
// Snowball atlas groups 27-30 contain 28 frames each.
export const PENGUIN_SNOWBALL_FRAME_COUNT = 28;

interface RenderedPenguinFrame {
  resources: PenguinRenderResources;
  appearance: PenguinAppearance;
  direction: number;
  action: AvatarState["action"];
  frameIndex: number;
  cleanItemFrameIndex: number | null;
  bounds: ReturnType<typeof drawPenguinFrame>;
}

const renderedPenguinFrames = new WeakMap<HTMLCanvasElement, RenderedPenguinFrame>();

export function renderPenguinAvatar (
  avatar: AvatarState,
  image: HTMLImageElement | HTMLCanvasElement | null | undefined,
  resources: PenguinRenderResources | undefined,
  now = performance.now()
): ReturnType<typeof drawPenguinFrame> | null {
  if (!(image instanceof HTMLCanvasElement) || !resources) return null;

  let cleanItemLayer: SpriteLayer | undefined;
  if (avatar.cleaning) {
    cleanItemLayer = resources.clothing.find(({ id }) => id === PENGUIN_CLEAN_HAND_ITEM_ID)?.layer;
  }
  const isCleaning = avatar.cleaning && cleanItemLayer !== undefined;
  let action: AvatarState["action"];
  if (isCleaning) action = "dance1";
  else if (avatar.isSitting) action = "sit";
  else if (avatar.action === "snowball") action = "snowball";
  else if (avatar.danceAction !== null) action = avatar.danceAction;
  else if (avatar.action === "wlk") action = "wlk";
  else action = "std";
  const renderDirection: PenguinDirection = avatar.cleaning ? 3 : avatar.direction as PenguinDirection;
  let sequence: string[];
  if (isCleaning) {
    if (!resources.cleanBodyAction) {
      throw new Error("The penguin clean body action is missing from the sprite resources.");
    }
    sequence = spriteSequenceForGroup(resources.cleanBodyAction, PENGUIN_CLEAN_BODY_ACTION_ID);
  }
  else {
    sequence = spriteSequenceForPose(resources.body, renderDirection, action);
  }
  const elapsed = avatar.animationStartedAt === null ? 0 : Math.max(0, now - avatar.animationStartedAt);
  const isSnowballing = action === "snowball";
  let cleanItemFrameCount = 0;
  if (isCleaning) {
    if (!cleanItemLayer) throw new Error("The penguin cleaning item is missing from the sprite resources.");
    cleanItemFrameCount = spriteSequenceForGroup(cleanItemLayer, PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID).length;
  }
  const isAnimated = action === "wlk" || isSnowballing || isCleaning || (avatar.danceAction !== null && !avatar.isSitting);
  const frameDuration = action === "wlk" ? OVERLAY_SCENE.avatarStepDuration / sequence.length : PENGUIN_DANCE_FRAME_INTERVAL;
  const elapsedFrames = Math.floor(elapsed / frameDuration);
  let frameIndex = 0;
  if (isSnowballing) frameIndex = Math.min(elapsedFrames, sequence.length - 1);
  else if (isCleaning) frameIndex = elapsedFrames % sequence.length;
  else if (isAnimated) frameIndex = elapsedFrames % sequence.length;
  const cleanItemFrameIndex = isCleaning ? elapsedFrames % cleanItemFrameCount : null;
  const appearance = avatar.penguinAppearance;
  const cachedFrame = renderedPenguinFrames.get(image);
  let bounds: ReturnType<typeof drawPenguinFrame>;
  if (
    cachedFrame
    && cachedFrame.resources === resources
    && cachedFrame.direction === renderDirection
    && cachedFrame.action === action
    && cachedFrame.frameIndex === frameIndex
    && cachedFrame.cleanItemFrameIndex === cleanItemFrameIndex
    && cachedFrame.appearance.head === appearance.head
    && cachedFrame.appearance.face === appearance.face
    && cachedFrame.appearance.neck === appearance.neck
    && cachedFrame.appearance.body === appearance.body
    && cachedFrame.appearance.hand === appearance.hand
    && cachedFrame.appearance.feet === appearance.feet
    && cachedFrame.appearance.color === appearance.color
  ) {
    bounds = cachedFrame.bounds;
  }
  else {
    bounds = drawPenguinFrame(
      image,
      resources,
      appearance,
      renderDirection,
      action,
      frameIndex,
      cleanItemFrameIndex
    );
    renderedPenguinFrames.set(image, {
      resources,
      appearance: { ...appearance },
      direction: renderDirection,
      action,
      frameIndex,
      cleanItemFrameIndex,
      bounds
    });
  }
  avatar.imageWidth = bounds.width * 1.08;
  avatar.imageHeight = bounds.height * 1.08;
  return bounds;
}
