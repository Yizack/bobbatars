<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useIntervalFn, useResizeObserver, useTimeoutFn } from "@vueuse/core";
import { ChatClient } from "@twurple/chat";
import { withQuery } from "ufo";
import { type AvatarDanceAction, avatarDanceActions, parseAvatarChatCommand } from "../utils/avatarCommands";

const props = withDefaults(defineProps<{
  user: string;
  tiles?: boolean;
  tileColor?: string;
  chat?: boolean;
  maxAvatars?: number;
  roomHeight?: number;
  embedded?: boolean;
}>(), {
  tiles: OVERLAY_DEFAULTS.tiles,
  chat: OVERLAY_DEFAULTS.chat,
  tileColor: OVERLAY_DEFAULTS.tileColor,
  maxAvatars: OVERLAY_DEFAULTS.maxAvatars,
  roomHeight: OVERLAY_DEFAULTS.roomHeight,
  embedded: false
});

const roomHeightSetting = computed(() => {
  if (!Number.isInteger(props.roomHeight)) return OVERLAY_DEFAULTS.roomHeight;
  return Math.min(OVERLAY_LIMITS.roomHeight.max, Math.max(OVERLAY_LIMITS.roomHeight.min, props.roomHeight));
});
const normalizedTileColor = computed(() => {
  const digits = (parseHexColor(props.tileColor) ?? `#${OVERLAY_DEFAULTS.tileColor}`).slice(1).toUpperCase();
  const rgb = digits.length === 3 ? [...digits].map(digit => digit.repeat(2)).join("") : digits.slice(0, 6);
  return `#${rgb}${digits.length === 8 ? digits.slice(6) : ""}`;
});
const alternateTileColor = computed(() => {
  const digits = normalizedTileColor.value.slice(1);
  const red = Number.parseInt(digits.slice(0, 2), 16);
  const green = Number.parseInt(digits.slice(2, 4), 16);
  const blue = Number.parseInt(digits.slice(4, 6), 16);
  const opacity = digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1;
  const darken = 0.95;
  // Keep the alternate tile slightly darker while preserving its original opacity ratio.
  return `rgba(${Math.round(red * darken)}, ${Math.round(green * darken)}, ${Math.round(blue * darken)}, ${opacity * 13 / 18})`;
});
const tileStrokeColor = computed(() => normalizedTileColor.value.slice(0, 7));
const tileStrokeOpacity = computed(() => {
  const digits = normalizedTileColor.value.slice(1);
  const opacity = digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1;
  return Math.min(1, opacity * 0.42 / 0.18);
});

interface Tile {
  column: number;
  row: number;
}

interface RoomTile extends Tile {
  x: number;
  y: number;
}

interface PreloadedImage {
  image: HTMLImageElement;
  promise: Promise<HTMLImageElement | null>;
  loaded: boolean;
}

interface ActiveUser {
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
}

interface AvatarElements {
  shadow: HTMLElement | null;
  image: HTMLImageElement | null;
  clickTarget: HTMLElement | null;
  label: HTMLElement | null;
  popoverAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;
  labelWidth: number;
  labelHeight: number;
}

type AvatarElementRef = Element | ComponentPublicInstance | null;
type AvatarPart = "shadow" | "image" | "clickTarget" | "label" | "popoverAnchor" | "menuAnchor";
type AvatarAction = "std" | "wlk" | "sit" | AvatarDanceAction;

interface AvatarState {
  login: string;
  displayName: string;
  activity: number;
  figure: string;
  effect: number | null;
  figureRequestVersion: number;
  menuVisible: boolean;
  movementPaused: boolean;
  isSitting: boolean;
  current: Tile | null;
  visual: Tile | null;
  destination: Tile | null;
  direction: number;
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
  bubbleTimer: number | null;
  gestureTimer: number | null;
  speechVersion: number;
  removed: boolean;
}

const imageEndpoint = "https://habbohistory.com/habbo-imaging/avatarimage.webp";
const defaultFigure = "hd-180-1.hr-100-61.ch-210-66.lg-270-82.sh-290-80";
const danceHeadDirectionOverrides: Partial<Record<number, number>> = {
  3: 2,
  4: 5,
  6: 5,
  7: 0
};
const tileWidth = 76;
const tileHeight = tileWidth / 2;
const stepDuration = 320;
const animationFrameInterval = 1000 / 30;
const maxPreloadedImages = 128;
const chatChannel = props.user.toLowerCase();
const inactiveTimeout = 15 * 60 * 1000;
const knownChatBots = new Set([
  "ankhbot",
  "blerp",
  "botisimo",
  "botrix",
  "coebot",
  "commanderroot",
  "deepbot",
  "fossabot",
  "mixitup",
  "moobot",
  "nightbot",
  "phantombot",
  "pretzel_rocks",
  "sery_bot",
  "soundalerts",
  "streamcaptain",
  "streamcord",
  "streamelements",
  "streamlabs",
  "streamlabscharity",
  "twitchat",
  "wizebot"
]);

function randomSitDirection () {
  return Math.random() < 0.5 ? 2 : 4;
}

const room = ref<HTMLDivElement | null>(null);
const roomTiles = ref<RoomTile[]>([]);
const maxAvatars = computed(() => {
  let requestedLimit: number = OVERLAY_DEFAULTS.maxAvatars;
  if (Number.isInteger(props.maxAvatars)) {
    requestedLimit = Math.min(OVERLAY_LIMITS.maxAvatars.max, Math.max(OVERLAY_LIMITS.maxAvatars.min, props.maxAvatars));
  }
  return Math.min(requestedLimit, roomTiles.value.length);
});
const status = ref("Conectando al chat de Twitch…");
const avatars = ref<AvatarState[]>([]);
const movingAvatars = new Set<AvatarState>();
const activeUsers = new Map<string, ActiveUser>();
const avatarsByUser = new Map<string, AvatarState>();
const avatarElements = new Map<string, AvatarElements>();
const preloadedImages = new Map<string, PreloadedImage>();

