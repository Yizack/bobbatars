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
const backgroundHexInput = ref("00000000");
const parsedBackgroundHex = computed(() => parseHexColor(backgroundHexInput.value));
const backgroundHexError = computed(() => {
  if (parsedBackgroundHex.value) return "";
  return "Enter 3, 6, or 8 hexadecimal digits.";
});
const backgroundColor = computed({
  get: () => {
    const hex = parsedBackgroundHex.value;
    if (!hex) return "#000000";
    const digits = hex.slice(1).toUpperCase();
    const color = digits.length === 3 ? [...digits].map(digit => digit.repeat(2)).join("") : digits.slice(0, 6);
    return `#${color}`;
  },
  set: (value: string) => {
    const color = value.replace(/^#/, "").slice(0, 6).toUpperCase();
    const hex = parsedBackgroundHex.value;
    const digits = hex?.slice(1).toUpperCase() ?? "";
    const alpha = hex ? digits.length === 8 ? digits.slice(6) : "" : "00";
    backgroundHexInput.value = `${color}${alpha}`;
  }
});
const backgroundOpacity = computed({
  get: () => {
    const hex = parsedBackgroundHex.value;
    if (!hex) return 0;
    const digits = hex.slice(1);
    return digits.length === 8 ? Math.round(Number.parseInt(digits.slice(6), 16) * 100 / 255) : 100;
  },
  set: (value: number) => {
    const opacity = Math.min(100, Math.max(0, Math.round(value)));
    const color = backgroundColor.value.slice(1);
    const alpha = Math.round(opacity * 255 / 100).toString(16).padStart(2, "0").toUpperCase();
    backgroundHexInput.value = opacity === 100 ? color : `${color}${alpha}`;
  }
});
const backgroundHexField = computed({
  get: () => {
    const hex = parsedBackgroundHex.value;
    if (!hex) return backgroundHexInput.value;
    const digits = hex.slice(1).toUpperCase();
    if (digits.length === 8 && backgroundOpacity.value === 100) return digits.slice(0, 6);
    if (digits.length === 8 && backgroundOpacity.value === 0) return `${digits.slice(0, 6)}00`;
    return digits;
  },
  set: (value: string) => {
    backgroundHexInput.value = value.trim().replace(/^#/, "").slice(0, 8).toUpperCase();
  }
});
const backgroundWithOpacity = computed(() => {
  if (!parsedBackgroundHex.value || backgroundOpacity.value === 0) return undefined;
  if (backgroundOpacity.value === 100) return backgroundColor.value;
  return `${backgroundColor.value}${parsedBackgroundHex.value.slice(-2).toUpperCase()}`;
});
const overlayUrl = computed(() => withQuery(
  `${requestUrl.origin}/overlay/${user?.value?.twitchLogin}`,
  {
    tiles: tiles.value ? "true" : undefined,
    chat: chat.value ? undefined : "false",
    maxAvatars: maxAvatars.value === 50 ? undefined : String(maxAvatars.value),
    roomHeight: roomHeight.value === 266 ? undefined : String(roomHeight.value),
    background: backgroundWithOpacity.value?.slice(1)
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

useHead({ title: "OBS Overlay | Bobbatars" });
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <h1 id="page-title" class="mt-3 text-3xl max-sm:text-2xl font-semibold tracking-normal text-highlighted sm:text-4xl">OBS overlay</h1>
          <p class="mt-2 text-sm max-sm:text-xs leading-6 text-muted">Preview the live chat overlay and copy its URL into an OBS Browser Source.</p>
        </div>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <UCard variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-widest text-primary">LIVE PREVIEW</p>
                <h2 class="mt-1 text-lg max-sm:text-base font-semibold text-highlighted">Habbo chat room</h2>
              </div>
              <UBadge class="max-sm:text-[11px]" color="primary" variant="subtle" size="sm">PREVIEW</UBadge>
            </div>
          </template>

          <div class="relative aspect-video overflow-hidden">
            <div
              v-if="backgroundWithOpacity"
              class="pointer-events-none absolute inset-0"
              :style="{ backgroundColor: backgroundWithOpacity }"
              aria-hidden="true"
            />
            <BobbaOverlay
              :user="user?.twitchLogin ?? ''"
              :tiles="tiles"
              :chat="chat"
              :max-avatars="maxAvatars"
              :room-height="roomHeight"
              embedded
            />
            <UBadge class="absolute left-3 top-3 z-10 max-sm:text-[11px]" color="neutral" variant="subtle">@{{ user?.twitchDisplay }}</UBadge>
          </div>

          <template #footer>
            <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Avatars appear as people chat in this Twitch channel. The background is transparent by default.</p>
          </template>
        </UCard>

        <div class="contents min-w-0 xl:flex xl:flex-col xl:gap-5">
          <UCard variant="outline" class="min-w-0">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="pixelarticons:monitor" class="size-4 text-primary" />
                <h2 class="text-sm max-sm:text-xs font-semibold text-highlighted">Connect to OBS</h2>
              </div>
            </template>

            <div class="grid gap-4">
              <UAlert
                color="neutral"
                variant="subtle"
                title="Add a Browser Source"
                description="Copy this URL and paste it into the URL field of an OBS Browser Source."
                icon="pixelarticons:info-box"
                :ui="{ title: 'max-sm:text-xs', description: 'max-sm:text-[11px]' }"
              />

              <div class="grid gap-2">
                <label for="obs-overlay-url" class="text-xs max-sm:text-[11px] font-semibold text-highlighted">Browser Source URL</label>
                <UInput id="obs-overlay-url" :model-value="overlayUrl" readonly aria-label="OBS Browser Source URL" />
              </div>

              <UButton class="max-sm:text-xs" color="primary" :icon="copied ? 'pixelarticons:checkbox-on' : 'pixelarticons:copy'" block @click="copyOverlayUrl">
                {{ copied ? 'Copied' : 'Copy URL for OBS' }}
              </UButton>
              <p v-if="copyError" class="-mt-2 text-xs max-sm:text-[11px] text-error" role="alert">{{ copyError }}</p>
              <p v-else-if="copied" class="-mt-2 text-xs max-sm:text-[11px] text-success" role="status">Overlay URL copied to clipboard.</p>

              <NuxtLink :to="overlayUrl" target="_blank" class="inline-flex items-center gap-2 text-sm max-sm:text-xs text-primary underline underline-offset-4">
                Open overlay in a new tab
                <UIcon name="pixelarticons:external-link" class="size-4" />
              </NuxtLink>
              <p class="text-xs max-sm:text-[11px] leading-5 text-muted">
                Adjust the settings below to customize the OBS overlay.
              </p>
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <div class="flex items-center justify-between gap-4">
                    <div class="grid gap-1">
                      <p class="text-sm max-sm:text-xs font-medium text-highlighted">Maximum avatars</p>
                      <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Set a limit up to 50. The source resolution may reduce the cap.</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UInputNumber
                      v-model="maxAvatars"
                      class="min-w-0 flex-1"
                      :min="1"
                      :max="50"
                    />
                    <UButton
                      type="button"
                      class="max-sm:text-xs"
                      color="neutral"
                      variant="outline"
                      :disabled="maxAvatars === 50"
                      aria-label="Set maximum available avatars"
                      @click="maxAvatars = 50"
                    >
                      Max
                    </UButton>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-4 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <label class="grid gap-1" for="obs-show-tiles">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Show room tiles</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Display the room floor in the preview and OBS overlay.</p>
                  </label>
                  <USwitch id="obs-show-tiles" v-model="tiles" aria-label="Show room tiles" />
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <div class="flex items-center justify-between gap-4">
                    <div class="grid gap-1">
                      <p class="text-sm max-sm:text-xs font-medium text-highlighted">Room height</p>
                      <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Set the room height.</p>
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
                  <label class="grid gap-1" for="obs-chat-bubbles">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Chat bubbles</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Show chat messages above avatars.</p>
                  </label>
                  <USwitch id="obs-chat-bubbles" v-model="chat" aria-label="Enable chat bubbles" />
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <div class="grid gap-1">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Background color</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Customize the color and opacity.</p>
                  </div>
                  <div class="grid gap-3">
                    <div class="grid gap-1">
                      <div class="flex items-center gap-3">
                        <UPopover>
                          <UButton
                            type="button"
                            color="neutral"
                            variant="outline"
                            class="size-10 justify-center p-1"
                            :aria-label="`Choose background color, currently ${backgroundColor}`"
                          >
                            <span
                              class="size-6 rounded border border-default"
                              :style="{ backgroundColor }"
                              aria-hidden="true"
                            />
                          </UButton>
                          <template #content>
                            <div class="select-none" @pointerdown.prevent>
                              <UColorPicker
                                v-model="backgroundColor"
                                size="sm"
                                class="p-2"
                                aria-label="Background color"
                              />
                            </div>
                          </template>
                        </UPopover>
                        <div class="flex items-center gap-1">
                          <span class="text-sm text-muted" aria-hidden="true">#</span>
                          <UInput
                            v-model="backgroundHexField"
                            class="w-32"
                            maxlength="8"
                            placeholder="FFFFFF00"
                            aria-label="Hexadecimal background color"
                            :aria-invalid="Boolean(backgroundHexError)"
                            :aria-describedby="backgroundHexError ? 'obs-background-hex-error' : undefined"
                          />
                        </div>
                      </div>
                      <p v-if="backgroundHexError" id="obs-background-hex-error" class="text-xs text-error" role="alert">
                        {{ backgroundHexError }}
                      </p>
                    </div>
                    <div class="grid gap-2">
                      <div class="flex items-center justify-between gap-2">
                        <label for="obs-background-opacity-slider" class="text-xs max-sm:text-[11px] font-medium text-highlighted">Opacity</label>
                        <span class="font-mono text-xs max-sm:text-[11px] text-muted">{{ backgroundOpacity }}%</span>
                      </div>
                      <USlider
                        id="obs-background-opacity-slider"
                        v-model="backgroundOpacity"
                        :min="0"
                        :max="100"
                        :step="1"
                        aria-label="Background opacity"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </main>
</template>
