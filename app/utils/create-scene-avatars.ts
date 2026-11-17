interface SceneAvatarDependencies {
  setAvatarElement: (login: string, part: AvatarPart, value: AvatarElementRef) => void;
  updateAvatar: (
    avatar: AvatarState,
    direction: AvatarDirection,
    action: AvatarAction,
    gesture?: AvatarState["gesture"]
  ) => Promise<void>;
  placeAvatar: (avatar: AvatarState) => void;
  reportAvatarLoadError: (avatar: AvatarState, error: unknown) => void;
}

export class SceneAvatar implements AvatarState {
  declare login: string;
  declare displayName: string;
  declare activity: number;
  declare avatarType: AvatarType;
  declare profileStatus: "pending" | "registered" | "unregistered";
  declare fallbackAvatarType: AvatarType;
  declare figure: string;
  declare effect: number | null;
  declare penguinAppearance: PenguinAppearance;
  declare figureRequestVersion: number;
  declare avatarFigureReady: boolean;
  declare cleaning: boolean;
  declare cleanVersion: number;
  declare cleanOriginalHand: number | null;
  declare cleanOriginalResources: PenguinRenderResources | null;
  declare menuVisible: boolean;
  declare movementPaused: boolean;
  declare isSitting: boolean;
  declare current: Tile | null;
  declare visual: Tile | null;
  declare destination: Tile | null;
  declare direction: AvatarDirection;
  declare action: AvatarAction;
  declare danceAction: AvatarDanceAction | null;
  declare gesture: "std" | "spk";
  declare currentImage: string;
  declare imageWidth: number;
  declare imageHeight: number;
  declare bubbleMessage: string;
  declare bubbleEmoteOffsets: Map<string, string[]>;
  declare bubbleVisible: boolean;
  declare shadowRef: AvatarState["shadowRef"];
  declare imageRef: AvatarState["imageRef"];
  declare clickTargetRef: AvatarState["clickTargetRef"];
  declare labelRef: AvatarState["labelRef"];
  declare popoverAnchorRef: AvatarState["popoverAnchorRef"];
  declare menuAnchorRef: AvatarState["menuAnchorRef"];
  declare isWalking: boolean;
  declare nextStep: Tile | null;
  declare animationStartedAt: number | null;
  declare movementVersion: number;
  declare randomTimer: number | null;
  declare waitTimer: number | null;
  declare snowballTimer: number | null;
  declare bubbleTimer: number | null;
  declare gestureTimer: number | null;
  declare speechVersion: number;
  declare removed: boolean;

  private readonly dependencies: SceneAvatarDependencies;

