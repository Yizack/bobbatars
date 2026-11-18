export default defineEventHandler(async (event) => {
  const userId = await requireAvatarPresetOwner(event);
  const presets = tables.avatarPresets;
  const rows = await db.select({ id: presets.id, name: presets.name, appearance: presets.appearance })
    .from(presets)
    .where(eq(presets.userId, userId))
    .orderBy(desc(presets.id));

  setResponseHeader(event, "Cache-Control", "private, no-store");
  return rows.map(({ id, name, appearance }) => ({ id, name, ...appearance }));
});
