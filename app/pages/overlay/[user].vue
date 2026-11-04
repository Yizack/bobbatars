<script setup lang="ts">
const { user } = useRoute("overlay-user").params;
definePageMeta({ layout: false })
</script>

<template>
  <BobbaOverlay :user="user" />
</template>