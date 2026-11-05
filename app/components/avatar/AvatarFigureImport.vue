<script setup lang="ts">
defineProps<{
  error: string;
}>();

const importText = defineModel<string>({ required: true });
const emit = defineEmits<{
  import: [];
}>();
</script>

<template>
  <UCard variant="outline" class="col-span-2 min-w-0 xl:col-span-1">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="pixelarticons:download" class="size-4 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">Import an existing figure</h2>
      </div>
    </template>
    <div class="grid gap-3">
      <UTextarea id="import-figure" v-model="importText" :rows="2" placeholder="hd-3092-2.hr-831-61.ch-3438-110-1408" aria-label="Paste a Habbo figure string" />
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      <UButton color="primary" icon="pixelarticons:download" block @click="emit('import')">Import outfit</UButton>
    </div>
  </UCard>
</template>
