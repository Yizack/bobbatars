export type AvatarDanceAction = "dance1" | "dance2" | "dance3" | "dance4";
const danceActions: readonly AvatarDanceAction[] = ["dance1", "dance2", "dance3", "dance4"];

export type AvatarChatCommand
  = | { type: "dance", action: AvatarDanceAction | null }
    | { type: "refresh-avatar", target: string | null };

export interface AvatarChatCommandDefinition {
  pattern: RegExp;
  parse: (match: RegExpMatchArray) => AvatarChatCommand;
}

export const avatarChatCommandRegistry: readonly AvatarChatCommandDefinition[] = [
  {
    pattern: /^!dance(?:\s+([1-4]))?$/i,
    parse: match => ({
      type: "dance",
      action: danceActions[Number(match[1] ?? 1) - 1] ?? null
    })
  },
  {
    pattern: /^!dance\s+stop$/i,
    parse: () => ({ type: "dance", action: null })
  },
  {
    pattern: /^!(?:refresh|update)avatar(?:\s+@?([\da-z_]+))?$/i,
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
