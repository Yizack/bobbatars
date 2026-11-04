<script setup lang="ts">
import { useClipboard } from "@vueuse/core";

definePageMeta({ layout: "dashboard" });

const overlayUser = "soychinno";
const requestUrl = useRequestURL();
const overlayUrl = computed(() => new URL(`/overlay/${overlayUser}`, requestUrl.origin).toString());
const copyError = ref("");
const { copy, copied } = useClipboard();

async function copyOverlayUrl () {
  copyError.value = "";

  try {
    await copy(overlayUrl.value);
  }
  catch {
    copyError.value = "Clipboard access failed. Copy the URL from the field above.";
  }
}

useHead({ title: "OBS Overlay | Habbo Outfit Studio" });
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <UBadge color="primary" variant="soft" size="sm">TWITCH CHAT / HABBO ROOM</UBadge>
          <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">OBS overlay</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Preview the live chat overlay and copy its URL into an OBS Browser Source.</p>
        </div>
        <UBadge color="neutral" variant="subtle" size="sm">CHANNEL · {{ overlayUser }}</UBadge>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <UCard variant="outline" class="min-w-0">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-[10px] font-semibold tracking-widest text-primary">LIVE PREVIEW</p>
                <h2 class="mt-1 text-lg font-semibold text-highlighted">Habbo chat room</h2>
              </div>
              <UBadge color="primary" variant="subtle" size="sm">PREVIEW</UBadge>
            </div>
          </template>

          <div class="relative aspect-video overflow-hidden rounded-md border border-default bg-neutral-950">
            <iframe
              class="absolute inset-0 size-full border-0"
              :src="overlayUrl"
              :title="`OBS overlay preview for Twitch channel ${overlayUser}`"
              loading="eager"
            />
            <UBadge class="absolute left-3 top-3 z-10" color="neutral" variant="subtle">#{{ overlayUser }}</UBadge>
          </div>

          <p class="mt-4 text-xs leading-5 text-muted">Avatars appear as people chat in this Twitch channel. The overlay background is transparent in OBS.</p>
        </UCard>

        <UCard variant="outline" class="min-w-0">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-monitor-play" class="size-4 text-primary" />
              <h2 class="text-sm font-semibold text-highlighted">Connect to OBS</h2>
            </div>
          </template>

          <div class="grid gap-4">
            <UAlert
              color="neutral"
              variant="subtle"
              title="Add a Browser Source"
              description="Copy this URL and paste it into the URL field of an OBS Browser Source."
              icon="i-lucide-info"
            />

            <div class="grid gap-2">
              <label for="obs-overlay-url" class="text-xs font-semibold text-highlighted">Browser Source URL</label>
              <UInput id="obs-overlay-url" :model-value="overlayUrl" readonly aria-label="OBS Browser Source URL" />
            </div>

            <UButton color="primary" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyOverlayUrl">
              {{ copied ? 'Copied' : 'Copy URL for OBS' }}
            </UButton>
            <p v-if="copyError" class="-mt-2 text-xs text-error" role="alert">{{ copyError }}</p>
            <p v-else-if="copied" class="-mt-2 text-xs text-success" role="status">Overlay URL copied to clipboard.</p>

            <NuxtLink :to="overlayUrl" target="_blank" class="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4">
              Open overlay in a new tab
              <UIcon name="i-lucide-arrow-up-right" class="size-4" />
            </NuxtLink>
          </div>
        </UCard>
      </div>
    </div>
  </main>
</template>
