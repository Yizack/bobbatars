<script setup lang="ts">
const route = useRoute("overlay-user");
const { user } = route.params;
definePageMeta({ layout: false });

const preview = route.query.preview === "true";
const tiles = computed(() => route.query.tiles === "true");
const chat = computed(() => route.query.chat !== "false");
const maxAvatars = computed(() => {
  const queryValue = route.query.maxAvatars;
  const parsedValue = typeof queryValue === "string" ? Number(queryValue) : 50;
  if (!Number.isInteger(parsedValue)) return 50;
  return Math.min(50, Math.max(1, parsedValue));
});
const roomHeight = computed(() => {
  const queryValue = route.query.roomHeight;
  const parsedValue = typeof queryValue === "string" ? Number(queryValue) : 266;
  if (!Number.isInteger(parsedValue)) return 266;
  return Math.min(500, Math.max(38, parsedValue));
});

useHead({
  htmlAttrs: {
    class: "overflow-hidden"
  },
  bodyAttrs: {
    class: `m-0 overflow-hidden ${preview ? "" : "bg-transparent"}`
  }
});
</script>

<template>
  <main>
    <BobbaOverlay
      :user="user"
      :tiles="tiles"
      :chat="chat"
      :max-avatars="maxAvatars"
      :room-height="roomHeight"
    />
  </main>
</template>