  constructor (
    user: ActiveUser,
    spawn: Tile,
    fallbackAvatarType: AvatarType,
    dependencies: SceneAvatarDependencies
  ) {
    this.dependencies = dependencies;
    Object.assign(this, {
      login: user.login,
      displayName: user.displayName,
      activity: user.activity,
      avatarType: "habbo",
      profileStatus: "pending",
      fallbackAvatarType,
      figure: DEFAULT_HABBO_FIGURE,
      effect: null,
      penguinAppearance: { ...DEFAULT_PENGUIN_APPEARANCE },
      figureRequestVersion: 0,
      avatarFigureReady: false,
      cleaning: false,
      cleanVersion: 0,
      cleanOriginalHand: null,
      cleanOriginalResources: null,
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
      shadowRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "shadow", element),
      imageRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "image", element),
      clickTargetRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "clickTarget", element),
      labelRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "label", element),
      popoverAnchorRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "popoverAnchor", element),
      menuAnchorRef: (element: AvatarElementRef) => dependencies.setAvatarElement(user.login, "menuAnchor", element),
      isWalking: false,
      nextStep: null,
      animationStartedAt: null,
      movementVersion: 0,
      randomTimer: null,
      waitTimer: null,
      snowballTimer: null,
      bubbleTimer: null,
      gestureTimer: null,
      speechVersion: 0,
      removed: false
    });
  }

  clearTimers () {
    if (this.randomTimer !== null) window.clearTimeout(this.randomTimer);
    if (this.waitTimer !== null) window.clearTimeout(this.waitTimer);
    if (this.snowballTimer !== null) window.clearTimeout(this.snowballTimer);
    if (this.bubbleTimer !== null) window.clearTimeout(this.bubbleTimer);
    if (this.gestureTimer !== null) window.clearTimeout(this.gestureTimer);
    this.randomTimer = null;
    this.waitTimer = null;
    this.snowballTimer = null;
    this.bubbleTimer = null;
    this.gestureTimer = null;
  }

  markRemoved () {
    this.removed = true;
    this.movementVersion++;
  }

  async showChatMessage (message: string, emoteOffsets: Map<string, string[]>) {
    if (this.removed || !message.trim()) return;

    this.bubbleMessage = message;
    this.bubbleEmoteOffsets = emoteOffsets;
    this.bubbleVisible = true;
    window.clearTimeout(this.bubbleTimer ?? undefined);
    this.bubbleTimer = window.setTimeout(() => {
      if (this.removed) return;
      this.bubbleVisible = false;
      this.bubbleTimer = null;
    }, 5000);

    window.clearTimeout(this.gestureTimer ?? undefined);
    const speechVersion = ++this.speechVersion;
    this.gesture = "spk";
    await nextTick();
    if (this.removed) return;
    this.dependencies.placeAvatar(this);

    try {
      await this.dependencies.updateAvatar(this, this.direction, this.action, "spk");
    }
    catch (error) {
      this.dependencies.reportAvatarLoadError(this, error);
      return;
    }
    if (this.removed || speechVersion !== this.speechVersion) return;

    this.gestureTimer = window.setTimeout(() => {
      this.gestureTimer = null;
      if (this.removed || speechVersion !== this.speechVersion) return;
      this.gesture = "std";
      void this.dependencies.updateAvatar(this, this.direction, this.action, "std")
        .catch(error => this.dependencies.reportAvatarLoadError(this, error));
    }, 5000);
  }
}

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

interface SceneAvatarRegistryOptions {
  activeUsers: Map<string, ActiveUser>;
  avatars: Ref<AvatarState[]>;
  avatarsByUser: Map<string, AvatarState>;
  avatarElements: Map<string, AvatarElements>;
  penguinResourcesByLogin: Map<string, PenguinRenderResources>;
  pendingSnowballs: Map<string, string | null>;
  animatingPenguins: Set<AvatarState>;
  maxAvatars: () => number;
  inactiveTimeoutMs: () => number;
  defaultAvatar: () => DefaultAvatarType;
  findFreeTile: () => Tile | null;
  setAvatarElement: (login: string, part: AvatarPart, value: AvatarElementRef) => void;
  placeAvatar: (avatar: AvatarState) => void;
  updateAvatar: (
    avatar: AvatarState,
    direction: AvatarDirection,
    action: AvatarAction,
    gesture?: AvatarState["gesture"]
  ) => Promise<void>;
  refreshAvatarFigure: (avatar: AvatarState) => Promise<void>;
  scheduleRandomMove: (avatar: AvatarState) => void;
  stopAvatarAnimation: (avatar: AvatarState) => void;
  resolvePendingSnowball: (avatar: AvatarState) => void;
  reportAvatarFetchError: (avatar: AvatarState, error: unknown) => void;
  reportAvatarLoadError: (avatar: AvatarState, error: unknown) => void;
  updateChatStatus: () => void;
}

