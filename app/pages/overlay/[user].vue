<script setup lang="ts">
const route = useRoute("overlay-user") as {
  params: { user: string };
  query: Record<string, string | undefined>;
};
const { user } = route.params;
definePageMeta({ layout: false });

const tiles = computed(() => route.query.tiles === undefined ? OVERLAY_DEFAULTS.tiles : route.query.tiles === "true");
const tileColor = computed(() => parseHexColor(route.query.tileColor) ?? OVERLAY_DEFAULTS.tileColor);
const chat = computed(() => route.query.chat === undefined ? OVERLAY_DEFAULTS.chat : route.query.chat !== "false");
const backgroundColor = computed(() => {
  return parseHexColor(route.query.backgroundColor) ?? OVERLAY_DEFAULTS.backgroundColor;
});
const maxAvatars = computed(() => {
  const queryValue = route.query.maxAvatars;
  const parsedValue = typeof queryValue === "string" ? Number(queryValue) : OVERLAY_DEFAULTS.maxAvatars;
  if (!Number.isInteger(parsedValue)) return OVERLAY_DEFAULTS.maxAvatars;
  return Math.min(OVERLAY_LIMITS.maxAvatars.max, Math.max(OVERLAY_LIMITS.maxAvatars.min, parsedValue));
});
const timeout = computed(() => {
  const queryValue = route.query.timeout;
  const parsedValue = typeof queryValue === "string" ? Number(queryValue) : OVERLAY_DEFAULTS.timeout;
  if (!Number.isInteger(parsedValue)) return OVERLAY_DEFAULTS.timeout;
  return Math.min(
    OVERLAY_LIMITS.timeout.max,
    Math.max(OVERLAY_LIMITS.timeout.min, parsedValue)
  );
});
const defaultAvatarType = computed(() => {
  const queryValue = route.query.defaultAvatarType;
  if (queryValue === "habbo" || queryValue === "penguin" || queryValue === "random") return queryValue;
  return OVERLAY_DEFAULTS.defaultAvatarType;
});
const roomHeight = computed(() => {
  const queryValue = route.query.roomHeight;
  const parsedValue = typeof queryValue === "string" ? Number(queryValue) : OVERLAY_DEFAULTS.roomHeight;
  if (!Number.isInteger(parsedValue)) return OVERLAY_DEFAULTS.roomHeight;
  return Math.min(OVERLAY_LIMITS.roomHeight.max, Math.max(OVERLAY_LIMITS.roomHeight.min, parsedValue));
});

useHead({
  htmlAttrs: {
    class: "overflow-hidden"
  },
  bodyAttrs: {
    class: "m-0 overflow-hidden",
    style: computed(() => `background-color: ${backgroundColor.value}`)
  }
});
</script>

<template>
  <main>
    <SceneOverlay
      :user="user"
      :tiles="tiles"
      :tile-color="tileColor"
      :chat="chat"
      :max-avatars="maxAvatars"
      :inactive-timeout-minutes="timeout"
      :default-avatar-type="defaultAvatarType"
      :room-height="roomHeight"
    />
  </main>
</template>
