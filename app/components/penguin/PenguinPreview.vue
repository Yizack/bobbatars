<script setup lang="ts">
import type { PenguinAction, PenguinAppearance, PenguinDirection } from "~/types/penguin";

const props = defineProps<{
  selectedParts: PenguinAppearance;
  outfitCount: number;
  canSave: boolean;
  saveState: AvatarSaveState;
  saveError: string;
}>();
const color = defineModel<string>("color", { required: true });
const direction = defineModel<PenguinDirection>("direction", { required: true });
const action = defineModel<PenguinAction>("action", { required: true });
const emit = defineEmits<{
  randomize: [];
  reset: [];
  save: [];
}>();

const previewError = ref("");
const colorPresets = [
  { label: "Blue", value: "#003366" },
  { label: "Green", value: "#009900" },
  { label: "Pink", value: "#ff3399" },
  { label: "Black", value: "#000000" },
  { label: "Red", value: "#cc0000" },
  { label: "Orange", value: "#ff6600" },
  { label: "Yellow", value: "#ffcc00" },
  { label: "Purple", value: "#660099" },
  { label: "Brown", value: "#996600" },
  { label: "Peach", value: "#ff6666" },
  { label: "Dark green", value: "#006600" },
  { label: "Light blue", value: "#0099cc" },
  { label: "Lime", value: "#99cc00" }
];
const previewActionOptions: { label: string, value: PenguinAction }[] = [
  { label: "Stand", value: "std" },
  { label: "Walk", value: "wlk" }
];
const previewAppearance = computed<PenguinAppearance>(() => ({
  ...props.selectedParts,
  color: color.value
}));

function showPreviewError (message: string): void {
  previewError.value = message;
}
</script>

<template>
  <UCard variant="outline" class="min-w-0">
    <template #header>
      <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-[10px] font-semibold tracking-widest text-primary">CLUB PENGUIN</p>
          <h2 class="mt-1 text-lg font-semibold text-highlighted">Penguin preview</h2>
        </div>
        <div class="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
          <USelect
            v-model="action"
            :items="previewActionOptions"
            value-key="value"
            label-key="label"
            aria-label="Penguin preview movement"
            size="sm"
            class="w-full sm:w-32"
          />
          <UButton size="sm" color="neutral" variant="outline" icon="pixelarticons:move" @click="direction = ((direction + 1) % 8) as PenguinDirection">
            Turn
          </UButton>
        </div>
      </div>
    </template>

    <div class="relative grid min-h-56 items-end justify-items-center overflow-hidden rounded-md bg-neutral-950 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[32px_32px] p-2 sm:min-h-72 sm:p-4">
      <PenguinAvatarCanvas
        :appearance="previewAppearance"
        :direction="direction"
        :action="action"
        :scale="3"
        animate
        @error="showPreviewError"
      />
      <UAlert
        v-if="previewError"
        class="absolute bottom-2 left-2 right-2"
        color="warning"
        variant="subtle"
        title="Preview partially unavailable"
        :description="previewError"
        icon="pixelarticons:image-delete"
      />
    </div>

    <div class="mt-4 grid gap-3">
      <div>
        <h3 class="text-sm font-semibold text-highlighted">Penguin color</h3>
        <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Penguin color presets">
          <button
            v-for="preset in colorPresets"
            :key="preset.value"
            type="button"
            class="size-8 rounded border-2"
            :class="color.toLowerCase() === preset.value ? 'border-primary' : 'border-white/30'"
            :style="{ backgroundColor: preset.value }"
            :aria-label="`${preset.label} penguin color`"
            :aria-pressed="color.toLowerCase() === preset.value"
            @click="color = preset.value"
          />
          <UPopover>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="size-8 justify-center p-1"
              :aria-label="`Choose custom penguin color, currently ${color}`"
            >
              <span class="size-6 rounded border border-default" :style="{ backgroundColor: color }" aria-hidden="true" />
            </UButton>
            <template #content>
              <div class="select-none" @pointerdown.prevent>
                <UColorPicker v-model="color" size="sm" class="p-2" aria-label="Penguin color" />
              </div>
            </template>
          </UPopover>
        </div>
      </div>

      <div class="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <UButton size="sm" class="justify-center" color="secondary" icon="pixelarticons:shuffle" @click="emit('randomize')">Randomize</UButton>
        <UButton size="sm" class="justify-center" color="neutral" icon="pixelarticons:reload" @click="emit('reset')">Reset</UButton>
        <UBadge class="col-span-2 justify-center sm:ml-auto sm:col-span-1" color="neutral" variant="subtle">{{ outfitCount }} parts</UBadge>
        <UButton
          class="col-span-2 justify-center sm:col-span-1"
          color="primary"
          icon="pixelarticons:save"
          :loading="saveState === 'saving'"
          :disabled="!canSave || saveState === 'saving'"
          block
          @click="emit('save')"
        >
          Save avatar
        </UButton>
      </div>
    </div>
    <UAlert v-if="saveState === 'saved'" class="mt-3" color="success" variant="subtle" title="Avatar saved" description="Your penguin avatar has been saved to your account." icon="pixelarticons:checkbox-on" />
    <UAlert v-else-if="saveState === 'error'" class="mt-3" color="error" variant="subtle" title="Could not save avatar" :description="saveError || 'Please try again.'" icon="pixelarticons:alert" />
  </UCard>
</template>
