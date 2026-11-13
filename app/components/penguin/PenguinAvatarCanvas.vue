<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PenguinAction, PenguinAppearance, PenguinDirection } from "~/types/penguin";
import {
  type PenguinRenderResources,
  type SpriteBounds,
  drawPenguinFrame,
  loadPenguinRenderResources,
  spriteSequenceForPose
} from "~/utils/penguinSprites";

const props = withDefaults(defineProps<{
  appearance: PenguinAppearance;
  direction: PenguinDirection;
  action: PenguinAction;
  scale?: number;
  animate?: boolean;
}>(), {
  scale: 3,
  animate: false
});
const penguinMediaCDN = useRuntimeConfig().public.penguinMediaCDN;
const emit = defineEmits<{
  error: [message: string];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const canvasStyle = ref<Record<string, string>>({});
let resources: PenguinRenderResources | undefined;
let bounds: SpriteBounds | undefined;
let requestVersion = 0;
let animationFrame: number | null = null;
let animationStartedAt = 0;
let isUnmounted = false;

function draw (now = performance.now()): void {
  const element = canvas.value;
  if (!element || !resources) return;
  const sequence = spriteSequenceForPose(resources.body, props.direction, props.action);
  const frameIndex = props.animate && props.action === "wlk" ? Math.floor(Math.max(0, now - animationStartedAt) / (320 / sequence.length)) % sequence.length : 0;
  const context = element.getContext("2d");
  if (!context) throw new Error("This browser does not support canvas rendering.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  bounds = drawPenguinFrame(element, resources, props.appearance, props.direction, props.action, frameIndex);
  canvasStyle.value = {
    width: `${(bounds.width * props.scale) / 2}px`,
    height: `${(bounds.height * props.scale) / 2}px`,
    maxWidth: "100%",
    scale: "1.2"
  };
}

function animationTick (now: number): void {
  animationFrame = null;
  if (isUnmounted || props.action !== "wlk" || !props.animate) return;
  draw(now);
  animationFrame = window.requestAnimationFrame(animationTick);
}

function updateAnimationLoop (): void {
  const shouldAnimate = props.animate && props.action === "wlk";
  if (shouldAnimate && animationFrame === null) {
    animationFrame = window.requestAnimationFrame(animationTick);
  }
  else if (!shouldAnimate && animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

async function loadAppearance (): Promise<void> {
  const request = ++requestVersion;
  try {
    const loaded = await loadPenguinRenderResources(props.appearance, penguinMediaCDN);
    if (isUnmounted || request !== requestVersion) return;
    resources = loaded;
    if (loaded.failedClothingIds.length) {
      emit("error", `Some clothing previews could not be loaded: ${loaded.failedClothingIds.join(", ")}.`);
    }
    draw();
  }
  catch (error) {
    if (isUnmounted || request !== requestVersion) return;
    const message = error instanceof Error ? error.message : "The penguin preview could not be loaded.";
    emit("error", message);
    console.info(error);
  }
}

watch(
  () => props.appearance,
  () => {
    animationStartedAt = performance.now();
    void loadAppearance();
  },
  { deep: true }
);

watch(
  () => [props.direction, props.action, props.scale] as const,
  () => {
    animationStartedAt = performance.now();
    if (resources) draw();
    updateAnimationLoop();
  }
);

onMounted(() => {
  animationStartedAt = performance.now();
  void loadAppearance();
  updateAnimationLoop();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  requestVersion++;
  if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <canvas
    ref="canvas"
    :style="canvasStyle"
    class="max-w-full object-contain"
    role="img"
    aria-label="Club Penguin avatar preview"
  />
</template>
