import type { ChatMessage } from "@twurple/chat";

interface SceneChatOptions {
  channel: string;
  streamerDisplayName: string;
  activeUsers: Map<string, ActiveUser>;
  avatarsByUser: Map<string, AvatarState>;
  pendingSnowballs: Map<string, string | null>;
  inactiveTimeoutMs: () => number;
  scheduleReconciliation: () => void;
  startPenguinCleaning: (avatar: AvatarState) => void;
  stopPenguinCleaning: (avatar: AvatarState) => void;
  setAvatarDance: (avatar: AvatarState, danceAction: AvatarDanceAction | null) => void;
  setAvatarSitting: (avatar: AvatarState, isSitting: boolean) => void;
  throwPenguinSnowball: (avatar: AvatarState, targetLogin: string | null) => void;
  refreshAvatarFigure: (avatar: AvatarState) => Promise<void>;
  reportAvatarFetchError: (avatar: AvatarState, error: unknown) => void;
}

export function createSceneChat (options: SceneChatOptions) {
  function clearLastMessage (user: ActiveUser) {
    user.lastMessage = "";
    user.lastMessageEmoteOffsets = new Map();
    user.lastMessageAt = 0;
  }

  function recordChatActivity (chatMessage: ChatMessage) {
    const username = chatMessage.userInfo.userName;
    const messageText = String(chatMessage.text || "");
    const login = String(username || "").trim().toLowerCase();
    if (!login || KNOWN_CHAT_BOTS.has(login)) return;
    const displayName = String(chatMessage.userInfo.displayName || username).trim();
    const emoteOffsets = chatMessage.emoteOffsets;
    const command = parseAvatarChatCommand(messageText);
    const stopCommand = (command?.type === "dance" && command.action === null)
      || command?.type === "stand"
      || (command?.type === "clean" && command.action === "stop");
    if (messageText.trimStart().startsWith("!") && !command) return;

    const now = Date.now();
    let user = options.activeUsers.get(login);
    if (!user || (!user.isStreamer && now - user.lastActivity >= options.inactiveTimeoutMs())) {
      if (stopCommand) return;
      user = {
        login,
        displayName,
        activity: 0,
        lastActivity: now,
        lastMessage: "",
        lastMessageEmoteOffsets: new Map(),
        lastMessageAt: 0,
        isStreamer: login === options.channel,
        isSitting: false,
        danceAction: null,
        cleaning: false
      };
      options.activeUsers.set(login, user);
    }
    user.displayName = displayName;
    user.activity++;
    user.lastActivity = now;

    if (command && command.type !== "clean") {
      user.cleaning = false;
      const avatar = options.avatarsByUser.get(login);
      if (avatar?.cleaning) options.stopPenguinCleaning(avatar);
    }

    if (command?.type === "clean") {
      clearLastMessage(user);
      user.cleaning = command.action === "start";
      if (command.action === "start") {
        user.isSitting = false;
        user.danceAction = null;
        const avatar = options.avatarsByUser.get(login);
        if (avatar?.avatarType === "penguin") options.startPenguinCleaning(avatar);
        else if (avatar && avatar.profileStatus !== "pending") user.cleaning = false;
      }
      else {
        const avatar = options.avatarsByUser.get(login);
        if (avatar) options.stopPenguinCleaning(avatar);
      }
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "dance") {
      clearLastMessage(user);
      user.danceAction = command.action;
      if (command.action !== null) user.isSitting = false;
      const avatar = options.avatarsByUser.get(login);
      if (avatar) options.setAvatarDance(avatar, command.action);
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "snowball") {
      clearLastMessage(user);
      const avatar = options.avatarsByUser.get(login);
      if (
        avatar?.avatarFigureReady
        && (command.target === null || options.avatarsByUser.has(command.target))
      ) {
        options.throwPenguinSnowball(avatar, command.target);
      }
      else options.pendingSnowballs.set(login, command.target);
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "sit" || command?.type === "stand") {
      clearLastMessage(user);
      const isSitting = command.type === "sit";
      user.isSitting = isSitting;
      user.danceAction = null;
      const avatar = options.avatarsByUser.get(login);
      if (avatar) options.setAvatarSitting(avatar, isSitting);
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "refresh-avatar") {
      clearLastMessage(user);
      const targetLogin = command.target ?? login;
      const avatar = options.avatarsByUser.get(targetLogin);
      if (avatar) {
        options.stopPenguinCleaning(avatar);
        void options.refreshAvatarFigure(avatar)
          .catch(error => options.reportAvatarFetchError(avatar, error));
      }
      options.scheduleReconciliation();
      return;
    }

    user.lastMessage = messageText;
    user.lastMessageEmoteOffsets = emoteOffsets;
    user.lastMessageAt = now;

    const avatar = options.avatarsByUser.get(login);
    if (avatar && messageText.trim()) void avatar.showChatMessage(messageText, emoteOffsets);
    options.scheduleReconciliation();
  }

  function ensureStreamerActive () {
    if (!options.channel || options.activeUsers.has(options.channel)) return;

    options.activeUsers.set(options.channel, {
      login: options.channel,
      displayName: options.streamerDisplayName,
      activity: 0,
      lastActivity: Date.now(),
      lastMessage: "",
      lastMessageEmoteOffsets: new Map(),
      lastMessageAt: 0,
      isStreamer: true,
      isSitting: false,
      danceAction: null,
      cleaning: false
    });
  }

  return {
    handleMessage: recordChatActivity,
    ensureStreamerActive
  };
}
