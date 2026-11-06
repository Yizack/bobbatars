<script setup lang="ts">
import { fillTextPositions, parseEmotePositions } from "@twurple/chat";

const props = withDefaults(defineProps<{
  text: string;
  user: string;
  emoteOffsets?: Map<string, string[]>;
  popover?: boolean;
}>(), {
  popover: true
});

const { data: emotes } = await useLazyFetch(`/api/chat/emotes/${props.user}`, {
  key: "chat:emotes",
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key]
});

const parsedParts = computed(() => {
  const messageParts = fillTextPositions(
    props.text,
    parseEmotePositions(props.text, props.emoteOffsets ?? new Map())
  ).filter(part => part.type !== "cheer");
  return messageParts.flatMap((part) => {
    if (part.type === "emote") {
      return [{
        token: part.name,
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${part.id}/default/dark/1.0`
      }];
    }

    return part.text.split(" ").map(token => ({
      token,
      url: emotes.value?.[token] ?? null
    }));
  });
});
</script>

<template>
  <span class="max-h-6">
    <template v-for="(part, index) in parsedParts" :key="index">
      <template v-if="!part.url">{{ part.token }}</template>
      <img
        v-else
        class="inline-block align-middle max-h-6 -my-2"
        :src="part.url"
        :alt="part.token"
        :title="part.token"
        loading="lazy"
        decoding="async"
      >
      <template v-if="index < parsedParts.length - 1">{{ ' ' }}</template>
    </template>
  </span>
</template>
