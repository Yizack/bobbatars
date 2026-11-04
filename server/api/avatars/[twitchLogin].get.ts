import * as z from "zod";

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, z.object({
    twitchLogin: z.string()
  }).parse);

  const user = await db.select().from(tables.users).where(
    eq(tables.users.twitchLogin, params.twitchLogin)
  ).get();

  if (!user) {
    throw createError({
      status: 404,
      message: "User not found"
    });
  }

  const avatar = await db.select().from(tables.avatars).where(
    eq(tables.avatars.userId, user.id)
  ).get();

  return {
    figure: avatar?.figure || "hd-180-1.hr-100-61.ch-210-66.lg-270-82.sh-290-80",
    gender: avatar?.gender || "M",
    effect: avatar?.effect || null
  };
});
