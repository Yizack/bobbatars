import * as z from "zod";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const params = await getValidatedRouterParams(event, z.object({
    twitchLogin: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,25}$/)
  }).parse);
  if (params.twitchLogin !== session.user.twitchLogin.toLowerCase()) {
    throw createError({
      status: 403,
      message: "You are not allowed to perform this action"
    });
  }

  const body = await readValidatedBody(event, z.object({
    avatarType: z.enum(["habbo", "penguin"])
  }).parse);
  await db.update(tables.users)
    .set({ avatarType: body.avatarType, updatedAt: unixepoch({ mode: "ms" }) })
    .where(eq(tables.users.id, session.user.id));
  return { avatarType: body.avatarType };
});
