import { type Ref, watch } from "vue";
import type { AvatarType, DefaultAvatarType } from "../../types/avatar";
import type { ActiveUser, AvatarFigureResponse, AvatarState } from "../../types/sceneAvatar";
import type { PenguinAppearance } from "../../types/penguin";
import { DEFAULT_HABBO_FIGURE } from "../../utils/habboAvatar";
import {
  DEFAULT_PENGUIN_APPEARANCE
} from "../../utils/penguinAvatar";
import type { PenguinRenderResources } from "../../utils/penguinSprites";

interface SceneAvatarProfilesOptions {
  avatars: Ref<AvatarState[]>;
  activeUsers: Map<string, ActiveUser>;
  animatingPenguins: Set<AvatarState>;
  pendingSnowballs: Map<string, string | null>;
  penguinResourcesByLogin: Map<string, PenguinRenderResources>;
  getDefaultAvatar: () => DefaultAvatarType;
  loadPenguinRenderResources: (appearance: PenguinAppearance) => Promise<PenguinRenderResources>;
  updateAvatar: (avatar: AvatarState, direction: AvatarState["direction"], action: AvatarState["action"]) => Promise<void>;
  resolvePendingSnowball: (avatar: AvatarState) => void;
  cancelPenguinSnowball: (avatar: AvatarState) => void;
  startPenguinCleaning: (avatar: AvatarState) => void;
  stopPenguinCleaning: (avatar: AvatarState) => void;
  stopAvatarMovement: (avatar: AvatarState) => void;
  scheduleAvatarAnimation: () => void;
  scheduleRandomMove: (avatar: AvatarState) => void;
  reportAvatarLoadError: (avatar: AvatarState | null, error: unknown) => void;
  reportAvatarFetchError: (avatar: AvatarState, error: unknown) => void;
}

