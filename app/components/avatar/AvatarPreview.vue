<script setup lang="ts">
import { ref, toRefs, watch } from "vue";
import { avatarDanceActions } from "../../utils/avatarCommands";
import type { AvatarGender, AvatarPreviewAction, AvatarSaveState } from "../../types/avatar";

const props = defineProps<{
  previewUrl: string;
  gender: AvatarGender;
  outfitCount: number;
  saveState: AvatarSaveState;
  canSave: boolean;
}>();
const { canSave, gender, outfitCount, previewUrl, saveState } = toRefs(props);
const previewDirection = defineModel<number>("direction", { required: true });
const previewAction = defineModel<AvatarPreviewAction>("action", { required: true });
const emit = defineEmits<{
  randomize: [];
  reset: [];
  save: [];
}>();

const previewFailed = ref(false);
const previewActionOptions: { label: string, value: AvatarPreviewAction }[] = [
  { label: "Stand", value: "std" },
  { label: "Sit", value: "sit" },
  ...avatarDanceActions.map((action, index) => ({ label: `Dance ${index + 1}`, value: action }))
];

watch(previewUrl, () => {
  previewFailed.value = false;
});
</script>

<template>
  <UCard variant="outline" class="min-w-0">
    <template #header>
      <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-[10px] font-semibold tracking-widest text-primary">HABBO IMAGING</p>
          <h2 class="mt-1 text-lg font-semibold text-highlighted">Outfit preview</h2>
        </div>
        <div class="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
          <USelect
            v-model="previewAction"
            :items="previewActionOptions"
            value-key="value"
            label-key="label"
            aria-label="Preview dance"
            size="sm"
            class="w-full sm:w-32"
          />
          <UButton size="sm" color="neutral" variant="outline" icon="pixelarticons:move" @click="previewDirection = (previewDirection + 1) % 8">
            Turn · {{ previewDirection }}
          </UButton>
        </div>
      </div>
    </template>

    <div class="relative grid min-h-56 place-items-center overflow-hidden rounded-md bg-neutral-950 p-2 sm:min-h-72 sm:p-4">
      <img
        v-if="!previewFailed"
        :key="previewUrl"
        class="relative z-10 max-h-56 max-w-full object-contain sm:max-h-72"
        :src="previewUrl"
        :alt="`${gender === 'M' ? 'Male' : 'Female'} Habbo avatar preview`"
        loading="eager"
        @error="previewFailed = true"
      >
      <UAlert v-else color="warning" variant="subtle" title="Preview unavailable" description="Habbo Imaging did not return this outfit. You can still save it." icon="i-lucide-image-off" />
      <UBadge class="absolute bottom-3 right-3 z-20" color="neutral" variant="subtle">{{ gender }} / DIR {{ previewDirection }}</UBadge>
    </div>

    <div class="mt-3 grid grid-cols-2 items-center gap-2 sm:mt-4 sm:flex sm:flex-wrap">
      <UButton size="sm" class="min-w-0 justify-center" color="secondary" variant="soft" icon="pixelarticons:shuffle" @click="emit('randomize')">Randomize</UButton>
      <UButton size="sm" class="min-w-0 justify-center" color="neutral" variant="outline" icon="pixelarticons:reload" @click="emit('reset')">Reset</UButton>
      <UButton size="sm" class="col-span-2 justify-center sm:col-span-1" color="primary" icon="pixelarticons:save" :loading="saveState === 'saving'" :disabled="!canSave || saveState === 'saving'" @click="emit('save')">Save avatar</UButton>
      <UBadge class="col-span-2 justify-center sm:ml-auto sm:col-span-1" color="neutral" variant="subtle">{{ outfitCount }} parts</UBadge>
    </div>
    <UAlert v-if="saveState === 'saved'" class="mt-3" color="success" variant="subtle" title="Avatar saved" description="Your current avatar has been saved to your account." icon="pixelarticons:checkbox-on" />
    <UAlert v-else-if="saveState === 'error'" class="mt-3" color="error" variant="subtle" title="Could not save avatar" description="Please try again." icon="pixelarticons:alert" />
  </UCard>
</template>