let columns = 0;
let rows = 0;
let roomWidth = 0;
let roomLayoutHeight = 0;
let originX = 0;
let originY = 0;
let chatClient: InstanceType<typeof ChatClient> | null = null;
let chatConnected = false;
let isUnmounting = false;
let animationFrame: number | null = null;
let lastAnimationFrameAt = 0;

function imageUrl (
  direction: number,
  action: AvatarState["action"],
  gesture = "std",
  figure = defaultFigure,
  effect: number | null = null
) {
  let headDirection = direction;
  if (action === "dance3" || action === "dance4") {
    headDirection = danceHeadDirectionOverrides[direction] ?? direction;
  }

  return withQuery(imageEndpoint, {
    figure,
    direction,
    head_direction: headDirection,
    gesture,
    action,
    size: "fm",
    format: "webp",
    rv: 55,
    animv: 28,
    position: "bottom",
    ...(effect === null ? {} : { effect: String(effect) })
  });
}

function trimPreloadedImages () {
  while (preloadedImages.size > maxPreloadedImages) {
    let oldestLoadedUrl: string | null = null;
    for (const [url, cached] of preloadedImages) {
      if (cached.loaded) {
        oldestLoadedUrl = url;
        break;
      }
    }
    if (oldestLoadedUrl === null) return;
    preloadedImages.delete(oldestLoadedUrl);
  }
}

function preloadAvatar (
  direction: number,
  action: AvatarState["action"],
  gesture = "std",
  figure = defaultFigure,
  effect: number | null = null
): Promise<HTMLImageElement | null> {
  const url = imageUrl(direction, action, gesture, figure, effect);
  const cached = preloadedImages.get(url);
  if (cached) {
    preloadedImages.delete(url);
    preloadedImages.set(url, cached);
    return cached.promise;
  }

  const image = new Image();
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    image.addEventListener("load", () => {
      const cachedImage = preloadedImages.get(url);
      if (cachedImage?.image === image) {
        cachedImage.loaded = true;
        trimPreloadedImages();
      }
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      if (preloadedImages.get(url)?.image === image) preloadedImages.delete(url);
      console.warn("No se pudo precargar la animación del avatar.");
      resolve(null);
    }, { once: true });
  });
  preloadedImages.set(url, { image, promise, loaded: false });
  image.src = url;
  return promise;
}

async function updateAvatar (
  avatar: AvatarState,
  direction: number,
  action: AvatarAction,
  gesture = avatar.gesture
): Promise<void> {
  avatar.direction = direction;
  avatar.action = avatar.isSitting ? "sit" : avatar.danceAction ?? action;
  avatar.gesture = gesture;
  const nextImage = imageUrl(avatar.direction, avatar.action, avatar.gesture, avatar.figure, avatar.effect);

  if (nextImage === avatar.currentImage && avatar.imageWidth > 0) {
    placeHabbo(avatar);
    return;
  }

  avatar.currentImage = nextImage;
  const image = await preloadAvatar(avatar.direction, avatar.action, avatar.gesture, avatar.figure, avatar.effect);
  if (avatar.removed) return;

  const latestImage = imageUrl(avatar.direction, avatar.action, avatar.gesture, avatar.figure, avatar.effect);
  if (nextImage !== latestImage) {
    await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture);
    return;
  }
  if (!image) throw new Error("No se pudo cargar la imagen del avatar.");

  avatar.imageWidth = image.naturalWidth * 1.08;
  avatar.imageHeight = image.naturalHeight * 1.08;
  await nextTick();
  if (avatar.removed) return;
  if (nextImage !== avatar.currentImage) {
    await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture);
    return;
  }
  placeHabbo(avatar);
}

function positionFor (column: number, row: number) {
  return {
    x: originX + (column - row) * tileWidth / 2,
    y: originY + (column + row) * tileHeight / 2
  };
}

function tilePoints (tile: RoomTile) {
  return [
    `${tile.x},${tile.y - tileHeight / 2}`,
    `${tile.x + tileWidth / 2},${tile.y}`,
    `${tile.x},${tile.y + tileHeight / 2}`,
    `${tile.x - tileWidth / 2},${tile.y}`
  ].join(" ");
}

function isRoomTile (tile: Tile) {
  if (
    tile.column < 0 || tile.column >= columns
    || tile.row < 0 || tile.row >= rows
  ) return false;
  const point = positionFor(tile.column, tile.row);
  const horizontalMargin = Math.min(40, roomWidth * 0.04);
  return point.x >= horizontalMargin && point.x <= roomWidth - horizontalMargin
    && point.y >= roomLayoutHeight * 0.18 && point.y <= roomLayoutHeight - tileHeight / 2;
}

