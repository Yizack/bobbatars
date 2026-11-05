<script setup lang="ts">
import { useIntervalFn, useResizeObserver, useTimeoutFn } from "@vueuse/core";
import type { ChatClient as TwitchChatClient } from "@twurple/chat";
import { withQuery } from "ufo";
import { type AvatarDanceAction, avatarDanceActions, parseAvatarChatCommand } from "../utils/avatarCommands";

const props = defineProps<{
  user: string;
}>();

interface Tile {
  column: number;
  row: number;
}

interface ActiveUser {
  login: string;
  displayName: string;
  activity: number;
  lastActivity: number;
  lastMessage: string;
  lastMessageAt: number;
  isSitting: boolean;
  danceAction: AvatarDanceAction | null;
}

interface AvatarElements {
  shadow: HTMLElement | null;
  image: HTMLImageElement | null;
  label: HTMLElement | null;
  popoverAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;
  labelWidth: number;
  labelHeight: number;
}

type AvatarElementRef = Element | ComponentPublicInstance | null;
type AvatarPart = "shadow" | "image" | "label" | "popoverAnchor" | "menuAnchor";
type AvatarAction = "std" | "wlk" | "sit" | AvatarDanceAction;

interface AvatarState {
  login: string;
  displayName: string;
  activity: number;
  figure: string;
  effect: number | null;
  figureRequestVersion: number;
  menuVisible: boolean;
  danceMenuVisible: boolean;
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
  bubbleVisible: boolean;
  shadowRef: (element: AvatarElementRef) => void;
  imageRef: (element: AvatarElementRef) => void;
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
const chatChannel = props.user.toLowerCase();
const maxAvatars = 50;
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
const status = ref("Conectando al chat de Twitch…");
const avatars = ref<AvatarState[]>([]);
const movingAvatars = new Set<AvatarState>();
const activeUsers = new Map<string, ActiveUser>();
const avatarsByUser = new Map<string, AvatarState>();
const avatarElements = new Map<string, AvatarElements>();
const preloadedImages = new Map<string, {
  image: HTMLImageElement;
  promise: Promise<HTMLImageElement | null>;
}>();

let columns = 0;
let rows = 0;
let roomWidth = 0;
let roomHeight = 0;
let originX = 0;
let originY = 0;
let chatClient: TwitchChatClient | null = null;
let chatConnected = false;
let isUnmounting = false;
let animationFrame: number | null = null;

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
    size: "m",
    format: "webp",
    rv: 55,
    animv: 28,
    ...(effect === null ? {} : { effect: String(effect) })
  });
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
  if (cached) return cached.promise;

  const image = new Image();
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => {
      preloadedImages.delete(url);
      console.warn("No se pudo precargar la animación del avatar.");
      resolve(null);
    }, { once: true });
  });
  preloadedImages.set(url, { image, promise });
  image.src = url;
  return promise;
}

