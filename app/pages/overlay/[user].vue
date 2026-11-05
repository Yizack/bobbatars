<script setup lang="ts">
const route = useRoute("overlay-user");
const { user } = route.params;
definePageMeta({ layout: false });

const preview = route.query.preview === "true";
const tiles = computed(() => route.query.tiles === "true");
const chat = computed(() => route.query.chat !== "false");

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
    <BobbaOverlay :user="user" :tiles="tiles" :chat="chat" />
  </main>
</template>