function placeHabbo (avatar: AvatarState) {
  if (!avatar.visual) return;
  const point = positionFor(avatar.visual.column, avatar.visual.row);
  const groundY = point.y + tileHeight * 0.34;
  const depth = Math.round(avatar.visual.column + avatar.visual.row);
  const elements = avatarElements.get(avatar.login);
  const visibleImageHeight = avatar.imageHeight / 2;
  const labelHalfWidth = (elements?.labelWidth ?? 0) / 2;
  const labelHeight = elements?.labelHeight ?? 0;
  const labelX = Math.max(
    labelHalfWidth + 8,
    Math.min(roomWidth - labelHalfWidth - 8, point.x)
  );

  const setPosition = (
    element: HTMLElement | null,
    x: number,
    y: number,
    zIndex?: number
  ) => {
    if (!element) return;
    const transform = `translate3d(${x}px, ${y}px, 0)`;
    if (element.style.transform !== transform) element.style.transform = transform;
    if (zIndex !== undefined && element.style.zIndex !== String(zIndex)) {
      element.style.zIndex = String(zIndex);
    }
  };

  setPosition(elements?.shadow ?? null, point.x - 34 * 0.6, groundY - 14 * 1.2, depth + 1);
  const imageX = point.x - avatar.imageWidth * 0.56;
  const imageY = groundY - visibleImageHeight;
  setPosition(
    elements?.image ?? null,
    imageX,
    imageY,
    depth + 2
  );
  setPosition(
    elements?.clickTarget ?? null,
    imageX + avatar.imageWidth * 0.25,
    imageY,
    depth + 2
  );
  if (elements?.image && avatar.imageWidth > 0) {
    const width = `${avatar.imageWidth}px`;
    const height = `${visibleImageHeight}px`;
    if (elements.image.style.width !== width) elements.image.style.width = width;
    if (elements.image.style.height !== height) elements.image.style.height = height;
  }
  if (elements?.clickTarget && avatar.imageWidth > 0) {
    const width = `${avatar.imageWidth / 4}px`;
    const height = `${visibleImageHeight - 20}px`;
    if (elements.clickTarget.style.width !== width) elements.clickTarget.style.width = width;
    if (elements.clickTarget.style.height !== height) elements.clickTarget.style.height = height;
  }
  setPosition(
    elements?.label ?? null,
    labelX - labelHalfWidth,
    groundY - visibleImageHeight - labelHeight / 2,
    depth + 3
  );
  setPosition(
    elements?.popoverAnchor ?? null,
    point.x,
    groundY - visibleImageHeight - labelHeight * 0.7 + 8
  );
  setPosition(
    elements?.menuAnchor ?? null,
    point.x,
    groundY - visibleImageHeight - labelHeight * 0.7 + 8
  );
}

function setAvatarElement (login: string, part: AvatarPart, value: AvatarElementRef) {
  const elements = avatarElements.get(login) ?? {
    shadow: null,
    image: null,
    clickTarget: null,
    label: null,
    popoverAnchor: null,
    menuAnchor: null,
    labelWidth: 0,
    labelHeight: 0
  };

  if (part === "image") {
    elements.image = typeof HTMLImageElement !== "undefined" && value instanceof HTMLImageElement ? value : null;
  }
  else {
    const element = typeof HTMLElement !== "undefined" && value instanceof HTMLElement ? value : null;
    elements[part] = element;
    if (part === "label" && element) {
      elements.labelWidth = element.offsetWidth;
      elements.labelHeight = element.offsetHeight;
    }
  }

  if (elements.shadow || elements.image || elements.clickTarget || elements.label || elements.popoverAnchor || elements.menuAnchor) {
    avatarElements.set(login, elements);
  }
  else {
    avatarElements.delete(login);
  }

  const avatar = avatarsByUser.get(login);
  if (avatar && value !== null) placeHabbo(avatar);
}

function scheduleAvatarAnimation () {
  if (animationFrame === null) {
    animationFrame = window.requestAnimationFrame(animateAvatarSteps);
  }
}

function stopAvatarAnimation (avatar: AvatarState) {
  movingAvatars.delete(avatar);
  avatar.animationStartedAt = null;
  if (movingAvatars.size === 0 && animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function animateAvatarSteps (now: number) {
  animationFrame = null;
  if (now - lastAnimationFrameAt < animationFrameInterval) {
    if (movingAvatars.size > 0) scheduleAvatarAnimation();
    return;
  }
  lastAnimationFrameAt = now;

  for (const avatar of movingAvatars) {
    const startedAt = avatar.animationStartedAt;
    const current = avatar.current;
    const next = avatar.nextStep;
    if (avatar.removed || avatar.isSitting || startedAt === null || !current || !next) {
      movingAvatars.delete(avatar);
      avatar.animationStartedAt = null;
      continue;
    }

    const progress = Math.min((now - startedAt) / stepDuration, 1);
    avatar.visual = {
      column: current.column + (next.column - current.column) * progress,
      row: current.row + (next.row - current.row) * progress
    };
    placeHabbo(avatar);

    if (progress === 1) {
      avatar.animationStartedAt = null;
      avatar.current = { ...next };
      avatar.visual = { ...next };
      avatar.nextStep = null;
      movingAvatars.delete(avatar);
      void moveNextStep(avatar);
    }
  }

  if (movingAvatars.size > 0) scheduleAvatarAnimation();
}

function updateRoomLayout () {
  const bounds = room.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

  const nextWidth = bounds.width;
  const nextHeight = bounds.height;
  const horizontalMargin = Math.min(40, nextWidth * 0.04);
  const verticalRange = nextHeight * 0.76;
  const requiredGridSize = Math.ceil(
    (nextWidth - horizontalMargin * 2) / (tileWidth / 2)
    + verticalRange / (tileHeight / 2)
  ) + 2;
  const gridSize = Math.max(2, Math.ceil(requiredGridSize / 2) * 2);
  const layoutChanged = nextWidth !== roomWidth || nextHeight !== roomLayoutHeight
    || gridSize !== columns || gridSize !== rows;

  roomWidth = nextWidth;
  roomLayoutHeight = nextHeight;
  columns = gridSize;
  rows = gridSize;
  originX = roomWidth / 2;
  originY = roomLayoutHeight / 2 - (columns + rows - 2) * tileHeight / 4;

  if (layoutChanged) {
    const nextRoomTiles: RoomTile[] = [];
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const tile = { column, row };
        if (!isRoomTile(tile)) continue;
        nextRoomTiles.push({ ...tile, ...positionFor(column, row) });
      }
    }
    roomTiles.value = nextRoomTiles;
    scheduleReconciliation();
  }

  if (layoutChanged && avatars.value.length > 0) {
    for (const avatar of [...avatars.value]) {
      avatar.movementVersion++;
      stopAvatarAnimation(avatar);
      if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
      if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
      avatar.randomTimer = null;
      avatar.waitTimer = null;
      avatar.isWalking = false;
      avatar.nextStep = null;
      avatar.current = null;
      avatar.visual = null;
      avatar.destination = null;
    }

    for (const avatar of avatars.value) {
      const spawn = findFreeTile();
      if (!spawn) {
        removeAvatarState(avatar);
        continue;
      }
      avatar.current = { ...spawn };
      avatar.visual = { ...spawn };
      avatar.destination = { ...spawn };
      placeHabbo(avatar);
      scheduleRandomMove(avatar);
    }
    return;
  }

  avatars.value.forEach(placeHabbo);
}

