import * as z from "zod";

const bodySchema = z.union([
  habboOutfitSchema.extend({ avatarType: z.literal("habbo").optional() }),
  penguinOutfitSchema.extend({ avatarType: z.literal("penguin") })
]);

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

  const body = await readValidatedBody(event, bodySchema.parse);
  const updatedAt = unixepoch({ mode: "ms" });

  if ("figure" in body) {
    const avatar = await db.insert(tables.habboAvatars)
      .values({
        userId: session.user.id,
        figure: body.figure,
        gender: body.gender,
        effect: body.effect,
        updatedAt
      })
      .onConflictDoUpdate({
        target: tables.habboAvatars.userId,
        set: {
          figure: body.figure,
          gender: body.gender,
          effect: body.effect,
          updatedAt
        }
      }).returning().get();

    await db.update(tables.users).set({ avatarType: "habbo", updatedAt }).where(
      eq(tables.users.id, session.user.id)
    );
    return { avatarType: "habbo" as const, ...avatar };
  }

  const avatar = await db.insert(tables.penguinAvatars)
    .values({
      userId: session.user.id,
      head: body.head,
      face: body.face,
      neck: body.neck,
      body: body.body,
      hand: body.hand,
      feet: body.feet,
      color: body.color,
      updatedAt
    })
    .onConflictDoUpdate({
      target: tables.penguinAvatars.userId,
      set: {
        head: body.head,
        face: body.face,
        neck: body.neck,
        body: body.body,
        hand: body.hand,
        feet: body.feet,
        color: body.color,
        updatedAt
      }
    }).returning().get();

  await db.update(tables.users).set({ avatarType: "penguin", updatedAt }).where(
    eq(tables.users.id, session.user.id)
  );
  return { avatarType: "penguin" as const, ...avatar };
});
