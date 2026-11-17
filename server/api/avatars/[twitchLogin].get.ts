import * as z from "zod";

export default defineEventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, z.object({
    twitchLogin: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,25}$/)
  }).parse);
  const query = z.object({
    type: z.enum(["habbo", "penguin"]).optional()
  }).parse(getQuery(event));

  const user = await db.select().from(tables.users).where(
    eq(tables.users.twitchLogin, params.twitchLogin)
  ).get();

  if (!user) {
    throw createError({
      status: 404,
      message: "User not found"
    });
  }

  const avatarType = query.type ?? user.avatarType;
  if (avatarType === "habbo") {
    const avatar = await db.select().from(tables.habboAvatars).where(
      eq(tables.habboAvatars.userId, user.id)
    ).get();

    return {
      avatarType,
      figure: avatar?.figure || "hd-180-1.hr-100-61.ch-210-66.lg-270-82.sh-290-80",
      gender: avatar?.gender || "M",
      effect: avatar?.effect || null
    };
  }

  const avatar = await db.select().from(tables.penguinAvatars).where(
    eq(tables.penguinAvatars.userId, user.id)
  ).get();

  return {
    avatarType,
    ...(avatar ? {
      head: avatar.head,
      face: avatar.face,
      neck: avatar.neck,
      body: avatar.body,
      hand: avatar.hand,
      feet: avatar.feet,
      color: avatar.color
    } : { ...EMPTY_CLOTHING_PARTS, color: "#003366" })
  };
});
