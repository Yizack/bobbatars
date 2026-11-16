<script setup lang="ts">
import { useResizeObserver, useTimeoutFn } from "@vueuse/core";

const props = withDefaults(defineProps<{
  user: string;
  tiles?: boolean;
  tileColor?: string;
  chat?: boolean;
  maxAvatars?: number;
  timeout?: number;
  defaultAvatar?: DefaultAvatarType;
  roomHeight?: number;
  embedded?: boolean;
}>(), {
  tiles: OVERLAY_DEFAULTS.tiles,
  chat: OVERLAY_DEFAULTS.chat,
  tileColor: OVERLAY_DEFAULTS.tileColor,
  maxAvatars: OVERLAY_DEFAULTS.maxAvatars,
  timeout: OVERLAY_DEFAULTS.timeout,
  defaultAvatar: OVERLAY_DEFAULTS.defaultAvatar,
  roomHeight: OVERLAY_DEFAULTS.roomHeight,
  embedded: false
});

const roomHeightSetting = computed(() => {
  if (!Number.isInteger(props.roomHeight)) return OVERLAY_DEFAULTS.roomHeight;
  return Math.min(OVERLAY_LIMITS.roomHeight.max, Math.max(OVERLAY_LIMITS.roomHeight.min, props.roomHeight));
});
const inactiveTimeoutMs = computed(() => {
  if (!Number.isInteger(props.timeout)) {
    return OVERLAY_DEFAULTS.timeout * 60 * 1000;
  }
  const minutes = Math.min(
    OVERLAY_LIMITS.timeout.max,
    Math.max(OVERLAY_LIMITS.timeout.min, props.timeout)
  );
  return minutes * 60 * 1000;
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

const chatChannel = props.user.toLowerCase();
const room = ref<HTMLDivElement | null>(null);
const roomFrame = ref<HTMLElement | null>(null);
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
const animatingPenguins = new Set<AvatarState>();
const activeUsers = new Map<string, ActiveUser>();
const avatarsByUser = new Map<string, AvatarState>();
const avatarElements = new Map<string, AvatarElements>();
const preloadedImages = new Map<string, PreloadedImage>();
const penguinResourcesByLogin = new Map<string, PenguinRenderResources>();
const pendingSnowballs = new Map<string, string | null>();

let roomGeometry = createSceneGeometry(0, 0);

const avatarRenderer = createSceneAvatarRenderer({
  avatarsByUser,
  avatarElements,
  preloadedImages,
  penguinResourcesByLogin,
  getGeometry: () => roomGeometry
});
const { placeAvatar, setAvatarElement, updateAvatar } = avatarRenderer;

function tilePoints (tile: RoomTile) {
  return roomTilePoints(tile);
}

function updateRoomLayout () {
  const bounds = roomFrame.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

  const nextGeometry = createSceneGeometry(bounds.width, bounds.height);
  const layoutChanged = nextGeometry.roomWidth !== roomGeometry.roomWidth
    || nextGeometry.roomHeight !== roomGeometry.roomHeight
    || nextGeometry.columns !== roomGeometry.columns
    || nextGeometry.rows !== roomGeometry.rows;
  roomGeometry = nextGeometry;

  if (layoutChanged) {
    roomTiles.value = createRoomTiles(roomGeometry);
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
      if (avatar.cleaning) {
        avatar.animationStartedAt = performance.now();
        animatingPenguins.add(avatar);
      }
      placeAvatar(avatar);
      scheduleRandomMove(avatar);
    }
    if (animatingPenguins.size > 0) scheduleAvatarAnimation();
    return;
  }

  avatars.value.forEach(placeAvatar);
}

function updateChatStatus () {
  const connection = chatConnected.value ? `Conectado a #${chatChannel}` : `Conectando a #${chatChannel}`;
  status.value = `${connection} · ${avatars.value.length}/${maxAvatars.value} avatares activos`;
}

function reportAvatarFetchError (avatar: AvatarState, error: unknown) {
  if (avatar.removed) return;
  status.value = `No se pudo obtener el avatar de ${avatar.login}.`;
  console.info(error);
}

function reportAvatarLoadError (avatar: AvatarState | null, error: unknown) {
  if (avatar) {
    if (avatar.removed) return;
    avatar.isWalking = false;
    avatar.nextStep = null;
    if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
    avatar.waitTimer = null;
  }
  status.value = avatar?.avatarType === "penguin" ? "No se pudieron cargar los sprites del pingüino." : "No se pudo cargar la imagen del avatar. Revisa tu conexión con habbohistory.com.";
  console.info(error);
}

const sceneMovement = createSceneMovement({
  avatars,
  roomTiles,
  animatingPenguins,
  preloadedImages,
  getGeometry: () => roomGeometry,
  updateAvatar,
  placeAvatar,
  reportAvatarLoadError
});
const {
  findFreeTile,
  penguinDirectionTowardAvatar,
  scheduleAvatarAnimation,
  scheduleRandomMove,
  stopAvatarAnimation,
  stopAvatarMovement: stopSceneAvatarMovement
} = sceneMovement;

function stopAvatarMovement (avatar: AvatarState) {
  penguinSceneActions.cancelPenguinSnowball(avatar);
  stopSceneAvatarMovement(avatar);
}

const penguinSceneActions = createPenguinSceneActions({
  activeUsers,
  animatingPenguins,
  avatarsByUser,
  pendingSnowballs,
  penguinResourcesByLogin,
  stopAvatarAnimation,
  stopAvatarMovement,
  updateAvatar,
  scheduleAvatarAnimation,
  scheduleRandomMove,
  reportAvatarLoadError,
  placeAvatar,
  penguinDirectionTowardAvatar
});

const {
  cancelPenguinSnowball,
  resolvePendingSnowball,
  startPenguinCleaning,
  stopPenguinCleaning,
  throwPenguinSnowball
} = penguinSceneActions;

const { refreshAvatarFigure } = createSceneAvatarProfiles({
  avatars,
  activeUsers,
  animatingPenguins,
  pendingSnowballs,
  penguinResourcesByLogin,
  getDefaultAvatar: () => props.defaultAvatar,
  loadPenguinRenderResources,
  updateAvatar,
  resolvePendingSnowball,
  cancelPenguinSnowball,
  startPenguinCleaning,
  stopPenguinCleaning,
  stopAvatarMovement,
  scheduleAvatarAnimation,
  scheduleRandomMove,
  reportAvatarLoadError,
  reportAvatarFetchError
});

const avatarControls = createSceneAvatarControls({
  activeUsers,
  avatars,
  animatingPenguins,
  updateAvatar,
  stopAvatarMovement,
  scheduleAvatarAnimation,
  scheduleRandomMove,
  randomSitDirection,
  startPenguinCleaning,
  stopPenguinCleaning,
  refreshAvatarFigure,
  reportAvatarLoadError,
  reportAvatarFetchError
});
const {
  handleAvatarMenuAction,
  handleAvatarMenuOpenChange,
  setAvatarDance,
  setAvatarSitting
} = avatarControls;

const avatarRegistry = createSceneAvatarRegistry({
  activeUsers,
  avatars,
  avatarsByUser,
  avatarElements,
  penguinResourcesByLogin,
  pendingSnowballs,
  animatingPenguins,
  maxAvatars: () => maxAvatars.value,
  inactiveTimeoutMs: () => inactiveTimeoutMs.value,
  defaultAvatar: () => props.defaultAvatar,
  findFreeTile,
  setAvatarElement,
  placeAvatar,
  updateAvatar,
  refreshAvatarFigure,
  scheduleRandomMove,
  stopAvatarAnimation,
  resolvePendingSnowball,
  reportAvatarFetchError,
  reportAvatarLoadError,
  updateChatStatus
});
const {
  reconcileActiveAvatars,
  removeAvatarState,
  dispose: disposeAvatarRegistry
} = avatarRegistry;
const {
  start: scheduleReconciliation,
  stop: stopReconciliation
} = useTimeoutFn(reconcileActiveAvatars, 250, { immediate: false });

const sceneChat = createSceneChat({
  channel: chatChannel,
  streamerDisplayName: props.user,
  activeUsers,
  avatarsByUser,
  pendingSnowballs,
  inactiveTimeoutMs: () => inactiveTimeoutMs.value,
  scheduleReconciliation,
  startPenguinCleaning,
  stopPenguinCleaning,
  setAvatarDance,
  setAvatarSitting,
  throwPenguinSnowball,
  refreshAvatarFigure,
  reportAvatarFetchError
});
const { ensureStreamerActive } = sceneChat;
watch(inactiveTimeoutMs, scheduleReconciliation);

useResizeObserver(roomFrame, () => updateRoomLayout());

onMounted(() => {
  updateRoomLayout();
  ensureStreamerActive();
  reconcileActiveAvatars();
});

const { connected: chatConnected } = useTwitchChat(chatChannel, {
  onMessage: sceneChat.handleMessage,
  onConnectionChange: () => updateChatStatus(),
  onConnectionError: (error) => {
    status.value = `No se pudo conectar al chat #${chatChannel}.`;
    console.info(error);
  }
});

onBeforeUnmount(() => {
  stopReconciliation();
  disposeAvatarRegistry();

  for (const avatar of [...avatars.value]) removeAvatarState(avatar);
  avatarElements.clear();
  activeUsers.clear();
  preloadedImages.clear();
});
</script>

<template>
  <div
    :class="props.embedded ? 'absolute inset-0' : 'fixed inset-0'"
    class="flex w-full items-end overflow-clip [font-family:Trebuchet_MS,Arial,sans-serif]"
  >
    <section
      ref="roomFrame"
      :style="{ height: `min(${roomHeightSetting}px, ${props.embedded ? '100%' : '100vh'})` }"
      class="w-full"
      aria-label="Sala Habbo y Club Penguin"
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

        <SceneAvatar
          v-for="avatar in avatars"
          :key="avatar.login"
          :avatar="avatar"
          :user="props.user"
          :chat="props.chat"
          @menu-open-change="isOpen => handleAvatarMenuOpenChange(avatar, isOpen)"
          @menu-action="action => handleAvatarMenuAction(avatar, action)"
        />
      </div>
    </section>
  </div>
</template>
