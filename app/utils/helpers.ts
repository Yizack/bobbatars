import { z } from "zod";

export const parseHexColor = (value?: string) => {
  if (!value) return null;
  const result = z.string()
    .regex(/^#?(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i)
    .transform(value => value.startsWith("#") ? value : `#${value}`)
    .safeParse(value);
  if (!result.success) return null;
  return result.data;
};