export function createSceneAvatarRegistry (options: SceneAvatarRegistryOptions) {
  let inactiveUserTimer: number | null = null;

  function createAvatarState (user: ActiveUser): AvatarState | null {
    const spawn = options.findFreeTile();
    if (!spawn) return null;

    const avatar = reactive<AvatarState>(new SceneAvatar(
      user,
      spawn,
      resolveDefaultAvatarType(options.defaultAvatar()),
      options
    ));

    options.avatars.value.push(avatar);
    options.avatarsByUser.set(user.login, avatar);
    options.placeAvatar(avatar);
    void options.refreshAvatarFigure(avatar)
      .catch(error => options.reportAvatarFetchError(avatar, error));
    void options.updateAvatar(avatar, avatar.direction, avatar.isSitting ? "sit" : "std")
      .then(() => {
        if (!avatar.removed) options.scheduleRandomMove(avatar);
      })
      .catch(error => options.reportAvatarLoadError(avatar, error));
    return avatar;
  }

  function removeAvatarState (avatar: AvatarState) {
    avatar.markRemoved();
    options.pendingSnowballs.delete(avatar.login);
    options.animatingPenguins.delete(avatar);
    options.stopAvatarAnimation(avatar);
    avatar.clearTimers();
    options.avatarElements.delete(avatar.login);
    options.penguinResourcesByLogin.delete(avatar.login);
    options.avatarsByUser.delete(avatar.login);
    const index = options.avatars.value.indexOf(avatar);
    if (index >= 0) options.avatars.value.splice(index, 1);
  }

  function scheduleInactiveUserExpiration () {
    if (inactiveUserTimer !== null) window.clearTimeout(inactiveUserTimer);
    inactiveUserTimer = null;

    let nextExpiration: number | null = null;
    for (const user of options.activeUsers.values()) {
      if (user.isStreamer) continue;
      const expiresAt = user.lastActivity + options.inactiveTimeoutMs();
      if (nextExpiration === null || expiresAt < nextExpiration) nextExpiration = expiresAt;
    }
    if (nextExpiration === null) return;

    inactiveUserTimer = window.setTimeout(() => {
      inactiveUserTimer = null;
      reconcileActiveAvatars();
    }, Math.max(0, nextExpiration - Date.now()));
  }

  function reconcileActiveAvatars () {
    const now = Date.now();
    for (const [login, user] of options.activeUsers) {
      if (!user.isStreamer && now - user.lastActivity >= options.inactiveTimeoutMs()) {
        options.activeUsers.delete(login);
      }
    }

    const avatarLimit = options.maxAvatars();
    let streamer: ActiveUser | undefined;
    if (avatarLimit > 0) {
      streamer = [...options.activeUsers.values()].find(user => user.isStreamer);
    }
    const topUsers = [...options.activeUsers.values()]
      .filter(user => !user.isStreamer)
      .sort((first, second) =>
        second.activity - first.activity
        || second.lastActivity - first.lastActivity
        || first.login.localeCompare(second.login)
      )
      .slice(0, avatarLimit - (streamer ? 1 : 0));
    if (streamer) topUsers.push(streamer);
    const topLogins = new Set(topUsers.map(user => user.login));

    for (const avatar of [...options.avatars.value]) {
      if (!topLogins.has(avatar.login)) removeAvatarState(avatar);
    }

    for (const user of topUsers) {
      const avatar = options.avatarsByUser.get(user.login);
      if (!avatar) {
        const newAvatar = createAvatarState(user);
        if (newAvatar && user.lastMessage && Date.now() - user.lastMessageAt < 3000) {
          void newAvatar.showChatMessage(user.lastMessage, user.lastMessageEmoteOffsets);
        }
        continue;
      }
      const displayNameChanged = avatar.displayName !== user.displayName;
      avatar.displayName = user.displayName;
      avatar.activity = user.activity;
      if (displayNameChanged) {
        void nextTick(() => {
          if (avatar.removed) return;
          const elements = options.avatarElements.get(avatar.login);
          if (elements?.label) {
            elements.labelWidth = elements.label.offsetWidth;
            elements.labelHeight = elements.label.offsetHeight;
          }
          options.placeAvatar(avatar);
        });
      }
    }

    options.updateChatStatus();
    for (const login of options.pendingSnowballs.keys()) {
      const avatar = options.avatarsByUser.get(login);
      if (!avatar) options.pendingSnowballs.delete(login);
      else {
        const targetLogin = options.pendingSnowballs.get(login) ?? null;
        if (targetLogin !== null && !options.avatarsByUser.has(targetLogin)) options.pendingSnowballs.delete(login);
        else if (avatar.avatarFigureReady) options.resolvePendingSnowball(avatar);
      }
    }
    scheduleInactiveUserExpiration();
  }

  return {
    reconcileActiveAvatars,
    removeAvatarState,
    dispose: () => {
      if (inactiveUserTimer !== null) window.clearTimeout(inactiveUserTimer);
      inactiveUserTimer = null;
    }
  };
}

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
    if (avatarType === "penguin") return { avatarType, ...DEFAULT_PENGUIN_APPEARANCE };
    return { avatarType, figure: DEFAULT_HABBO_FIGURE, gender: "M", effect: null };
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
      if (avatar.avatarType === "habbo" && avatar.figure === response.figure && avatar.effect === response.effect) return;

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

  return { refreshAvatarFigure };
}
