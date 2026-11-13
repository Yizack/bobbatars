import type { ActiveUser, AvatarAction, AvatarState } from "../types/sceneAvatar";
import type { PenguinDirection } from "../types/penguin";
import {
  PENGUIN_CLEAN_BODY_ACTION_ID,
  PENGUIN_CLEAN_HAND_ITEM_ID,
  PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID,
  type PenguinRenderResources,
  loadLayer,
  loadPenguinRenderResources,
  spriteSequenceForGroup
} from "./penguinSprites";
import { PENGUIN_DANCE_FRAME_INTERVAL, PENGUIN_SNOWBALL_FRAME_COUNT } from "./penguinAvatar";

interface PenguinSceneActionOptions {
  activeUsers: Map<string, ActiveUser>;
  animatingPenguins: Set<AvatarState>;
  avatarsByUser: Map<string, AvatarState>;
  pendingSnowballs: Map<string, string | null>;
  penguinResourcesByLogin: Map<string, PenguinRenderResources>;
  stopAvatarAnimation: (avatar: AvatarState) => void;
  stopAvatarMovement: (avatar: AvatarState) => void;
  updateAvatar: (
    avatar: AvatarState,
    direction: AvatarState["direction"],
    action: AvatarAction,
    gesture?: AvatarState["gesture"]
  ) => Promise<void>;
  scheduleAvatarAnimation: () => void;
  scheduleRandomMove: (avatar: AvatarState) => void;
  reportAvatarLoadError: (avatar: AvatarState, error: unknown) => void;
  placeAvatar: (avatar: AvatarState) => void;
  penguinDirectionTowardAvatar: (avatar: AvatarState, target: AvatarState) => PenguinDirection;
}

