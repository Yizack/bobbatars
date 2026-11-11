<script setup lang="ts">
import { useClipboard } from "@vueuse/core";
import { withQuery } from "ufo";
import type { DefaultAvatarType } from "~/types/avatar";
import SceneOverlay from "~/components/SceneOverlay.vue";

definePageMeta({ layout: "dashboard", middleware: "authenticated" });

const { user } = useUserSession();

const requestUrl = useRequestURL();
const tiles = ref(OVERLAY_DEFAULTS.tiles);
const chat = ref(OVERLAY_DEFAULTS.chat);
const maxAvatars = ref(OVERLAY_DEFAULTS.maxAvatars);
const timeout = ref(OVERLAY_DEFAULTS.timeout);
const defaultAvatarType = ref<DefaultAvatarType>(OVERLAY_DEFAULTS.defaultAvatarType);
const roomHeight = ref(OVERLAY_DEFAULTS.roomHeight);
const defaultAvatarTypeOptions: { label: string, value: DefaultAvatarType }[] = [
  { label: "Habbo", value: "habbo" },
  { label: "Club Penguin", value: "penguin" },
  { label: "Random", value: "random" }
];
const backgroundSettings = useHexColor(OVERLAY_DEFAULTS.backgroundHex);
const { color: backgroundColor, opacity: backgroundOpacity, field: backgroundHexField, error: backgroundHexError } = backgroundSettings;
const backgroundWithOpacity = computed(() => backgroundOpacity.value === 0 ? undefined : backgroundSettings.value.value);
const tilesColorSettings = useHexColor(OVERLAY_DEFAULTS.tileColor);
const { color: tilesColor, opacity: tilesOpacity, field: tilesColorHexField, value: tilesColorValue, error: tilesColorHexError } = tilesColorSettings;
const overlayUrl = computed(() => withQuery(
  `${requestUrl.origin}/overlay/${user?.value?.twitchLogin}`,
  {
    tiles: tiles.value === OVERLAY_DEFAULTS.tiles ? undefined : String(tiles.value),
    tileColor: tilesColorValue.value?.slice(1) === OVERLAY_DEFAULTS.tileColor ? undefined : tilesColorValue.value?.slice(1),
    chat: chat.value === OVERLAY_DEFAULTS.chat ? undefined : String(chat.value),
    maxAvatars: maxAvatars.value === OVERLAY_DEFAULTS.maxAvatars ? undefined : String(maxAvatars.value),
    timeout: timeout.value === OVERLAY_DEFAULTS.timeout ? undefined : String(timeout.value),
    roomHeight: roomHeight.value === OVERLAY_DEFAULTS.roomHeight ? undefined : String(roomHeight.value),
    defaultAvatarType: defaultAvatarType.value === OVERLAY_DEFAULTS.defaultAvatarType ? undefined : defaultAvatarType.value,
    backgroundColor: backgroundWithOpacity.value?.slice(1)
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
                <h2 class="mt-1 text-lg max-sm:text-base font-semibold text-highlighted">Avatar chat room</h2>
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
            <SceneOverlay
              :user="user?.twitchLogin ?? ''"
              :tiles="tiles"
              :tile-color="tilesColorValue"
              :chat="chat"
              :max-avatars="maxAvatars"
              :inactive-timeout-minutes="timeout"
              :default-avatar-type="defaultAvatarType"
              :room-height="roomHeight"
              embedded
            />
            <UBadge class="absolute left-3 top-3 z-10 max-sm:text-[11px]" color="neutral" variant="subtle">@{{ user?.twitchDisplay }}</UBadge>
          </div>

          <template #footer>
            <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Habbo and Club Penguin avatars appear as people chat in this Twitch channel. Penguins move around the same room and tiles as Habbos.</p>
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

              <UFormField
                label="Browser Source URL"
                class="text-xs max-sm:text-[11px]"
              >
                <UInput :model-value="overlayUrl" readonly class="w-full" :ui="{ base: 'text-sm' }" />
              </UFormField>

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
                  <UFormField
                    label="Maximum avatars"
                    :description="`Set a limit up to ${OVERLAY_LIMITS.maxAvatars.max}. The source resolution may reduce the cap.`"
                    class="grid gap-1"
                    :ui="{
                      wrapper: 'grid gap-1',
                      label: 'text-sm max-sm:text-xs font-medium text-highlighted',
                      description: 'text-xs max-sm:text-[11px] leading-5 text-muted',
                    }"
                  >
                    <div class="flex items-center gap-2">
                      <UInputNumber
                        v-model="maxAvatars"
                        class="min-w-0 flex-1"
                        :min="OVERLAY_LIMITS.maxAvatars.min"
                        :max="OVERLAY_LIMITS.maxAvatars.max"
                      />
                      <UButton
                        type="button"
                        class="max-sm:text-xs"
                        color="neutral"
                        variant="outline"
                        :disabled="maxAvatars === OVERLAY_DEFAULTS.maxAvatars"
                        aria-label="Set maximum available avatars"
                        @click="maxAvatars = OVERLAY_DEFAULTS.maxAvatars"
                      >
                        Max
                      </UButton>
                    </div>
                  </UFormField>
                </div>

                <div class="flex items-center justify-between gap-4 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <label class="grid gap-1" for="obs-show-tiles">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Show room tiles</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Display the room floor in the preview and OBS overlay.</p>
                  </label>
                  <USwitch id="obs-show-tiles" v-model="tiles" aria-label="Show room tiles" />
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <div class="grid gap-1">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Background color</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Customize the color and opacity.</p>
                  </div>
                  <div class="grid gap-3">
                    <UFormField
                      label="Hexadecimal background color"
                      :error="backgroundHexError || false"
                      :ui="{ label: 'sr-only' }"
                    >
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
                        <UInput
                          v-model="backgroundHexField"
                          class="w-32"
                          maxlength="8"
                          placeholder="FFFFFF00"
                          :ui="{ base: 'ps-6 text-sm' }"
                        >
                          <template #leading>
                            <span class="text-sm text-muted" aria-hidden="true">#</span>
                          </template>
                        </UInput>
                      </div>
                      <template #error="{ error }">
                        <span role="alert">{{ error }}</span>
                      </template>
                    </UFormField>
                    <UFormField
                      label="Opacity"
                      :hint="`${backgroundOpacity}%`"
                      class="grid gap-1"
                      :ui="{
                        label: 'text-xs max-sm:text-[11px] font-medium text-highlighted',
                        hint: 'font-mono text-xs max-sm:text-[11px] text-muted',
                      }"
                    >
                      <USlider
                        v-model="backgroundOpacity"
                        :min="0"
                        :max="100"
                        :step="1"
                      />
                    </UFormField>
                  </div>
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <div class="grid gap-1">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Tiles color</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Customize the tile color and opacity.</p>
                  </div>
                  <div class="grid gap-3">
                    <UFormField
                      label="Hexadecimal tiles color"
                      :error="tilesColorHexError || false"
                      :ui="{ label: 'sr-only' }"
                    >
                      <div class="flex items-center gap-3">
                        <UPopover>
                          <UButton
                            type="button"
                            color="neutral"
                            variant="outline"
                            class="size-10 justify-center p-1"
                            :disabled="!tiles"
                            :aria-label="`Choose tiles color, currently ${tilesColor}`"
                          >
                            <span
                              class="size-6 rounded border border-default"
                              :style="{ backgroundColor: tilesColor }"
                              aria-hidden="true"
                            />
                          </UButton>
                          <template #content>
                            <div class="select-none" @pointerdown.prevent>
                              <UColorPicker
                                v-model="tilesColor"
                                size="sm"
                                class="p-2"
                                :disabled="!tiles"
                                aria-label="Tiles color"
                              />
                            </div>
                          </template>
                        </UPopover>
                        <UInput
                          v-model="tilesColorHexField"
                          class="w-32"
                          :disabled="!tiles"
                          maxlength="8"
                          :placeholder="OVERLAY_DEFAULTS.tileColor"
                          :ui="{ base: 'ps-6 text-sm' }"
                        >
                          <template #leading>
                            <span class="text-sm text-muted" aria-hidden="true">#</span>
                          </template>
                        </UInput>
                      </div>
                      <template #error="{ error }">
                        <span role="alert">{{ error }}</span>
                      </template>
                    </UFormField>
                    <UFormField
                      label="Opacity"
                      :hint="`${tilesOpacity}%`"
                      class="grid gap-1"
                      :ui="{
                        label: 'text-xs max-sm:text-[11px] text-highlighted',
                        hint: 'font-mono text-xs max-sm:text-[11px] text-muted',
                      }"
                    >
                      <USlider
                        v-model="tilesOpacity"
                        :min="0"
                        :max="100"
                        :step="1"
                        :disabled="!tiles"
                      />
                    </UFormField>
                  </div>
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <UFormField
                    label="Room height"
                    description="Set the room height."
                    class="grid gap-1"
                    :ui="{ description: 'text-xs max-sm:text-[11px] leading-5 text-muted' }"
                  >
                    <USlider
                      v-model="roomHeight"
                      :max="OVERLAY_LIMITS.roomHeight.sliderMax"
                      :min="OVERLAY_LIMITS.roomHeight.min"
                      :step="OVERLAY_LIMITS.roomHeight.step"
                    />
                  </UFormField>
                </div>

                <div class="flex items-center justify-between gap-4 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <label class="grid gap-1" for="obs-chat-bubbles">
                    <p class="text-sm max-sm:text-xs font-medium text-highlighted">Chat bubbles</p>
                    <p class="text-xs max-sm:text-[11px] leading-5 text-muted">Show chat messages above avatars.</p>
                  </label>
                  <USwitch id="obs-chat-bubbles" v-model="chat" aria-label="Enable chat bubbles" />
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <UFormField
                    label="Default avatar type"
                    description="Set the default avatar type for unregistered chatters."
                    class="grid gap-1"
                    :ui="{ description: 'text-xs max-sm:text-[11px] leading-5 text-muted' }"
                  >
                    <USelect
                      v-model="defaultAvatarType"
                      :items="defaultAvatarTypeOptions"
                      value-key="value"
                      label-key="label"
                      aria-label="Default avatar"
                      class="w-full"
                    />
                  </UFormField>
                </div>

                <div class="grid gap-3 rounded-md border border-default px-3 py-3 hover:border-primary/25">
                  <UFormField
                    label="Chatter inactivity (minutes)"
                    description="Remove inactive chatters. The channel owner stays visible."
                    class="grid gap-1"
                    :ui="{
                      wrapper: 'grid gap-1',
                      label: 'text-sm max-sm:text-xs font-medium text-highlighted',
                      description: 'text-xs max-sm:text-[11px] leading-5 text-muted',
                    }"
                  >
                    <div class="flex items-center gap-2">
                      <UInputNumber
                        v-model="timeout"
                        class="min-w-0 flex-1"
                        :min="OVERLAY_LIMITS.timeout.min"
                        :max="OVERLAY_LIMITS.timeout.max"
                      />
                      <UButton
                        type="button"
                        class="max-sm:text-xs"
                        color="neutral"
                        variant="outline"
                        :disabled="timeout === OVERLAY_DEFAULTS.timeout"
                        aria-label="Reset chatter inactivity timeout"
                        @click="timeout = OVERLAY_DEFAULTS.timeout"
                      >
                        Default
                      </UButton>
                    </div>
                  </UFormField>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </main>
</template>