function habboDirection (deltaColumn: number, deltaRow: number) {
  const directions: Record<string, number> = {
    "1,0": 2,
    "-1,0": 6,
    "0,1": 4,
    "0,-1": 0,
    "1,1": 3,
    "-1,-1": 7,
    "1,-1": 1,
    "-1,1": 5
  };
  const direction = directions[`${deltaColumn},${deltaRow}`];
  if (direction === undefined) {
    throw new Error(`Dirección Habbo no válida: ${deltaColumn},${deltaRow}`);
  }
  return direction;
}

function sameTile (first: Tile | null, second: Tile | null) {
  return first !== null && second !== null
    && first.column === second.column
    && first.row === second.row;
}

function tileKey (tile: Tile) {
  return `${tile.column},${tile.row}`;
}

function occupiedTileKeys (movingAvatar: AvatarState | null) {
  const occupiedTiles = new Set<string>();
  for (const avatar of avatars.value) {
    if (avatar === movingAvatar) continue;
    if (avatar.current) occupiedTiles.add(tileKey(avatar.current));
    if (avatar.nextStep) occupiedTiles.add(tileKey(avatar.nextStep));
    if (avatar.destination) occupiedTiles.add(tileKey(avatar.destination));
  }
  return occupiedTiles;
}

function tileUnavailable (tile: Tile, movingAvatar: AvatarState | null) {
  return avatars.value.some(other => other !== movingAvatar && (
    sameTile(tile, other.current)
    || sameTile(tile, other.nextStep)
    || sameTile(tile, other.destination)
  ));
}

function updateChatStatus () {
  const connection = chatConnected ? `Conectado a #${chatChannel}` : `Conectando a #${chatChannel}`;
  status.value = `${connection} · ${avatars.value.length}/${maxAvatars.value} avatares activos`;
}

function findFreeTile (): Tile | null {
  const occupiedTiles = occupiedTileKeys(null);
  const freeTiles: Tile[] = [];
  for (const roomTile of roomTiles.value) {
    if (!occupiedTiles.has(tileKey(roomTile))) {
      freeTiles.push({ column: roomTile.column, row: roomTile.row });
    }
  }
  if (freeTiles.length === 0) return null;
  return freeTiles[Math.floor(Math.random() * freeTiles.length)] ?? null;
}

function createAvatarState (user: ActiveUser): AvatarState | null {
  const spawn = findFreeTile();
  if (!spawn) return null;

  const avatar = reactive<AvatarState>({
    login: user.login,
    displayName: user.displayName,
    activity: user.activity,
    figure: defaultFigure,
    effect: null,
    figureRequestVersion: 0,
    menuVisible: false,
    movementPaused: false,
    isSitting: user.isSitting,
    current: { ...spawn },
    visual: { ...spawn },
    destination: { ...spawn },
    direction: user.isSitting ? randomSitDirection() : 2,
    action: user.isSitting ? "sit" : "std",
    danceAction: user.danceAction,
    gesture: "std",
    currentImage: "",
    imageWidth: 0,
    imageHeight: 0,
    bubbleMessage: "",
    bubbleEmoteOffsets: new Map(),
    bubbleVisible: false,
    shadowRef: element => setAvatarElement(user.login, "shadow", element),
    imageRef: element => setAvatarElement(user.login, "image", element),
    clickTargetRef: element => setAvatarElement(user.login, "clickTarget", element),
    labelRef: element => setAvatarElement(user.login, "label", element),
    popoverAnchorRef: element => setAvatarElement(user.login, "popoverAnchor", element),
    menuAnchorRef: element => setAvatarElement(user.login, "menuAnchor", element),
    isWalking: false,
    nextStep: null,
    animationStartedAt: null,
    movementVersion: 0,
    randomTimer: null,
    waitTimer: null,
    bubbleTimer: null,
    gestureTimer: null,
    speechVersion: 0,
    removed: false
  });

  avatars.value.push(avatar);
  avatarsByUser.set(user.login, avatar);
  placeHabbo(avatar);
  void refreshAvatarFigure(avatar)
    .catch(error => reportAvatarFetchError(avatar, error));
  void updateAvatar(avatar, avatar.direction, avatar.isSitting ? "sit" : "std")
    .then(() => {
      if (!avatar.removed) scheduleRandomMove(avatar);
    })
    .catch(error => reportAvatarLoadError(avatar, error));
  return avatar;
}

function clearAvatarTimers (avatar: AvatarState) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
  if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
  if (avatar.bubbleTimer !== null) window.clearTimeout(avatar.bubbleTimer);
  if (avatar.gestureTimer !== null) window.clearTimeout(avatar.gestureTimer);
  avatar.randomTimer = null;
  avatar.waitTimer = null;
  avatar.bubbleTimer = null;
  avatar.gestureTimer = null;
}

function removeAvatarState (avatar: AvatarState) {
  avatar.removed = true;
  avatar.movementVersion++;
  stopAvatarAnimation(avatar);
  clearAvatarTimers(avatar);
  avatarElements.delete(avatar.login);
  avatarsByUser.delete(avatar.login);
  const index = avatars.value.indexOf(avatar);
  if (index >= 0) avatars.value.splice(index, 1);
}

