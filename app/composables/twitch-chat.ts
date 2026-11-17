import { ChatClient, type ChatMessage } from "@twurple/chat";

interface UseTwitchChatOptions {
  onMessage?: (message: ChatMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
  onConnectionError?: (error: unknown) => void;
}

export function useTwitchChat (channel?: string, options: UseTwitchChatOptions = {}) {
  const connected = ref(false);
  let chatClient: ChatClient | null = null;
  let isUnmounting = false;

  onMounted(() => {
    if (!channel) return;
    isUnmounting = false;
    try {
      chatClient = new ChatClient({
        channels: [channel],
        webSocket: true,
        rejoinChannelsOnReconnect: true
      });
      chatClient.onConnect(() => {
        if (isUnmounting) return;
        connected.value = true;
        options.onConnectionChange?.(true);
      });
      chatClient.onDisconnect(() => {
        if (isUnmounting) return;
        connected.value = false;
        options.onConnectionChange?.(false);
      });
      chatClient.onMessage((incomingChannel, _username, _text, message) => {
        if (incomingChannel.replace(/^#/, "").toLowerCase() === channel.toLowerCase()) {
          options.onMessage?.(message);
        }
      });
      chatClient.connect();
    }
    catch (error) {
      if (!isUnmounting) options.onConnectionError?.(error);
    }
  });

  onUnmounted(() => {
    isUnmounting = true;
    chatClient?.quit();
    chatClient = null;
    connected.value = false;
  });

  return { connected };
}
