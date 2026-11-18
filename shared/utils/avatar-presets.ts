import * as z from "zod";

export const AVATAR_PRESET_NAME_MAX_LENGTH = 60;
export const AVATAR_PRESET_LIMIT_PER_TYPE = 10;

export const habboOutfitSchema = z.object({
  figure: z.string(),
  gender: z.enum(["M", "F"]),
  effect: z.number().nullable()
});

const clothingIdSchema = z.number().int().min(1).nullable();

export const penguinOutfitSchema = z.object({
  head: clothingIdSchema,
  face: clothingIdSchema,
  neck: clothingIdSchema,
  body: clothingIdSchema,
  hand: clothingIdSchema,
  feet: clothingIdSchema,
  color: z.string().regex(/^#[\da-f]{6}$/i).transform(value => value.toUpperCase())
});

const avatarPresetOutfitSchema = z.discriminatedUnion("avatarType", [
  z.object({ avatarType: z.literal("habbo"), outfit: habboOutfitSchema }),
  z.object({ avatarType: z.literal("penguin"), outfit: penguinOutfitSchema })
]);

export const avatarPresetSchema = z.intersection(
  z.object({ name: z.string().trim().min(1).max(AVATAR_PRESET_NAME_MAX_LENGTH) }),
  avatarPresetOutfitSchema
);

export type AvatarPresetOutfit = z.infer<typeof avatarPresetOutfitSchema>;
export type AvatarPresetInput = z.infer<typeof avatarPresetSchema>;
export type AvatarPreset = AvatarPresetInput & { id: number };
