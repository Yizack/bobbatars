<script setup lang="ts">
const props = defineProps<{
  src: string;
  alt?: string;
  imageRef?: (element: Element | ComponentPublicInstance | null) => void;
}>();

const cropAspectRatio = ref("192 / 136");

watch(() => props.src, () => {
  cropAspectRatio.value = "192 / 136";
});

function updateCropAspectRatio (event: Event) {
  const image = event.currentTarget;
  if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;

  cropAspectRatio.value = `${image.naturalWidth} / ${image.naturalHeight / 2}`;
}
</script>

<template>
  <img
    :ref="props.imageRef"
    :src="props.src"
    :alt="props.alt ?? ''"
    :style="{ aspectRatio: cropAspectRatio }"
    class="object-cover object-bottom"
    @load="updateCropAspectRatio"
  >
</template>
