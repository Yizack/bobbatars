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
  showChatMessage: (avatar: AvatarState, message: string, emoteOffsets: Map<string, string[]>) => Promise<void>;
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

    const avatar = reactive<AvatarState>({
      login: user.login,
      displayName: user.displayName,
      activity: user.activity,
      avatarType: "habbo",
      profileStatus: "pending",
      fallbackAvatarType: resolveDefaultAvatarType(options.defaultAvatar()),
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
      shadowRef: element => options.setAvatarElement(user.login, "shadow", element),
      imageRef: element => options.setAvatarElement(user.login, "image", element),
      clickTargetRef: element => options.setAvatarElement(user.login, "clickTarget", element),
      labelRef: element => options.setAvatarElement(user.login, "label", element),
      popoverAnchorRef: element => options.setAvatarElement(user.login, "popoverAnchor", element),
      menuAnchorRef: element => options.setAvatarElement(user.login, "menuAnchor", element),
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

  function clearAvatarTimers (avatar: AvatarState) {
    if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
    if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
    if (avatar.snowballTimer !== null) window.clearTimeout(avatar.snowballTimer);
    if (avatar.bubbleTimer !== null) window.clearTimeout(avatar.bubbleTimer);
    if (avatar.gestureTimer !== null) window.clearTimeout(avatar.gestureTimer);
    avatar.randomTimer = null;
    avatar.waitTimer = null;
    avatar.snowballTimer = null;
    avatar.bubbleTimer = null;
    avatar.gestureTimer = null;
  }

  function removeAvatarState (avatar: AvatarState) {
    avatar.removed = true;
    avatar.movementVersion++;
    options.pendingSnowballs.delete(avatar.login);
    options.animatingPenguins.delete(avatar);
    options.stopAvatarAnimation(avatar);
    clearAvatarTimers(avatar);
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
        if (
          newAvatar
          && user.lastMessage
          && Date.now() - user.lastMessageAt < 3000
        ) {
          void options.showChatMessage(newAvatar, user.lastMessage, user.lastMessageEmoteOffsets);
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