function reconcileActiveAvatars () {
  const now = Date.now();
  for (const [login, user] of activeUsers) {
    if (!user.isStreamer && now - user.lastActivity >= inactiveTimeout) activeUsers.delete(login);
  }

  const avatarLimit = maxAvatars.value;
  let streamer: ActiveUser | undefined;
  if (avatarLimit > 0) {
    streamer = [...activeUsers.values()].find(user => user.isStreamer);
  }
  const topUsers = [...activeUsers.values()]
    .filter(user => !user.isStreamer)
    .sort((first, second) =>
      second.activity - first.activity
      || second.lastActivity - first.lastActivity
      || first.login.localeCompare(second.login)
    )
    .slice(0, avatarLimit - (streamer ? 1 : 0));
  if (streamer) topUsers.push(streamer);
  const topLogins = new Set(topUsers.map(user => user.login));

  for (const avatar of [...avatars.value]) {
    if (!topLogins.has(avatar.login)) removeAvatarState(avatar);
  }

  for (const user of topUsers) {
    const avatar = avatarsByUser.get(user.login);
    if (!avatar) {
      const newAvatar = createAvatarState(user);
      if (
        newAvatar
        && user.lastMessage
        && Date.now() - user.lastMessageAt < 3000
      ) {
        void showChatMessage(newAvatar, user.lastMessage, user.lastMessageEmoteOffsets);
      }
      continue;
    }
    const displayNameChanged = avatar.displayName !== user.displayName;
    avatar.displayName = user.displayName;
    avatar.activity = user.activity;
    if (displayNameChanged) {
      void nextTick(() => {
        if (avatar.removed) return;
        const elements = avatarElements.get(avatar.login);
        if (elements?.label) {
          elements.labelWidth = elements.label.offsetWidth;
          elements.labelHeight = elements.label.offsetHeight;
        }
        placeHabbo(avatar);
      });
    }
  }

  updateChatStatus();
}

function setAvatarDance (avatar: AvatarState, danceAction: AvatarDanceAction | null) {
  avatar.danceAction = danceAction;
  const user = activeUsers.get(avatar.login);
  if (user) {
    user.danceAction = danceAction;
    if (danceAction !== null) user.isSitting = false;
  }
  if (danceAction !== null) avatar.isSitting = false;
  const action = avatar.isWalking ? "wlk" : "std";
  void updateAvatar(avatar, avatar.direction, action)
    .then(() => {
      if (!avatar.removed && !avatar.movementPaused && !avatar.isSitting) {
        scheduleRandomMove(avatar);
      }
    })
    .catch(error => reportAvatarLoadError(avatar, error));
}

function isNotFoundError (error: unknown) {
  return error instanceof Error
    && (("statusCode" in error && error.statusCode === 404)
      || ("status" in error && error.status === 404));
}

async function refreshAvatarFigure (avatar: AvatarState) {
  const requestVersion = ++avatar.figureRequestVersion;
  let response: { figure: string, effect: number | null };
  try {
    response = await $fetch<{ figure: string, effect: number | null }>(`/api/avatars/${encodeURIComponent(avatar.login)}`);
  }
  catch (error) {
    if (isNotFoundError(error)) return;
    throw error;
  }

  if (
    avatar.removed
    || requestVersion !== avatar.figureRequestVersion
    || (avatar.figure === response.figure && avatar.effect === response.effect)
  ) return;

  avatar.figure = response.figure;
  avatar.effect = response.effect;
  await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture);
}

function reportAvatarFetchError (avatar: AvatarState, error: unknown) {
  if (avatar.removed) return;
  status.value = `No se pudo obtener el avatar de ${avatar.login}.`;
  console.info(error);
}

function handleAvatarMenuOpenChange (avatar: AvatarState, isOpen: boolean) {
  if (isOpen) {
    for (const otherAvatar of avatars.value) {
      if (otherAvatar !== avatar) updateAvatarMenuVisibility(otherAvatar, false);
    }
  }
  updateAvatarMenuVisibility(avatar, isOpen);
}

function updateAvatarMenuVisibility (avatar: AvatarState, isOpen: boolean) {
  avatar.menuVisible = isOpen;
  if (isOpen) {
    pauseAvatarMovement(avatar);
    return;
  }
  resumeAvatarMovement(avatar);
}

function pauseAvatarMovement (avatar: AvatarState) {
  if (avatar.removed || avatar.movementPaused) return;
  avatar.movementPaused = true;
  stopAvatarMovement(avatar);
  if (avatar.current) {
    void updateAvatar(avatar, avatar.direction, "std")
      .catch(error => reportAvatarLoadError(avatar, error));
  }
}

function stopAvatarMovement (avatar: AvatarState) {
  avatar.movementVersion++;
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
  if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
  avatar.randomTimer = null;
  avatar.waitTimer = null;
  stopAvatarAnimation(avatar);
  avatar.isWalking = false;
  avatar.nextStep = null;
  avatar.destination = avatar.current ? { ...avatar.current } : null;
  avatar.visual = avatar.current ? { ...avatar.current } : null;
  if (avatar.current) placeHabbo(avatar);
}

function resumeAvatarMovement (avatar: AvatarState) {
  if (!avatar.movementPaused) return;
  avatar.movementPaused = false;
  if (!avatar.removed && !avatar.isSitting) scheduleRandomMove(avatar);
}

function refreshAvatarFromMenu (avatar: AvatarState) {
  updateAvatarMenuVisibility(avatar, false);
  void refreshAvatarFigure(avatar)
    .catch(error => reportAvatarFetchError(avatar, error));
}

function setAvatarDanceFromMenu (avatar: AvatarState, danceAction: AvatarDanceAction | null) {
  setAvatarDance(avatar, danceAction);
  updateAvatarMenuVisibility(avatar, false);
}

function setAvatarSitting (avatar: AvatarState, isSitting: boolean) {
  avatar.isSitting = isSitting;
  avatar.danceAction = null;
  const user = activeUsers.get(avatar.login);
  if (user) {
    user.isSitting = isSitting;
    user.danceAction = null;
  }

  stopAvatarMovement(avatar);
  if (isSitting) avatar.direction = randomSitDirection();

  void updateAvatar(avatar, avatar.direction, isSitting ? "sit" : "std")
    .then(() => {
      if (!avatar.removed && !avatar.movementPaused && !avatar.isSitting) {
        scheduleRandomMove(avatar);
      }
    })
    .catch(error => reportAvatarLoadError(avatar, error));
}

