import * as z from "zod";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const params = await getValidatedRouterParams(event, z.object({
    twitchLogin: z.string()
  }).parse);

  if (params.twitchLogin !== session.user.twitchLogin) {
    throw createError({
      status: 403,
      message: "You are not allowed to perform this action"
    });
  }

  const body = await readValidatedBody(event, z.object({
    figure: z.string(),
    gender: z.enum(["M", "F"]),
    effect: z.number().nullable()
  }).parse);

  const avatar = await db.insert(tables.avatars)
    .values({
      userId: session.user.id,
      figure: body.figure,
      gender: body.gender,
      effect: body.effect,
      updatedAt: unixepoch({ mode: "ms" })
    })
    .onConflictDoUpdate({
      target: tables.avatars.userId,
      set: {
        figure: body.figure,
        gender: body.gender,
        effect: body.effect,
        updatedAt: unixepoch({ mode: "ms" })
      }
    }).returning().get();

  return avatar;
});