export function createSceneAvatarProfiles (options: SceneAvatarProfilesOptions) {
  function fallbackAvatarResponse (avatarType: AvatarType): AvatarFigureResponse {
    if (avatarType === "penguin") {
      return { avatarType, ...DEFAULT_PENGUIN_APPEARANCE };
    }
    return {
      avatarType,
      figure: DEFAULT_HABBO_FIGURE,
      gender: "M",
      effect: null
    };
  }

  function isNotFoundError (error: unknown) {
    return error instanceof Error
      && (("statusCode" in error && error.statusCode === 404)
        || ("status" in error && error.status === 404));
  }

  async function refreshAvatarFigure (avatar: AvatarState) {
    const requestVersion = ++avatar.figureRequestVersion;
    let succeeded = false;
    try {
      await loadAvatarFigure(avatar, requestVersion);
      succeeded = true;
    }
    finally {
      if (!avatar.removed && requestVersion === avatar.figureRequestVersion) {
        avatar.avatarFigureReady = true;
        if (succeeded) options.resolvePendingSnowball(avatar);
        else options.pendingSnowballs.delete(avatar.login);
      }
    }
  }

  async function loadAvatarFigure (avatar: AvatarState, requestVersion: number) {
    let response: AvatarFigureResponse;
    let isUnregistered = false;
    try {
      response = await $fetch<AvatarFigureResponse>(`/api/avatars/${encodeURIComponent(avatar.login)}`);
    }
    catch (error) {
      if (!isNotFoundError(error)) throw error;
      isUnregistered = true;
      response = fallbackAvatarResponse(avatar.fallbackAvatarType);
    }

    if (avatar.removed || requestVersion !== avatar.figureRequestVersion) return;
    avatar.profileStatus = isUnregistered ? "unregistered" : "registered";
    await applyAvatarFigureResponse(avatar, response, requestVersion);
  }

  async function applyAvatarFigureResponse (avatar: AvatarState, response: AvatarFigureResponse, requestVersion: number) {
    if (avatar.removed || requestVersion !== avatar.figureRequestVersion) return;
    if (response.avatarType === "habbo") {
      if (avatar.cleaning) options.stopPenguinCleaning(avatar);
      const activeUser = options.activeUsers.get(avatar.login);
      if (activeUser) activeUser.cleaning = false;
      if (
        avatar.avatarType === "habbo"
        && avatar.figure === response.figure
        && avatar.effect === response.effect
      ) return;

      if (avatar.avatarType === "penguin") {
        options.cancelPenguinSnowball(avatar);
        options.animatingPenguins.delete(avatar);
        avatar.animationStartedAt = null;
      }
      avatar.avatarType = "habbo";
      avatar.figure = response.figure;
      avatar.effect = response.effect;
      avatar.currentImage = "";
      await options.updateAvatar(avatar, avatar.direction, avatar.action);
      return;
    }

    const appearance: PenguinAppearance = {
      head: response.head,
      face: response.face,
      neck: response.neck,
      body: response.body,
      hand: response.hand,
      feet: response.feet,
      color: response.color
    };
    const activeUser = options.activeUsers.get(avatar.login);
    const shouldResumeCleaning = activeUser?.cleaning === true;
    if (avatar.cleaning) {
      options.stopPenguinCleaning(avatar);
      if (shouldResumeCleaning && activeUser) activeUser.cleaning = true;
    }
    const isSitting = activeUser ? activeUser.isSitting : avatar.isSitting;
    const danceAction = isSitting ? null : activeUser ? activeUser.danceAction : avatar.danceAction;
    const appearanceChanged = avatar.avatarType !== "penguin"
      || avatar.penguinAppearance.head !== appearance.head
      || avatar.penguinAppearance.face !== appearance.face
      || avatar.penguinAppearance.neck !== appearance.neck
      || avatar.penguinAppearance.body !== appearance.body
      || avatar.penguinAppearance.hand !== appearance.hand
      || avatar.penguinAppearance.feet !== appearance.feet
      || avatar.penguinAppearance.color !== appearance.color;
    if (!appearanceChanged && options.penguinResourcesByLogin.has(avatar.login)) {
      if (activeUser?.cleaning) options.startPenguinCleaning(avatar);
      return;
    }

    options.cancelPenguinSnowball(avatar);
    if (isSitting) options.animatingPenguins.delete(avatar);
    if (danceAction !== null || isSitting) options.stopAvatarMovement(avatar);
    if (isSitting && activeUser) activeUser.danceAction = null;
    if (avatar.avatarType !== "penguin") {
      avatar.menuVisible = false;
      avatar.movementPaused = false;
    }
    avatar.avatarType = "penguin";
    avatar.penguinAppearance = appearance;
    avatar.isSitting = isSitting;
    avatar.danceAction = danceAction;
    if (danceAction !== null) avatar.direction = 0;
    avatar.gesture = "std";
    const resources = await options.loadPenguinRenderResources(appearance);
    if (avatar.removed || requestVersion !== avatar.figureRequestVersion) return;
    options.penguinResourcesByLogin.set(avatar.login, resources);
    await options.updateAvatar(avatar, avatar.direction, avatar.isWalking ? "wlk" : "std");
    if (!avatar.removed && avatar.danceAction !== null) {
      avatar.animationStartedAt = performance.now();
      options.animatingPenguins.add(avatar);
      options.scheduleAvatarAnimation();
    }
    if (!avatar.removed && !avatar.movementPaused && !avatar.isWalking && avatar.randomTimer === null) {
      options.scheduleRandomMove(avatar);
    }
    if (!avatar.removed && activeUser?.cleaning) options.startPenguinCleaning(avatar);
  }

  watch(options.getDefaultAvatar, (defaultAvatar) => {
    for (const avatar of options.avatars.value) {
      avatar.fallbackAvatarType = resolveDefaultAvatarType(defaultAvatar);
      if (avatar.profileStatus !== "unregistered") continue;
      if (avatar.cleaning) options.stopPenguinCleaning(avatar);
      const requestVersion = ++avatar.figureRequestVersion;
      void applyAvatarFigureResponse(
        avatar,
        fallbackAvatarResponse(avatar.fallbackAvatarType),
        requestVersion
      ).catch(error => options.reportAvatarLoadError(avatar, error));
    }
  });

  return {
    refreshAvatarFigure
  };
}
