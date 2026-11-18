export default defineEventHandler(async (event) => {
  const userId = await requireAvatarPresetOwner(event);
  const { name, ...appearance } = await readValidatedBody(event, avatarPresetSchema.parse);
  const presets = tables.avatarPresets;

  const presetCount = db.select({ total: count().as("total") })
    .from(presets)
    .where(and(
      eq(presets.userId, userId),
      sql`json_extract(${presets.appearance}, '$.avatarType') = ${appearance.avatarType}`
    ))
    .as("preset_count");

  const availablePreset = db.select({
    id: sql`null`.as("id"),
    userId: sql`${userId}`.as("user_id"),
    name: sql`${name}`.as("name"),
    appearance: sql`${sql.param(appearance, presets.appearance)}`.as("appearance")
  }).from(presetCount).where(sql`${presetCount.total} < ${AVATAR_PRESET_LIMIT_PER_TYPE}`);

  // Check the limit and insert in one statement so concurrent saves cannot exceed it.
  const [created] = await db.insert(presets)
    .select(availablePreset)
    .returning({ id: presets.id });

  if (!created) {
    throw createError({
      status: 409,
      message: `You can save up to ${AVATAR_PRESET_LIMIT_PER_TYPE} presets per avatar type. Delete a preset to make room.`
    });
  }

  setResponseStatus(event, 201);
  return { id: created.id, name, ...appearance };
});
