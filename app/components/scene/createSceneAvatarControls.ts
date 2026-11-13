import type { Ref } from "vue";
import type { AvatarDanceAction, AvatarDirection, AvatarMenuAction } from "../../types/avatar";
import type { ActiveUser, AvatarState } from "../../types/sceneAvatar";

interface SceneAvatarControlsOptions {
  activeUsers: Map<string, ActiveUser>;
  avatars: Ref<AvatarState[]>;
  animatingPenguins: Set<AvatarState>;
  updateAvatar: (
    avatar: AvatarState,
    direction: AvatarDirection,
    action: AvatarState["action"],
    gesture?: AvatarState["gesture"]
  ) => Promise<void>;
  stopAvatarMovement: (avatar: AvatarState) => void;
  scheduleAvatarAnimation: () => void;
  scheduleRandomMove: (avatar: AvatarState) => void;
  randomSitDirection: () => AvatarDirection;
  startPenguinCleaning: (avatar: AvatarState) => void;
  stopPenguinCleaning: (avatar: AvatarState) => void;
  refreshAvatarFigure: (avatar: AvatarState) => Promise<void>;
  reportAvatarLoadError: (avatar: AvatarState | null, error: unknown) => void;
  reportAvatarFetchError: (avatar: AvatarState, error: unknown) => void;
}

export function createSceneAvatarControls (options: SceneAvatarControlsOptions) {
  function setAvatarDance (avatar: AvatarState, danceAction: AvatarDanceAction | null) {
    if (avatar.removed) return;
    const user = options.activeUsers.get(avatar.login);
    if (user) {
      user.danceAction = danceAction;
      user.cleaning = false;
      if (danceAction !== null) user.isSitting = false;
    }
    options.stopPenguinCleaning(avatar);
    if (danceAction !== null) avatar.isSitting = false;
    if (avatar.avatarType === "penguin") {
      options.stopAvatarMovement(avatar);
      avatar.danceAction = danceAction;
      if (danceAction === null) {
        options.animatingPenguins.delete(avatar);
        avatar.animationStartedAt = null;
      }
      else {
        avatar.direction = 0;
        avatar.animationStartedAt = performance.now();
        options.animatingPenguins.add(avatar);
        options.scheduleAvatarAnimation();
      }
    }
    else {
      avatar.danceAction = danceAction;
    }

    const action = avatar.isWalking ? "wlk" : "std";
    void options.updateAvatar(avatar, avatar.direction, action)
      .then(() => {
        if (!avatar.removed && !avatar.movementPaused && !avatar.isSitting) {
          options.scheduleRandomMove(avatar);
        }
      })
      .catch(error => options.reportAvatarLoadError(avatar, error));
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
    if (avatar.avatarType === "penguin" && (avatar.danceAction !== null || avatar.cleaning)) {
      avatar.movementVersion++;
      if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
      if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
      avatar.randomTimer = null;
      avatar.waitTimer = null;
      return;
    }
    options.stopAvatarMovement(avatar);
    if (avatar.current) {
      void options.updateAvatar(avatar, avatar.direction, "std")
        .catch(error => options.reportAvatarLoadError(avatar, error));
    }
  }

  function resumeAvatarMovement (avatar: AvatarState) {
    if (!avatar.movementPaused) return;
    avatar.movementPaused = false;
    if (!avatar.removed && !avatar.isSitting) options.scheduleRandomMove(avatar);
  }

  function handleAvatarMenuOpenChange (avatar: AvatarState, isOpen: boolean) {
    if (isOpen) {
      for (const otherAvatar of options.avatars.value) {
        if (otherAvatar !== avatar) updateAvatarMenuVisibility(otherAvatar, false);
      }
    }
    updateAvatarMenuVisibility(avatar, isOpen);
  }

  function refreshAvatarFromMenu (avatar: AvatarState) {
    updateAvatarMenuVisibility(avatar, false);
    options.stopPenguinCleaning(avatar);
    void options.refreshAvatarFigure(avatar)
      .catch(error => options.reportAvatarFetchError(avatar, error));
  }

  function setAvatarDanceFromMenu (avatar: AvatarState, danceAction: AvatarDanceAction | null) {
    setAvatarDance(avatar, danceAction);
    updateAvatarMenuVisibility(avatar, false);
  }

  function setAvatarSitting (avatar: AvatarState, isSitting: boolean) {
    if (avatar.removed) return;
    options.stopPenguinCleaning(avatar);
    avatar.isSitting = isSitting;
    avatar.danceAction = null;
    const user = options.activeUsers.get(avatar.login);
    if (user) {
      user.isSitting = isSitting;
      user.danceAction = null;
      user.cleaning = false;
    }

    options.animatingPenguins.delete(avatar);
    options.stopAvatarMovement(avatar);
    avatar.animationStartedAt = null;
    if (isSitting) avatar.direction = options.randomSitDirection();

    void options.updateAvatar(avatar, avatar.direction, isSitting ? "sit" : "std")
      .then(() => {
        if (!avatar.removed && !avatar.movementPaused && !avatar.isSitting) {
          options.scheduleRandomMove(avatar);
        }
      })
      .catch(error => options.reportAvatarLoadError(avatar, error));
  }

  function toggleAvatarSittingFromMenu (avatar: AvatarState) {
    setAvatarSitting(avatar, !avatar.isSitting);
    updateAvatarMenuVisibility(avatar, false);
  }

  function handleAvatarMenuAction (avatar: AvatarState, action: AvatarMenuAction) {
    switch (action.type) {
      case "dance":
        setAvatarDanceFromMenu(avatar, action.action);
        return;
      case "toggle-sitting":
        toggleAvatarSittingFromMenu(avatar);
        return;
      case "clean":
        if (action.action === "start") options.startPenguinCleaning(avatar);
        else options.stopPenguinCleaning(avatar);
        updateAvatarMenuVisibility(avatar, false);
        return;
      case "refresh":
        refreshAvatarFromMenu(avatar);
    }
  }

  return {
    handleAvatarMenuAction,
    handleAvatarMenuOpenChange,
    setAvatarDance,
    setAvatarSitting
  };
}