function toggleAvatarSittingFromMenu (avatar: AvatarState) {
  setAvatarSitting(avatar, !avatar.isSitting);
  updateAvatarMenuVisibility(avatar, false);
}

function avatarMenuItems (avatar: AvatarState): DropdownMenuItem[] {
  const items: DropdownMenuItem[] = [
    {
      label: "Dances",
      icon: "pixelarticons:music",
      children: avatarDanceActions.map((danceAction, index) => ({
        label: `Dance ${index + 1}`,
        onSelect: () => setAvatarDanceFromMenu(avatar, danceAction)
      }))
    }
  ];

  if (avatar.danceAction !== null) {
    items.push({
      label: "Stop Dance",
      icon: "pixelarticons:square",
      onSelect: () => setAvatarDanceFromMenu(avatar, null)
    });
  }

  items.push(
    {
      label: avatar.isSitting ? "Stand Up" : "Sit",
      icon: "pixelarticons:sofa",
      onSelect: () => toggleAvatarSittingFromMenu(avatar)
    },
    {
      label: "Refresh Avatar",
      icon: "pixelarticons:reload",
      onSelect: () => refreshAvatarFromMenu(avatar)
    }
  );

  return items;
}

function recordChatActivity (username: string, message: string, twitchDisplayName: string, emoteOffsets: Map<string, string[]>) {
  const messageText = String(message || "");
  const login = String(username || "").trim().toLowerCase();
  if (!login || knownChatBots.has(login)) return;
  const displayName = String(twitchDisplayName || username).trim();
  const command = parseAvatarChatCommand(messageText);
  const stopCommand = (command?.type === "dance" && command.action === null) || command?.type === "stand";
  if (messageText.trimStart().startsWith("!") && !command) return;

  const now = Date.now();
  let user = activeUsers.get(login);
  if (!user || (!user.isStreamer && now - user.lastActivity >= inactiveTimeout)) {
    if (stopCommand) return;
    user = {
      login,
      displayName,
      activity: 0,
      lastActivity: now,
      lastMessage: "",
      lastMessageEmoteOffsets: new Map(),
      lastMessageAt: 0,
      isStreamer: login === chatChannel,
      isSitting: false,
      danceAction: null
    };
    activeUsers.set(login, user);
  }
  user.displayName = displayName;
  user.activity++;
  user.lastActivity = now;

  if (command?.type === "dance") {
    user.lastMessage = "";
    user.lastMessageEmoteOffsets = new Map();
    user.lastMessageAt = 0;
    user.danceAction = command.action;
    if (command.action !== null) user.isSitting = false;
    const avatar = avatarsByUser.get(login);
    if (avatar) setAvatarDance(avatar, command.action);
    scheduleReconciliation();
    return;
  }

  if (command?.type === "sit" || command?.type === "stand") {
    user.lastMessage = "";
    user.lastMessageEmoteOffsets = new Map();
    user.lastMessageAt = 0;
    const isSitting = command.type === "sit";
    user.isSitting = isSitting;
    user.danceAction = null;
    const avatar = avatarsByUser.get(login);
    if (avatar) setAvatarSitting(avatar, isSitting);
    scheduleReconciliation();
    return;
  }

  if (command?.type === "refresh-avatar") {
    user.lastMessage = "";
    user.lastMessageEmoteOffsets = new Map();
    user.lastMessageAt = 0;
    const avatar = avatarsByUser.get(command.target ?? login);
    if (avatar) {
      void refreshAvatarFigure(avatar)
        .catch(error => reportAvatarFetchError(avatar, error));
    }
    scheduleReconciliation();
    return;
  }

  user.lastMessage = messageText;
  user.lastMessageEmoteOffsets = emoteOffsets;
  user.lastMessageAt = now;

  const avatar = avatarsByUser.get(login);
  if (avatar && messageText.trim()) void showChatMessage(avatar, messageText, emoteOffsets);
  scheduleReconciliation();
}

async function showChatMessage (avatar: AvatarState, message: string, emoteOffsets: Map<string, string[]>) {
  if (avatar.removed || !message.trim()) return;

  avatar.bubbleMessage = message;
  avatar.bubbleEmoteOffsets = emoteOffsets;
  avatar.bubbleVisible = true;
  window.clearTimeout(avatar.bubbleTimer ?? undefined);
  avatar.bubbleTimer = window.setTimeout(() => {
    if (avatar.removed) return;
    avatar.bubbleVisible = false;
    avatar.bubbleTimer = null;
  }, 5000);

  window.clearTimeout(avatar.gestureTimer ?? undefined);
  const speechVersion = ++avatar.speechVersion;
  avatar.gesture = "spk";
  await nextTick();
  if (avatar.removed) return;
  placeHabbo(avatar);

  try {
    await updateAvatar(avatar, avatar.direction, avatar.action, "spk");
  }
  catch (error) {
    reportAvatarLoadError(avatar, error);
    return;
  }
  if (avatar.removed || speechVersion !== avatar.speechVersion) return;

  avatar.gestureTimer = window.setTimeout(() => {
    avatar.gestureTimer = null;
    if (avatar.removed || speechVersion !== avatar.speechVersion) return;
    avatar.gesture = "std";
    void updateAvatar(avatar, avatar.direction, avatar.action, "std")
      .catch(error => reportAvatarLoadError(avatar, error));
  }, 5000);
}

