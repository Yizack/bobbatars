<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { withQuery } from "ufo";

definePageMeta({ layout: "dashboard" });

const { user } = useUserSession();

const requestUrl = useRequestURL();
const tiles = ref(false);
const chat = ref(true);
const maxAvatars = ref(50);
const roomHeight = ref(266);
const overlayUrl = computed(() => withQuery(
  `${requestUrl.origin}/overlay/${user?.value?.twitchLogin}`,
  {
    tiles: tiles.value ? "true" : undefined,
    chat: chat.value ? undefined : "false",
    maxAvatars: maxAvatars.value === 50 ? undefined : String(maxAvatars.value),
    roomHeight: roomHeight.value === 266 ? undefined : String(roomHeight.value)
  }
));
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
          <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">OBS overlay</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Preview the live chat overlay and copy its URL into an OBS Browser Source.</p>
        </div>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <UCard variant="outline" class="order-1 min-w-0">
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
            <BobbaOverlay
              :user="user?.twitchLogin ?? ''"
              :tiles="tiles"
              :chat="chat"
              :max-avatars="maxAvatars"
              :room-height="roomHeight"
              embedded
            />
            <UBadge class="absolute left-3 top-3 z-10" color="neutral" variant="subtle">@{{ user?.twitchDisplay }}</UBadge>
          </div>

          <p class="mt-4 text-xs leading-5 text-muted">Avatars appear as people chat in this Twitch channel. The overlay background is transparent in OBS.</p>
        </UCard>

        <UCard variant="outline" class="order-2 xl:order-3 min-w-0">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="pixelarticons:settings-cog" class="size-4 text-primary" />
              <h2 class="text-sm font-semibold text-highlighted">Settings</h2>
            </div>
          </template>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
            <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
              <div class="flex items-center justify-between gap-4">
                <div class="grid gap-1">
                  <p class="text-sm font-medium text-highlighted">Maximum avatars</p>
                  <p class="text-xs leading-5 text-muted">Set a room limit from 1 to 50.</p>
                </div>
              </div>
              <UInputNumber
                v-model="maxAvatars"
                :min="1"
                :max="50"
              />
            </div>

            <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
              <div class="flex items-center justify-between gap-4">
                <div class="grid gap-1">
                  <p class="text-sm font-medium text-highlighted">Room height</p>
                  <p class="text-xs leading-5 text-muted">Set the room height.</p>
                </div>
              </div>
              <USlider
                v-model="roomHeight"
                :max="494"
                :min="38"
                :step="38"
                aria-label="Room height"
              />
            </div>

            <div class="flex items-center justify-between gap-4 rounded-md border border-default px-3 py-3 hover:border-primary/25">
              <label class="grid gap-1" for="obs-show-tiles">
                <p class="text-sm font-medium text-highlighted">Show room tiles</p>
                <p class="text-xs leading-5 text-muted">Display the room floor in the preview and OBS overlay.</p>
              </label>
              <USwitch id="obs-show-tiles" v-model="tiles" aria-label="Show room tiles" />
            </div>

            <div class="flex items-center justify-between gap-4 rounded-md border border-default px-3 py-3 hover:border-primary/25">
              <label class="grid gap-1" for="obs-chat-bubbles">
                <p class="text-sm font-medium text-highlighted">Chat bubbles</p>
                <p class="text-xs leading-5 text-muted">Show chat messages above avatars.</p>
              </label>
              <USwitch id="obs-chat-bubbles" v-model="chat" aria-label="Enable chat bubbles" />
            </div>
          </div>
        </UCard>

        <UCard variant="outline" class="order-3 xl:order-2 min-w-0">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="pixelarticons:monitor" class="size-4 text-primary" />
              <h2 class="text-sm font-semibold text-highlighted">Connect to OBS</h2>
            </div>
          </template>

          <div class="grid gap-4">
            <UAlert
              color="neutral"
              variant="subtle"
              title="Add a Browser Source"
              description="Copy this URL and paste it into the URL field of an OBS Browser Source."
              icon="pixelarticons:info-box"
            />

            <div class="grid gap-2">
              <label for="obs-overlay-url" class="text-xs font-semibold text-highlighted">Browser Source URL</label>
              <UInput id="obs-overlay-url" :model-value="overlayUrl" readonly aria-label="OBS Browser Source URL" />
            </div>

            <UButton color="primary" :icon="copied ? 'pixelarticons:checkbox-on' : 'pixelarticons:copy'" block @click="copyOverlayUrl">
              {{ copied ? 'Copied' : 'Copy URL for OBS' }}
            </UButton>
            <p v-if="copyError" class="-mt-2 text-xs text-error" role="alert">{{ copyError }}</p>
            <p v-else-if="copied" class="-mt-2 text-xs text-success" role="status">Overlay URL copied to clipboard.</p>

            <NuxtLink :to="overlayUrl" target="_blank" class="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4">
              Open overlay in a new tab
              <UIcon name="pixelarticons:external-link" class="size-4" />
            </NuxtLink>
          </div>
        </UCard>
      </div>
    </div>
  </main>
</template>
