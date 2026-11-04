<script setup lang="ts">
const { user } = useRoute("overlay-user").params;
definePageMeta({ layout: false });

const { preview } = useRoute().query as { preview?: boolean };
</script>

<template>
  <BobbaOverlay :user="user" :preview="Boolean(preview)" />
</template>
