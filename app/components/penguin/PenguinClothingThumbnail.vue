<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { buildGroups, drawAt, loadClothingLayer, penguinSpriteForPose, prepareSpriteCanvas } from "~/utils/penguinSprites";

const props = defineProps<{
  itemId: number;
  label: string;
}>();
const penguinMediaCDN = useRuntimeConfig().public.penguinMediaCDN;

const container = ref<HTMLSpanElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const visible = ref(false);
const loading = ref(false);
const loaded = ref(false);
const unavailable = ref(false);
const canvasStyle = ref<Record<string, string>>({});
let isUnmounted = false;

const { stop } = useIntersectionObserver(
  container,
  ([entry]) => {
    if (!entry?.isIntersecting) return;
    visible.value = true;
    stop();
    void loadThumbnail();
  },
  { threshold: 0.1 }
);

async function loadThumbnail (): Promise<void> {
  if (!visible.value || loading.value || unavailable.value) return;
  loading.value = true;

  try {
    const layer = await loadClothingLayer(props.itemId, penguinMediaCDN);
    if (isUnmounted) return;
    const element = canvas.value;
    const spriteId = penguinSpriteForPose(2, "std");
    const entryName = buildGroups(layer.names)[String(spriteId)]?.[0];
    const entry = entryName ? layer.frames[entryName] : undefined;
    if (!element || !entry) {
      throw new Error(`Clothing sprite ${props.itemId} does not contain a standing preview.`);
    }

    const width = entry.rotated ? entry.frame.h : entry.frame.w;
    const height = entry.rotated ? entry.frame.w : entry.frame.h;
    const context = prepareSpriteCanvas(element, width, height);
    drawAt(context, layer.img, entry, 0, 0);
    canvasStyle.value = {
      width: `${width * 3}px`,
      height: `${height * 3}px`,
      maxWidth: "100%",
      maxHeight: "6rem",
      imageRendering: "pixelated"
    };
    loaded.value = true;
  }
  catch (error) {
    if (isUnmounted) return;
    unavailable.value = true;
    console.info(error);
  }
  finally {
    loading.value = false;
  }
}

onBeforeUnmount(() => {
  isUnmounted = true;
  stop();
});
</script>

<template>
  <span ref="container" class="flex size-full items-center justify-center">
    <canvas
      v-show="loaded && !unavailable"
      ref="canvas"
      :style="canvasStyle"
      class="max-h-24 max-w-full object-contain"
      role="img"
      :aria-label="`${label} preview without penguin body`"
    />
    <span v-if="loading && !loaded" class="text-xs text-muted" role="status">Loading preview…</span>
    <UIcon
      v-if="unavailable"
      name="pixelarticons:image-delete"
      class="size-8 text-muted"
      role="img"
      :aria-label="`${label} preview unavailable`"
    />
    <UIcon
      v-if="loading"
      name="pixelarticons:loader"
      class="size-5 text-muted"
      aria-hidden="true"
    />
  </span>
</template>
