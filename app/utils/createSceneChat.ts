import { ChatClient } from "@twurple/chat";

interface SceneChatOptions {
  channel: string;
  streamerDisplayName: string;
  activeUsers: Map<string, ActiveUser>;
  avatarsByUser: Map<string, AvatarState>;
  pendingSnowballs: Map<string, string | null>;
  inactiveTimeoutMs: () => number;
  scheduleReconciliation: () => void;
  showChatMessage: (avatar: AvatarState, message: string, emoteOffsets: Map<string, string[]>) => Promise<void>;
  startPenguinCleaning: (avatar: AvatarState) => void;
  stopPenguinCleaning: (avatar: AvatarState) => void;
  setAvatarDance: (avatar: AvatarState, danceAction: AvatarDanceAction | null) => void;
  setAvatarSitting: (avatar: AvatarState, isSitting: boolean) => void;
  throwPenguinSnowball: (avatar: AvatarState, targetLogin: string | null) => void;
  refreshAvatarFigure: (avatar: AvatarState) => Promise<void>;
  reportAvatarFetchError: (avatar: AvatarState, error: unknown) => void;
  onConnectionChange: (connected: boolean) => void;
  onConnectionError: (error: unknown) => void;
}

export function createSceneChat (options: SceneChatOptions) {
  let chatClient: InstanceType<typeof ChatClient> | null = null;
  let isUnmounting = false;

  function recordChatActivity (
    username: string,
    message: string,
    twitchDisplayName: string,
    emoteOffsets: Map<string, string[]>
  ) {
    const messageText = String(message || "");
    const login = String(username || "").trim().toLowerCase();
    if (!login || KNOWN_CHAT_BOTS.has(login)) return;
    const displayName = String(twitchDisplayName || username).trim();
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
      user.lastMessage = "";
      user.lastMessageEmoteOffsets = new Map();
      user.lastMessageAt = 0;
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
      user.lastMessage = "";
      user.lastMessageEmoteOffsets = new Map();
      user.lastMessageAt = 0;
      user.danceAction = command.action;
      if (command.action !== null) user.isSitting = false;
      const avatar = options.avatarsByUser.get(login);
      if (avatar) options.setAvatarDance(avatar, command.action);
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "snowball") {
      user.lastMessage = "";
      user.lastMessageEmoteOffsets = new Map();
      user.lastMessageAt = 0;
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
      user.lastMessage = "";
      user.lastMessageEmoteOffsets = new Map();
      user.lastMessageAt = 0;
      const isSitting = command.type === "sit";
      user.isSitting = isSitting;
      user.danceAction = null;
      const avatar = options.avatarsByUser.get(login);
      if (avatar) options.setAvatarSitting(avatar, isSitting);
      options.scheduleReconciliation();
      return;
    }

    if (command?.type === "refresh-avatar") {
      user.lastMessage = "";
      user.lastMessageEmoteOffsets = new Map();
      user.lastMessageAt = 0;
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
    if (avatar && messageText.trim()) void options.showChatMessage(avatar, messageText, emoteOffsets);
    options.scheduleReconciliation();
  }

  async function connectToChat () {
    try {
      chatClient = new ChatClient({
        channels: [options.channel],
        webSocket: true
      });
      chatClient.onConnect(() => {
        if (isUnmounting) return;
        options.onConnectionChange(true);
      });
      chatClient.onDisconnect(() => {
        if (isUnmounting) return;
        options.onConnectionChange(false);
      });
      chatClient.onMessage((channel, username, message, msg) => {
        if (channel.replace(/^#/, "").toLowerCase() === options.channel) {
          recordChatActivity(username, message, msg.userInfo.displayName ?? username, msg.emoteOffsets);
        }
      });
      chatClient.connect();
    }
    catch (error) {
      if (isUnmounting) return;
      options.onConnectionError(error);
    }
  }

  function disconnectFromChat () {
    isUnmounting = true;
    chatClient?.quit();
    chatClient = null;
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
    connectToChat,
    disconnectFromChat,
    ensureStreamerActive
  };
}
