<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { withQuery } from "ufo";

definePageMeta({ layout: "dashboard", middleware: "authenticated" });
useHead({ title: "Presets | Bobbatars" });

const { user } = useUserSession();

if (!user.value) {
  throw createError({
    status: 401,
    message: "User not authenticated",
    fatal: true
  });
}

const avatarEndpoint = `/api/avatars/${encodeURIComponent(user.value.twitchLogin)}`;
const { data: presets, status, refresh } = useLazyFetch<AvatarPreset[]>(`${avatarEndpoint}/presets`, {
  default: () => []
});

const columns: TableColumn<AvatarPreset>[] = [
  { accessorKey: "name", header: "Preset name" },
  { id: "preview", header: "Preview", meta: { class: { th: "w-22 sm:w-32" } } },
  { id: "action", header: "Action", meta: { class: { th: "w-28 sm:w-36" } } }
];

const unavailablePreviews = reactive(new Set<number>());
const savingPresetId = ref<number | null>(null);
const saveResult = ref<{ id: number, saved: boolean }>();

async function usePreset (preset: AvatarPreset) {
  if (savingPresetId.value !== null) return;

  savingPresetId.value = preset.id;
  saveResult.value = undefined;
  try {
    await $fetch(avatarEndpoint, {
      method: "POST",
      body: { avatarType: preset.avatarType, ...preset.outfit }
    });
    saveResult.value = { id: preset.id, saved: true };
  }
  catch {
    saveResult.value = { id: preset.id, saved: false };
  }
  finally {
    savingPresetId.value = null;
  }
}
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 class="mt-3 text-2xl font-semibold text-highlighted sm:text-4xl">Outfit presets</h1>
        <p class="mt-2 text-sm text-muted">Choose a saved outfit to use it as your active avatar.</p>
      </header>

      <UAlert v-if="status === 'error'" color="error" variant="subtle" title="Could not load your presets" icon="pixelarticons:alert">
        <template #actions>
          <UButton size="sm" color="neutral" icon="pixelarticons:reload" @click="refresh()">Retry</UButton>
        </template>
      </UAlert>

      <UCard v-else variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          :data="presets"
          :columns="columns"
          :get-row-id="preset => String(preset.id)"
          :loading="status === 'idle' || status === 'pending'"
          :ui="{ base: 'w-full table-fixed', th: 'px-2 sm:px-4', td: 'px-2 py-2 sm:px-4 sm:py-3' }"
          caption="Saved outfit presets"
        >
          <template #name-cell="{ row }">
            <p class="font-medium whitespace-normal text-highlighted wrap-anywhere">{{ row.original.name }}</p>
            <p class="mt-1 text-xs whitespace-normal text-muted">{{ row.original.avatarType === 'habbo' ? 'Habbo' : 'Club Penguin' }}</p>
          </template>

          <template #preview-cell="{ row }">
            <div class="grid size-18 place-items-center overflow-hidden rounded-md bg-neutral-950 sm:size-22">
              <span v-if="unavailablePreviews.has(row.original.id)" class="px-1 text-center text-[10px] leading-tight whitespace-normal text-neutral-400">Preview unavailable</span>
              <HabboPreviewImage
                v-else-if="row.original.avatarType === 'habbo'"
                :src="withQuery(habboImageUrl(4, 'std', 'std', row.original.outfit.figure, row.original.outfit.effect), { gender: row.original.outfit.gender })"
                alt="Habbo avatar preview"
                loading="lazy"
                class="h-16 max-w-full sm:h-20"
                @error="unavailablePreviews.add(row.original.id)"
              />
              <PenguinAvatarCanvas
                v-else
                :appearance="row.original.outfit"
                :direction="4"
                action="std"
                :scale="0.85"
                class="max-h-16 sm:max-h-20"
                @error="unavailablePreviews.add(row.original.id)"
              />
            </div>
          </template>

          <template #action-cell="{ row }">
            <UButton
              type="button"
              size="sm"
              color="primary"
              :aria-label="`Use avatar ${row.original.name}`"
              :loading="savingPresetId === row.original.id"
              :disabled="savingPresetId !== null"
              @click="usePreset(row.original)"
            >
              {{ savingPresetId === row.original.id ? 'Saving…' : 'Use avatar' }}
            </UButton>
            <template v-if="saveResult?.id === row.original.id">
              <p v-if="saveResult.saved" role="status" class="mt-1 text-xs whitespace-normal text-success">Avatar saved.</p>
              <p v-else role="alert" class="mt-1 text-xs whitespace-normal text-error">Could not save. Try again.</p>
            </template>
          </template>

          <template #empty>
            <div class="grid justify-items-center gap-3 px-4">
              <p>No outfit presets yet.</p>
              <UButton to="/dashboard/avatar" size="sm" icon="pixelarticons:pencil">Go to My Avatar</UButton>
            </div>
          </template>
        </UTable>
      </UCard>
    </div>
  </main>
</template>