async function preloadAllWalkAnimations () {
  let nextDirection = 0;
  const loadNext = async () => {
    while (nextDirection < 8) {
      const directionToLoad = nextDirection++;
      await preloadAvatar(directionToLoad, "wlk");
    }
  };
  await Promise.all([loadNext(), loadNext()]);
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

function isRoomTile (tile: Tile) {
  if (
    tile.column < 0 || tile.column >= columns
    || tile.row < 0 || tile.row >= rows
  ) return false;
  const point = positionFor(tile.column, tile.row);
  const horizontalMargin = Math.min(40, roomWidth * 0.04);
  return point.x >= horizontalMargin && point.x <= roomWidth - horizontalMargin
    && point.y >= roomHeight * 0.18 && point.y <= roomHeight * 0.94;
}

function placeHabbo (avatar: AvatarState) {
  if (!avatar.visual) return;
  const point = positionFor(avatar.visual.column, avatar.visual.row);
  const groundY = point.y + tileHeight * 0.34;
  const depth = Math.round(avatar.visual.column + avatar.visual.row);
  const elements = avatarElements.get(avatar.login);
  const imageHeight = avatar.imageHeight;
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
  setPosition(
    elements?.image ?? null,
    point.x - avatar.imageWidth * 0.56,
    groundY - imageHeight,
    depth + 2
  );
  if (elements?.image && avatar.imageWidth > 0) {
    const width = `${avatar.imageWidth}px`;
    if (elements.image.style.width !== width) elements.image.style.width = width;
  }
  setPosition(
    elements?.label ?? null,
    labelX - labelHalfWidth,
    groundY - imageHeight - labelHeight / 2,
    depth + 3
  );
  setPosition(
    elements?.popoverAnchor ?? null,
    point.x,
    groundY - imageHeight - labelHeight * 0.7 + 8
  );
  setPosition(
    elements?.menuAnchor ?? null,
    point.x,
    groundY - imageHeight - labelHeight * 0.7 + 8
  );
}

function setAvatarElement (login: string, part: AvatarPart, value: AvatarElementRef) {
  const elements = avatarElements.get(login) ?? {
    shadow: null,
    image: null,
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

  if (elements.shadow || elements.image || elements.label || elements.popoverAnchor || elements.menuAnchor) {
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
  if (!bounds) return;

  const nextWidth = bounds.width;
  const nextHeight = bounds.height;
  const horizontalMargin = Math.min(40, nextWidth * 0.04);
  const verticalRange = nextHeight * 0.76;
  const requiredGridSize = Math.ceil(
    (nextWidth - horizontalMargin * 2) / (tileWidth / 2)
    + verticalRange / (tileHeight / 2)
  ) + 2;
  const gridSize = Math.max(2, Math.ceil(requiredGridSize / 2) * 2);
  const layoutChanged = nextWidth !== roomWidth || nextHeight !== roomHeight
    || gridSize !== columns || gridSize !== rows;

  roomWidth = nextWidth;
  roomHeight = nextHeight;
  columns = gridSize;
  rows = gridSize;
  originX = roomWidth / 2;
  originY = roomHeight / 2 - (columns + rows - 2) * tileHeight / 4;

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

function tileUnavailable (tile: Tile, movingAvatar: AvatarState | null) {
  return avatars.value.some(other => other !== movingAvatar && (
    sameTile(tile, other.current)
    || sameTile(tile, other.nextStep)
    || sameTile(tile, other.destination)
  ));
}

function updateChatStatus () {
  const connection = chatConnected ? `Conectado a #${chatChannel}` : `Conectando a #${chatChannel}`;
  status.value = `${connection} · ${avatars.value.length}/${maxAvatars} avatares activos`;
}

function findFreeTile (): Tile | null {
  const freeTiles: Tile[] = [];
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const tile = { column, row };
      if (isRoomTile(tile) && !tileUnavailable(tile, null)) freeTiles.push(tile);
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
    danceMenuVisible: false,
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
    bubbleVisible: false,
    shadowRef: element => setAvatarElement(user.login, "shadow", element),
    imageRef: element => setAvatarElement(user.login, "image", element),
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
    if (now - user.lastActivity >= inactiveTimeout) activeUsers.delete(login);
  }

  const topUsers = [...activeUsers.values()]
    .sort((first, second) =>
      second.activity - first.activity
      || second.lastActivity - first.lastActivity
      || first.login.localeCompare(second.login)
    )
    .slice(0, maxAvatars);
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
        void showChatMessage(newAvatar, user.lastMessage);
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

function toggleAvatarMenu (avatar: AvatarState) {
  const shouldOpen = !avatar.menuVisible;
  for (const otherAvatar of avatars.value) {
    if (otherAvatar !== avatar) updateAvatarMenuVisibility(otherAvatar, false);
  }
  updateAvatarMenuVisibility(avatar, shouldOpen);
}

function toggleDanceMenu (avatar: AvatarState) {
  avatar.danceMenuVisible = !avatar.danceMenuVisible;
}

function updateAvatarMenuVisibility (avatar: AvatarState, isOpen: boolean) {
  avatar.menuVisible = isOpen;
  if (isOpen) {
    pauseAvatarMovement(avatar);
    return;
  }
  avatar.danceMenuVisible = false;
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

function recordChatActivity (username: string, message: string, twitchDisplayName: string) {
  const messageText = String(message || "");
  const login = String(username || "").trim().toLowerCase();
  if (!login || knownChatBots.has(login)) return;
  const displayName = String(twitchDisplayName || username).trim();
  const command = parseAvatarChatCommand(messageText);
  const stopCommand = (command?.type === "dance" && command.action === null) || command?.type === "stand";
  if (messageText.trimStart().startsWith("!") && !command) return;

  const now = Date.now();
  let user = activeUsers.get(login);
  if (!user || now - user.lastActivity >= inactiveTimeout) {
    if (stopCommand) return;
    user = {
      login,
      displayName,
      activity: 0,
      lastActivity: now,
      lastMessage: "",
      lastMessageAt: 0,
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
  user.lastMessageAt = now;

  const avatar = avatarsByUser.get(login);
  if (avatar && messageText.trim()) void showChatMessage(avatar, messageText);
  scheduleReconciliation();
}

async function showChatMessage (avatar: AvatarState, message: string) {
  if (avatar.removed || !message.trim()) return;

  avatar.bubbleMessage = message;
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

function scheduleRandomMove (avatar: AvatarState, delay = 1200 + Math.random() * 1800) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
  avatar.randomTimer = null;
  if (avatar.removed || avatar.movementPaused || avatar.isSitting || !avatar.current) return;
  avatar.randomTimer = window.setTimeout(() => {
    avatar.randomTimer = null;
    if (avatar.removed || avatar.movementPaused || avatar.isSitting || !avatar.current) return;
    const optionsByDistance: Tile[][] = [[], [], []];
    for (let columnStep = -3; columnStep <= 3; columnStep++) {
      for (let rowStep = -3; rowStep <= 3; rowStep++) {
        const distance = Math.max(Math.abs(columnStep), Math.abs(rowStep));
        if (distance === 0) continue;
        const tile = {
          column: avatar.current.column + columnStep,
          row: avatar.current.row + rowStep
        };
        if (isRoomTile(tile) && !tileUnavailable(tile, avatar)) {
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
    const { ChatClient } = await import("@twurple/chat");
    if (isUnmounting) return;

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
        recordChatActivity(username, message, msg.userInfo.displayName ?? username);
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
  avatarReconcileInterval.resume();
  void preloadAvatar(2, "std").then((image) => {
    if (image) return preloadAllWalkAnimations();
  });
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
  <main class="fixed inset-0 flex w-full items-end overflow-hidden [font-family:Trebuchet_MS,Arial,sans-serif]">
    <section class="h-[min(266px,100vh)] w-full" aria-label="Sala Habbo">
      <div ref="room" class="relative h-full w-full">
        <p class="sr-only" role="status" aria-live="polite">
          {{ status }}
        </p>

        <template v-for="avatar in avatars" :key="avatar.login">
          <div
            :ref="avatar.shadowRef"
            class="pointer-events-none absolute left-0 top-0 z-[1] h-[14px] w-[34px] rounded-[50%] bg-[rgba(15,21,29,0.42)]"
            aria-hidden="true"
          />
          <img
            v-if="avatar.currentImage"
            :ref="avatar.imageRef"
            class="pointer-events-auto absolute left-0 top-0 z-[2] h-auto max-w-full cursor-pointer select-none"
            :src="avatar.currentImage"
            :alt="`Avatar de ${avatar.displayName}`"
            :aria-label="`Opciones para el avatar de ${avatar.displayName}`"
            :aria-expanded="avatar.menuVisible"
            aria-haspopup="menu"
            role="button"
            tabindex="0"
            draggable="false"
            @click.left="toggleAvatarMenu(avatar)"
            @keydown.enter.prevent="toggleAvatarMenu(avatar)"
            @keydown.space.prevent="toggleAvatarMenu(avatar)"
          >
          <span
            :ref="avatar.labelRef"
            class="pointer-events-none absolute left-0 top-0 z-[3] w-max max-w-[min(180px,calc(100%_-_16px))] overflow-hidden rounded-[5px] border border-[rgba(198,219,233,0.2)] bg-[rgba(15,21,29,0.86)] px-[6px] py-[2px] text-[11px] leading-[1.2] text-[#f5f2e9] truncate"
            :title="`${avatar.displayName}: ${avatar.activity} mensajes`"
          >
            {{ avatar.displayName }}
          </span>
          <UPopover
            :open="avatar.bubbleVisible"
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
                class="pointer-events-none absolute left-0 top-0 h-0 w-0"
                aria-hidden="true"
              />
            </template>
            <template #content>
              <ChatEmotes :text="avatar.bubbleMessage" :user="user" />
            </template>
          </UPopover>
          <UPopover
            v-model:open="avatar.menuVisible"
            arrow
            :content="{ side: 'top', sideOffset: 8, collisionPadding: 8, updatePositionStrategy: 'always' }"
            :ui="{
              content: 'z-50 w-max rounded-[8px] border border-[rgba(198,219,233,0.3)] bg-[rgba(15,21,29,0.96)] p-1 shadow-lg',
            }"
            @update:open="isOpen => updateAvatarMenuVisibility(avatar, isOpen)"
          >
            <template #anchor>
              <span
                :ref="avatar.menuAnchorRef"
                class="pointer-events-none absolute left-0 top-0 h-0 w-0"
                aria-hidden="true"
              />
            </template>
            <template #content>
              <div role="group" :aria-label="`Opciones para ${avatar.displayName}`" class="flex flex-col gap-1">
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-music-2"
                  :trailing-icon="avatar.danceMenuVisible ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  :aria-expanded="avatar.danceMenuVisible"
                  :aria-controls="avatar.danceMenuVisible ? `dance-options-${avatar.login}` : undefined"
                  @click="toggleDanceMenu(avatar)"
                >
                  Dances
                </UButton>
                <div
                  v-if="avatar.danceMenuVisible"
                  :id="`dance-options-${avatar.login}`"
                  role="group"
                  :aria-label="`Dances para ${avatar.displayName}`"
                  class="ml-2 flex flex-col gap-1 border-l border-[rgba(198,219,233,0.3)] pl-2"
                >
                  <UButton
                    v-for="(danceAction, index) in avatarDanceActions"
                    :key="danceAction"
                    type="button"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    class="justify-start"
                    @click="setAvatarDanceFromMenu(avatar, danceAction)"
                  >
                    Dance {{ index + 1 }}
                  </UButton>
                </div>
                <UButton
                  v-if="avatar.danceAction !== null"
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  class="justify-start"
                  icon="i-lucide-circle-stop"
                  @click="setAvatarDanceFromMenu(avatar, null)"
                >
                  Stop Dance
                </UButton>
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-armchair"
                  class="justify-start"
                  @click="toggleAvatarSittingFromMenu(avatar)"
                >
                  {{ avatar.isSitting ? "Stand Up" : "Sit" }}
                </UButton>
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  @click="refreshAvatarFromMenu(avatar)"
                >
                  Refresh Avatar
                </UButton>
              </div>
            </template>
          </UPopover>
        </template>
      </div>
    </section>
  </main>
</template>