async function moveNextStep (avatar: AvatarState) {
  if (avatar.removed || avatar.movementPaused || avatar.isSitting || !avatar.current || !avatar.destination) return;
  const movementVersion = avatar.movementVersion;
  const reportError = (error: unknown) => {
    if (movementVersion === avatar.movementVersion) {
      reportAvatarLoadError(avatar, error);
    }
  };

  if (sameTile(avatar.current, avatar.destination)) {
    try {
      await updateAvatar(avatar, avatar.direction, "std");
    }
    catch (error) {
      reportError(error);
      return;
    }
    if (avatar.removed || movementVersion !== avatar.movementVersion) return;
    if (!sameTile(avatar.current, avatar.destination)) {
      void moveNextStep(avatar);
      return;
    }
    avatar.isWalking = false;
    avatar.nextStep = null;
    scheduleRandomMove(avatar);
    return;
  }

  const deltaColumn = Math.sign(avatar.destination.column - avatar.current.column);
  const deltaRow = Math.sign(avatar.destination.row - avatar.current.row);
  const next = {
    column: avatar.current.column + deltaColumn,
    row: avatar.current.row + deltaRow
  };
  if (tileUnavailable(next, avatar)) {
    avatar.nextStep = null;
    if (avatar.action === "std" || avatar.danceAction !== null) {
      avatar.destination = { ...avatar.current };
      avatar.isWalking = false;
      scheduleRandomMove(avatar);
      return;
    }

    try {
      await updateAvatar(avatar, avatar.direction, "std");
    }
    catch (error) {
      reportError(error);
      return;
    }
    if (avatar.removed || movementVersion !== avatar.movementVersion) return;
    avatar.waitTimer = window.setTimeout(() => {
      avatar.waitTimer = null;
      void moveNextStep(avatar);
    }, 250);
    return;
  }

  avatar.nextStep = next;
  const nextDirection = habboDirection(deltaColumn, deltaRow);
  void preloadAvatar(nextDirection, "std", "std", avatar.figure, avatar.effect);

  try {
    await updateAvatar(avatar, nextDirection, "wlk");
  }
  catch (error) {
    reportError(error);
    return;
  }
  if (avatar.removed || movementVersion !== avatar.movementVersion) return;
  if (sameTile(avatar.current, avatar.destination)) {
    avatar.nextStep = null;
    void moveNextStep(avatar);
    return;
  }

  const latestColumn = Math.sign(avatar.destination.column - avatar.current.column);
  const latestRow = Math.sign(avatar.destination.row - avatar.current.row);
  if (habboDirection(latestColumn, latestRow) !== avatar.direction) {
    avatar.nextStep = null;
    void moveNextStep(avatar);
    return;
  }

  avatar.animationStartedAt = performance.now();
  movingAvatars.add(avatar);
  scheduleAvatarAnimation();
}

function reportAvatarLoadError (avatar: AvatarState | null, error: unknown) {
  if (avatar) {
    if (avatar.removed) return;
    avatar.isWalking = false;
    avatar.nextStep = null;
    if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
    avatar.waitTimer = null;
  }
  status.value = "No se pudo cargar la imagen del avatar. Revisa tu conexión con habbohistory.com.";
  console.info(error);
}

function scheduleRandomMove (avatar: AvatarState, delay = 1200 + Math.random() * 3800) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
  avatar.randomTimer = null;
  if (avatar.removed || avatar.movementPaused || avatar.isSitting || !avatar.current) return;
  avatar.randomTimer = window.setTimeout(() => {
    avatar.randomTimer = null;
    if (avatar.removed || avatar.movementPaused || avatar.isSitting || !avatar.current) return;
    const occupiedTiles = occupiedTileKeys(avatar);
    const optionsByDistance: Tile[][] = [[], [], []];
    for (let columnStep = -4; columnStep <= 4; columnStep++) {
      for (let rowStep = -4; rowStep <= 4; rowStep++) {
        const distance = Math.max(Math.abs(columnStep), Math.abs(rowStep));
        if (distance === 0) continue;
        const tile = {
          column: avatar.current.column + columnStep,
          row: avatar.current.row + rowStep
        };
        if (isRoomTile(tile) && !occupiedTiles.has(tileKey(tile))) {
          optionsByDistance[distance - 1]?.push(tile);
        }
      }
    }

    const availableOptions = optionsByDistance.filter(options => options.length > 0);
    if (availableOptions.length === 0) {
      scheduleRandomMove(avatar, 300);
      return;
    }

    const options = availableOptions[Math.floor(Math.random() * availableOptions.length)];
    const destination = options?.[Math.floor(Math.random() * options.length)];
    if (!destination) {
      scheduleRandomMove(avatar, 300);
      return;
    }
    avatar.destination = destination;
    walk(avatar);
  }, delay);
}

function walk (avatar: AvatarState) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
  avatar.randomTimer = null;
  if (avatar.removed || avatar.movementPaused || avatar.isSitting || avatar.isWalking) return;
  avatar.isWalking = true;
  void moveNextStep(avatar);
}