export function createPenguinSceneActions (options: PenguinSceneActionOptions) {
  function stopPenguinCleaning (avatar: AvatarState) {
    const user = options.activeUsers.get(avatar.login);
    if (user) user.cleaning = false;
    if (!avatar.cleaning) return;

    avatar.cleaning = false;
    avatar.cleanVersion++;
    avatar.penguinAppearance = {
      ...avatar.penguinAppearance,
      hand: avatar.cleanOriginalHand
    };
    avatar.cleanOriginalHand = null;
    if (avatar.cleanOriginalResources) {
      options.penguinResourcesByLogin.set(avatar.login, avatar.cleanOriginalResources);
    }
    avatar.cleanOriginalResources = null;
    avatar.action = avatar.isSitting ? "sit" : avatar.danceAction ?? "std";
    avatar.animationStartedAt = null;
    options.animatingPenguins.delete(avatar);
    if (avatar.visual) options.placeAvatar(avatar);
    if (!avatar.movementPaused && !avatar.isSitting && avatar.danceAction === null) {
      options.scheduleRandomMove(avatar);
    }
  }

  function startPenguinCleaning (avatar: AvatarState) {
    if (avatar.removed || avatar.avatarType !== "penguin" || avatar.cleaning) return;

    const user = options.activeUsers.get(avatar.login);
    if (user) {
      user.cleaning = true;
      user.isSitting = false;
      user.danceAction = null;
    }
    const originalResources = options.penguinResourcesByLogin.get(avatar.login);
    if (!originalResources) return;

    options.stopAvatarMovement(avatar);
    avatar.isSitting = false;
    avatar.danceAction = null;
    avatar.cleaning = true;
    avatar.cleanVersion++;
    avatar.cleanOriginalHand = avatar.penguinAppearance.hand;
    avatar.cleanOriginalResources = originalResources;
    avatar.penguinAppearance = {
      ...avatar.penguinAppearance,
      hand: PENGUIN_CLEAN_HAND_ITEM_ID
    };
    avatar.action = "std";

    const requestVersion = avatar.cleanVersion;
    void Promise.all([
      loadPenguinRenderResources(avatar.penguinAppearance),
      loadLayer({
        name: "penguin-clean-body-action",
        path: "/api/media/penguin/actions/71"
      })
    ])
      .then(([resources, cleanBodyAction]) => {
        if (avatar.removed || requestVersion !== avatar.cleanVersion || !avatar.cleaning) return;
        if (resources.failedClothingIds.includes(PENGUIN_CLEAN_HAND_ITEM_ID)) {
          throw new Error(`Could not load penguin cleaning item ${PENGUIN_CLEAN_HAND_ITEM_ID}.`);
        }
        const cleanItemLayer = resources.clothing.find(({ id }) => id === PENGUIN_CLEAN_HAND_ITEM_ID)?.layer;
        if (!cleanItemLayer) {
          throw new Error(`Penguin cleaning item ${PENGUIN_CLEAN_HAND_ITEM_ID} is missing from the sprite resources.`);
        }
        spriteSequenceForGroup(cleanItemLayer, PENGUIN_CLEAN_ITEM_ANIMATION_SPRITE_ID);
        spriteSequenceForGroup(cleanBodyAction, PENGUIN_CLEAN_BODY_ACTION_ID);

        options.penguinResourcesByLogin.set(avatar.login, { ...resources, cleanBodyAction });
        avatar.animationStartedAt = performance.now();
        options.animatingPenguins.add(avatar);
        if (avatar.visual) options.placeAvatar(avatar);
        options.scheduleAvatarAnimation();
      })
      .catch((error: unknown) => {
        if (avatar.removed || requestVersion !== avatar.cleanVersion) return;
        stopPenguinCleaning(avatar);
        options.reportAvatarLoadError(avatar, error);
      });
  }

  function throwPenguinSnowball (avatar: AvatarState, targetLogin: string | null) {
    if (avatar.removed || avatar.avatarType !== "penguin") return;
    const target = targetLogin === null ? null : options.avatarsByUser.get(targetLogin);
    if (targetLogin !== null && (!target || target === avatar || target.removed)) return;

    stopPenguinCleaning(avatar);
    options.stopAvatarMovement(avatar);
    let direction: PenguinDirection;
    if (target) direction = options.penguinDirectionTowardAvatar(avatar, target);
    else direction = Math.floor(Math.random() * 8) as PenguinDirection;
    const user = options.activeUsers.get(avatar.login);
    if (user) {
      user.isSitting = false;
      user.danceAction = null;
    }
    avatar.isSitting = false;
    avatar.danceAction = null;
    avatar.animationStartedAt = performance.now();
    void options.updateAvatar(avatar, direction, "snowball")
      .catch(error => options.reportAvatarLoadError(avatar, error));
    options.animatingPenguins.add(avatar);
    avatar.snowballTimer = window.setTimeout(() => {
      avatar.snowballTimer = null;
      if (avatar.removed || avatar.action !== "snowball") return;
      avatar.action = avatar.isSitting ? "sit" : avatar.danceAction ?? "std";
      options.stopAvatarAnimation(avatar);
      if (avatar.visual) options.placeAvatar(avatar);
      if (!avatar.movementPaused && !avatar.isSitting) options.scheduleRandomMove(avatar);
    }, PENGUIN_SNOWBALL_FRAME_COUNT * PENGUIN_DANCE_FRAME_INTERVAL);
    options.scheduleAvatarAnimation();
  }

  function resolvePendingSnowball (avatar: AvatarState) {
    if (!avatar.avatarFigureReady || !options.pendingSnowballs.has(avatar.login)) return;
    const target = options.pendingSnowballs.get(avatar.login) ?? null;
    if (target !== null && !options.avatarsByUser.has(target)) return;
    options.pendingSnowballs.delete(avatar.login);
    if (avatar.avatarType === "penguin") throwPenguinSnowball(avatar, target);
  }

  function cancelPenguinSnowball (avatar: AvatarState) {
    if (avatar.snowballTimer !== null) window.clearTimeout(avatar.snowballTimer);
    avatar.snowballTimer = null;
    if (avatar.action === "snowball") avatar.action = avatar.isSitting ? "sit" : avatar.danceAction ?? "std";
  }

  return {
    cancelPenguinSnowball,
    resolvePendingSnowball,
    startPenguinCleaning,
    stopPenguinCleaning,
    throwPenguinSnowball
  };
}
