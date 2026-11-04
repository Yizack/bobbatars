import * as z from "zod";
import { withQuery } from "ufo";

const habboFigureResponseSchema = z.object({
  queued: z.boolean().optional(),
  notFound: z.boolean().optional(),
  message: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  figureString: z.string().nullable().optional()
});

function getErrorStatusCode (error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if ("status" in error && typeof error.status === "number") return error.status;
  return undefined;
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const query = await getValidatedQuery(event, z.object({
    hotel: z.enum(["com", "es"]),
    username: z.string().trim().min(1).max(50)
  }).parse);

  let upstreamResponse: unknown;
  try {
    upstreamResponse = await $fetch<unknown>(withQuery("https://habbohistory.com/habbo-imaging/data", {
      mode: "user",
      hotel: query.hotel,
      username: query.username
    }), {
      timeout: 10000
    });
  }
  catch (error) {
    const notFound = getErrorStatusCode(error) === 404;
    throw createError({
      statusCode: notFound ? 404 : 502,
      statusMessage: notFound ? "Habbo user not found." : "Habbo History lookup failed."
    });
  }

  const result = habboFigureResponseSchema.safeParse(upstreamResponse);
  if (!result.success) {
    throw createError({
      statusCode: 502,
      statusMessage: "Habbo History returned an unexpected response."
    });
  }

  const figureString = result.data.figureString?.trim() || undefined;
  const queued = result.data.queued ?? false;
  const notFound = result.data.notFound ?? false;
  if (!queued && !notFound && !figureString) {
    throw createError({
      statusCode: 404,
      statusMessage: "No figure was found for this Habbo user."
    });
  }

  return {
    queued,
    notFound,
    message: result.data.message,
    name: result.data.name?.trim() || query.username,
    figureString
  };
});