async function connectToChat () {
  try {
    chatClient = new ChatClient({
      channels: [chatChannel],
      webSocket: true
    });
    chatClient.onConnect(() => {
      if (isUnmounting) return;
      chatConnected = true;
      updateChatStatus();
    });
    chatClient.onDisconnect(() => {
      if (isUnmounting) return;
      chatConnected = false;
      updateChatStatus();
    });
    chatClient.onMessage((channel, username, message, msg) => {
      if (channel.replace(/^#/, "").toLowerCase() === chatChannel) {
        recordChatActivity(username, message, msg.userInfo.displayName ?? username, msg.emoteOffsets);
      }
    });
    chatClient.connect();
  }
  catch (error) {
    if (isUnmounting) return;
    status.value = `No se pudo conectar al chat #${chatChannel}.`;
    console.info(error);
  }
}

function ensureStreamerActive () {
  if (!chatChannel || activeUsers.has(chatChannel)) return;

  activeUsers.set(chatChannel, {
    login: chatChannel,
    displayName: props.user,
    activity: 0,
    lastActivity: Date.now(),
    lastMessage: "",
    lastMessageEmoteOffsets: new Map(),
    lastMessageAt: 0,
    isStreamer: true,
    isSitting: false,
    danceAction: null
  });
}

const avatarReconcileInterval = useIntervalFn(reconcileActiveAvatars, 5000, {
  immediate: false
});
const {
  start: scheduleReconciliation,
  stop: stopReconciliation
} = useTimeoutFn(reconcileActiveAvatars, 250, { immediate: false });

useResizeObserver(room, () => updateRoomLayout());

onMounted(() => {
  updateRoomLayout();
  ensureStreamerActive();
  reconcileActiveAvatars();
  avatarReconcileInterval.resume();
  void connectToChat();
});

onBeforeUnmount(() => {
  isUnmounting = true;
  avatarReconcileInterval.pause();
  stopReconciliation();
  chatClient?.quit();
  chatClient = null;

  for (const avatar of [...avatars.value]) removeAvatarState(avatar);
  avatarElements.clear();
  activeUsers.clear();
  preloadedImages.clear();
});
</script>

<template>
  <div
    :class="props.embedded ? 'absolute inset-0' : 'fixed inset-0'"
    class="flex w-full items-end overflow-hidden [font-family:Trebuchet_MS,Arial,sans-serif]"
  >
    <section
      :style="{ height: `min(${roomHeightSetting}px, ${props.embedded ? '100%' : '100vh'})` }"
      class="w-full"
      aria-label="Sala Habbo"
    >
      <div ref="room" class="relative h-full w-full">
        <svg v-if="props.tiles" class="pointer-events-none absolute inset-0 z-0 size-full" aria-hidden="true">
          <polygon
            v-for="tile in roomTiles"
            :key="`${tile.column}-${tile.row}`"
            :points="tilePoints(tile)"
            :fill="(tile.column + tile.row) % 2 === 0 ? normalizedTileColor : alternateTileColor"
            :stroke="tileStrokeColor"
            :stroke-opacity="tileStrokeOpacity"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        <p class="sr-only" role="status" aria-live="polite">
          {{ status }}
        </p>

        <template v-for="avatar in avatars" :key="avatar.login">
          <div
            :ref="avatar.shadowRef"
            class="pointer-events-none absolute left-0.5 -top-1 z-[1] h-[18px] w-[38px] rounded-[50%] bg-[rgba(15,21,29,0.42)]"
            aria-hidden="true"
          />
          <AvatarPreviewImage
            v-if="avatar.currentImage"
            :image-ref="avatar.imageRef"
            class="pointer-events-none absolute left-3.5 z-[2] h-auto max-w-full select-none"
            :class="avatar.isSitting ? 'top-1' : '-top-1.5'"
            :src="avatar.currentImage"
            :alt="`Avatar de ${avatar.displayName}`"
            aria-hidden="true"
            draggable="false"
          />
          <UDropdownMenu
            v-if="avatar.currentImage"
            :open="avatar.menuVisible"
            :items="avatarMenuItems(avatar)"
            size="sm"
            :content="{
              side: 'top',
              sideOffset: 8,
              collisionPadding: 8,
              updatePositionStrategy: 'always',
              reference: avatarElements.get(avatar.login)?.menuAnchor ?? undefined,
            }"
            :modal="false"
            arrow
            :ui="{
              content: 'z-50 w-max rounded-[8px] border border-[rgba(198,219,233,0.3)] bg-[rgba(15,21,29,0.96)] p-0 shadow-lg ring-0',
              group: 'flex flex-col gap-1 p-1 isolate',
              item: 'justify-start text-[#f5f2e9]',
              arrow: 'fill-[rgba(15,21,29,0.96)]',
            }"
            @update:open="isOpen => handleAvatarMenuOpenChange(avatar, isOpen)"
          >
            <button
              :ref="avatar.clickTargetRef"
              type="button"
              class="pointer-events-auto absolute left-10 z-[2] max-w-full cursor-pointer border-0 bg-transparent p-0"
              :class="avatar.isSitting ? 'top-6' : 'top-4'"
              :aria-label="`Opciones para el avatar de ${avatar.displayName}`"
            />
            <template #content-top="{ sub }">
              <p
                v-if="!sub"
                role="heading"
                aria-level="2"
                :title="avatar.displayName"
                class="mb-1 max-w-[min(220px,calc(100vw_-_40px))] border-b border-[rgba(198,219,233,0.2)] px-2 p-1 text-sm font-semibold leading-tight text-[#f5f2e9] whitespace-normal [overflow-wrap:anywhere]"
              >
                {{ avatar.displayName }}
              </p>
            </template>
          </UDropdownMenu>
          <span
            :ref="avatar.menuAnchorRef"
            class="pointer-events-none absolute left-0 top-5 h-0 w-0"
            aria-hidden="true"
          />
          <span
            :ref="avatar.labelRef"
            class="pointer-events-none absolute left-0 top-6 z-[3] w-max max-w-[min(180px,calc(100%_-_16px))] overflow-hidden rounded-[5px] border border-[rgba(198,219,233,0.2)] bg-[rgba(15,21,29,0.86)] px-[6px] py-[2px] text-[11px] leading-[1.2] text-[#f5f2e9] truncate font-[Ubuntu]"
            :title="`${avatar.displayName}: ${avatar.activity} mensajes`"
          >
            {{ avatar.displayName }}
          </span>
          <UPopover
            v-if="props.chat && avatar.bubbleVisible"
            :open="true"
            :dismissible="false"
            :content="{ side: 'top', sideOffset: 8, collisionPadding: 8, updatePositionStrategy: 'always' }"
            arrow
            :ui="{
              content: 'z-50 pointer-events-none w-max max-w-[min(240px,calc(100vw_-_24px))] overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.95)] px-[9px] py-[7px] text-[13px] leading-[1.3] text-[#202630] whitespace-pre-wrap [overflow-wrap:anywhere]',
              arrow: 'fill-white',
            }"
          >
            <template #anchor>
              <span
                :ref="avatar.popoverAnchorRef"
                class="pointer-events-none absolute left-0 top-5 h-0 w-0"
                aria-hidden="true"
              />
            </template>
            <template #content>
              <ChatEmotes :text="avatar.bubbleMessage" :emote-offsets="avatar.bubbleEmoteOffsets" :user="user" class="font-[Ubuntu]" />
            </template>
          </UPopover>
        </template>
      </div>
    </section>
  </div>
</template>
