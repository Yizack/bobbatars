import type { AvatarDirection, AvatarType, DefaultAvatarType } from "../types/avatar";

export function randomSitDirection (): AvatarDirection {
  return Math.random() < 0.5 ? 2 : 4;
}

export function resolveDefaultAvatarType (defaultAvatar: DefaultAvatarType): AvatarType {
  if (defaultAvatar === "random") return Math.random() < 0.5 ? "habbo" : "penguin";
  return defaultAvatar;
}

export function directionForTileDelta (deltaColumn: number, deltaRow: number): AvatarDirection {
  const directions: Record<string, AvatarDirection> = {
    "1,0": 2,
    "-1,0": 6,
    "0,1": 4,
    "0,-1": 0,
    "1,1": 3,
    "-1,-1": 7,
    "1,-1": 1,
    "-1,1": 5
  };
  const direction = directions[`${deltaColumn},${deltaRow}`];
  if (direction === undefined) {
    throw new Error(`Dirección de avatar no válida: ${deltaColumn},${deltaRow}`);
  }
  return direction;
}
