import type { H3Event } from "h3";
import * as z from "zod";

const paramsSchema = z.object({
  twitchLogin: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,25}$/)
});

export async function requireAvatarPresetOwner (event: H3Event) {
  const { user } = await requireUserSession(event);
  const params = await getValidatedRouterParams(event, paramsSchema.parse);

  if (params.twitchLogin !== user.twitchLogin.toLowerCase()) {
    throw createError({
      status: 403,
      message: "You are not allowed to perform this action"
    });
  }

  return user.id;
}
