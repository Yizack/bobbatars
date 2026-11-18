import * as z from "zod";

const paramsSchema = z.object({ id: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.int()) });

export default defineEventHandler(async (event) => {
  const userId = await requireAvatarPresetOwner(event);
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse);
  const presets = tables.avatarPresets;
  const deleted = await db.delete(presets)
    .where(and(eq(presets.id, id), eq(presets.userId, userId)))
    .returning({ id: presets.id }).get();

  if (!deleted) {
    throw createError({ status: 404, message: "Outfit preset not found" });
  }

  return sendNoContent(event);
});
