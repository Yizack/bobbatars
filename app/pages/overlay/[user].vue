<script setup lang="ts">
const { user } = useRoute("overlay-user").params;
definePageMeta({ layout: false });

const { preview } = useRoute().query as { preview?: boolean };

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
  <BobbaOverlay :user="user" />
</template>
