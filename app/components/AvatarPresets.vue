<script setup lang="ts">
const props = defineProps<{
  twitchLogin: string;
  outfit: AvatarPresetOutfit;
  disabled?: boolean;
}>();
const emit = defineEmits<{ load: [preset: AvatarPreset] }>();

const endpoint = computed(() => `/api/avatars/${encodeURIComponent(props.twitchLogin)}/presets`);
const { data: presets, status, refresh } = useLazyFetch<AvatarPreset[]>(endpoint, {
  default: () => []
});
const name = ref("");
const saving = ref(false);
const deleting = ref(false);
const deleteOpen = ref(false);
const presetToDelete = ref<AvatarPreset>();
const deleteError = ref("");
const saveError = ref("");
const notice = ref("");
const currentPresets = computed(() => presets.value.filter(preset => preset.avatarType === props.outfit.avatarType));
const slotsRemaining = computed(() => Math.max(0, AVATAR_PRESET_LIMIT_PER_TYPE - currentPresets.value.length));
const controlsDisabled = computed(() => props.disabled || saving.value || deleting.value);
const canSavePreset = computed(() => !controlsDisabled.value && status.value === "success" && slotsRemaining.value > 0);

watch(() => props.outfit.avatarType, () => {
  name.value = "";
  notice.value = "";
  saveError.value = "";
});

async function savePreset () {
  const presetName = name.value.trim();
  if (!presetName || !canSavePreset.value) return;

  const outfit = props.outfit;
  saving.value = true;
  saveError.value = "";
  notice.value = "";
  try {
    const preset = await $fetch<AvatarPreset>(endpoint.value, {
      method: "POST",
      body: { ...outfit, name: presetName }
    });
    presets.value = [preset, ...presets.value];
    if (props.outfit.avatarType === outfit.avatarType) {
      name.value = "";
      notice.value = `Saved “${preset.name}”.`;
    }
  }
  catch (error) {
    if (error instanceof Error && "statusCode" in error && error.statusCode === 409) {
      await refresh();
    }
    else if (props.outfit.avatarType === outfit.avatarType) {
      saveError.value = "Could not save this preset. Please try again.";
    }
  }
  finally {
    saving.value = false;
  }
}

function loadPreset (preset: AvatarPreset) {
  emit("load", preset);
  saveError.value = "";
  notice.value = `Loaded “${preset.name}”.`;
}

function confirmDelete (preset: AvatarPreset) {
  presetToDelete.value = preset;
  deleteError.value = "";
  deleteOpen.value = true;
}

async function deletePreset () {
  const preset = presetToDelete.value;
  if (!preset || deleting.value) return;

  deleting.value = true;
  deleteError.value = "";
  try {
    await $fetch(`${endpoint.value}/${preset.id}`, { method: "DELETE" });
    presets.value = presets.value.filter(entry => entry.id !== preset.id);
    saveError.value = "";
    notice.value = `Deleted “${preset.name}”.`;
    deleteOpen.value = false;
  }
  catch {
    deleteError.value = "Could not delete this preset. Please try again.";
  }
  finally {
    deleting.value = false;
  }
}
</script>

<template>
  <UCard variant="outline" class="min-w-0">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="pixelarticons:shirt" class="size-4 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">Outfit presets</h2>
      </div>
    </template>

    <div class="grid gap-3">
      <p v-if="status === 'idle' || status === 'pending'" role="status" class="text-sm text-muted">Loading presets…</p>
      <div v-else-if="status === 'error'" class="flex flex-wrap items-center gap-2">
        <p role="alert" class="text-sm text-error">Could not load your presets.</p>
        <UButton size="sm" color="neutral" icon="pixelarticons:reload" @click="refresh()">Retry</UButton>
      </div>
      <template v-else>
        <p class="text-xs leading-relaxed text-muted">
          {{ slotsRemaining }} of {{ AVATAR_PRESET_LIMIT_PER_TYPE }} preset slots available.
          <span v-if="slotsRemaining === 0">Delete a preset to free up a slot.</span>
        </p>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="savePreset">
          <UFormField label="Preset name" size="sm" class="min-w-36 flex-1">
            <UInput v-model="name" placeholder="My outfit" autocomplete="off" :maxlength="AVATAR_PRESET_NAME_MAX_LENGTH" :disabled="!canSavePreset" class="w-full" />
          </UFormField>
          <UButton type="submit" size="sm" color="primary" variant="outline" icon="pixelarticons:plus" :loading="saving" :disabled="!canSavePreset || !name.trim()">
            Save preset
          </UButton>
        </form>

        <p v-if="!currentPresets.length" class="text-xs text-muted">No presets for this avatar type yet.</p>
        <ul v-else class="max-h-64 divide-y divide-default overflow-y-auto rounded-md border border-default" aria-label="Saved outfit presets">
          <li v-for="preset in currentPresets" :key="preset.id" class="flex items-center justify-between gap-2 px-3 py-2">
            <span class="min-w-0 text-sm font-medium text-highlighted wrap-anywhere">{{ preset.name }}</span>
            <div class="flex shrink-0 items-center gap-1">
              <UButton size="sm" color="neutral" :aria-label="`Load ${preset.name}`" :disabled="controlsDisabled" @click="loadPreset(preset)">Load</UButton>
              <UButton size="sm" color="error" variant="ghost" icon="pixelarticons:close" :aria-label="`Delete ${preset.name}`" :disabled="controlsDisabled" @click="confirmDelete(preset)" />
            </div>
          </li>
        </ul>
        <UAlert v-if="saveError" color="error" variant="subtle" :description="saveError" icon="pixelarticons:alert" />
        <p v-if="notice" role="status" class="text-xs text-success wrap-anywhere">{{ notice }}</p>
      </template>
    </div>
  </UCard>

  <UModal v-model:open="deleteOpen" title="Delete outfit preset?" :dismissible="!deleting" :close="!deleting">
    <template #description>
      <span class="wrap-anywhere">“{{ presetToDelete?.name }}” will be removed from your presets.</span>
    </template>
    <template v-if="deleteError" #body>
      <UAlert color="error" variant="subtle" :description="deleteError" icon="pixelarticons:alert" />
    </template>
    <template #footer>
      <UButton color="neutral" :disabled="deleting" @click="deleteOpen = false">Cancel</UButton>
      <UButton color="error" variant="solid" :loading="deleting" @click="deletePreset">Delete preset</UButton>
    </template>
  </UModal>
</template>
