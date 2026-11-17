import type { AvatarChatCommand, AvatarChatCommandDefinition, AvatarDanceAction } from "../types/avatar";

export const avatarDanceActions: AvatarDanceAction[] = ["dance1", "dance2", "dance3", "dance4"];

export const avatarChatCommandRegistry: AvatarChatCommandDefinition[] = [
  {
    pattern: /^!dance(?:\s*([1-4]))?$/i,
    parse: match => ({
      type: "dance",
      action: avatarDanceActions[Number(match[1] ?? 1) - 1] ?? null
    })
  },
  {
    pattern: /^!dance\s+stop$/i,
    parse: () => ({ type: "dance", action: null })
  },
  {
    pattern: /^!sit$/i,
    parse: () => ({ type: "sit" })
  },
  {
    pattern: /^!up$/i,
    parse: () => ({ type: "stand" })
  },
  {
    pattern: /^!snowball(?:\s+@?([\da-z_]+))?$/i,
    parse: match => ({
      type: "snowball",
      target: match[1]?.toLowerCase() ?? null
    })
  },
  {
    pattern: /^!clean\s+stop$/i,
    parse: () => ({ type: "clean", action: "stop" })
  },
  {
    pattern: /^!cleanstop$/i,
    parse: () => ({ type: "clean", action: "stop" })
  },
  {
    pattern: /^!clean$/i,
    parse: () => ({ type: "clean", action: "start" })
  },
  {
    pattern: /^!(?:refresh|update)?avatar(?:\s+@?([\da-z_]+))?$/i,
    parse: match => ({
      type: "refresh-avatar",
      target: match[1]?.toLowerCase() ?? null
    })
  }
];

export function parseAvatarChatCommand (message: string): AvatarChatCommand | null {
  const normalizedMessage = message.trim();

  for (const command of avatarChatCommandRegistry) {
    const match = normalizedMessage.match(command.pattern);
    if (match) return command.parse(match);
  }

  return null;
}
