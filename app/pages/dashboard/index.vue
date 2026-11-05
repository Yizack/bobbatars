<script setup lang="ts">
import { withQuery } from "ufo";
import { DEFAULT_OUTFIT_FIGURES } from "../../data/avatar-generator/default-outfit";
import avatarCatalogJson from "../../data/avatar-generator/catalog.json";
import { avatarImagingUrl } from "../../utils/avatar";

definePageMeta({ layout: "dashboard" });

const { user } = useUserSession();

if (!user.value) {
  throw createError({
    status: 401,
    message: "User not authenticated",
    fatal: true
  });
}

const { data: avatar } = await useFetch(`/api/avatars/${user.value.twitchLogin}`, {
  default: () => ({
    gender: "M" as const,
    figure: DEFAULT_OUTFIT_FIGURES.M,
    effect: null
  })
});

const twitchLogin = computed(() => user.value?.twitchLogin || "");
const displayName = computed(() => user.value?.twitchDisplay || twitchLogin.value || "Twitch user");
const previewUrl = computed(() => withQuery(avatarImagingUrl, {
  head_direction: "4",
  direction: "4",
  size: "l",
  figure: avatar.value.figure,
  gender: avatar.value.gender,
  format: "webp",
  ...(avatar.value.effect === null ? {} : { effect: String(avatar.value.effect) })
}));
const previewUnavailable = ref(false);

const avatarCatalog = avatarCatalogJson as unknown as {
  schemaVersion: number;
  build: string;
  categories: Array<{ type: string, sets: Array<{ id: string, nft?: boolean }> }>;
  effects?: Array<{ id: string }>;
};

const catalogSetCount = avatarCatalog.categories.reduce((count, category) =>
  count + category.sets.filter(set => !set.nft).length, 0
);
const categoryCount = avatarCatalog.categories.length + (avatarCatalog?.effects?.length ? 1 : 0);
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 border-b border-default pb-6 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div>
          <p class="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Bobbatars</p>
          <h1 id="page-title" class="mt-2 text-3xl font-semibold text-highlighted sm:text-4xl">Your Habbo, on Twitch</h1>
          <p class="mt-3 text-sm leading-6 text-muted">Manage the Habbo avatar linked to your Twitch account, or feature your community's avatars in your stream.</p>
        </div>
      </section>

      <section class="grid grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Outfit catalog statistics">
        <div class="border-l-2 border-primary/50 pl-4">
          <p class="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Categories</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl font-semibold tabular-nums text-highlighted">{{ categoryCount }}</span>
            <span class="text-sm text-muted">outfit categories</span>
          </p>
        </div>
        <div class="border-l-2 border-warning/50 pl-4">
          <p class="text-[10px] font-semibold tracking-[0.18em] text-warning uppercase">Catalog sets</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl font-semibold tabular-nums text-highlighted">{{ catalogSetCount }}</span>
            <span class="text-sm text-muted">outfit items</span>
          </p>
        </div>
      </section>

      <section class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]" aria-label="Avatar and stream tools">
        <UCard variant="outline" class="min-w-0 overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="pixelarticons:shirt" class="size-5 text-primary" />
                <h2 class="text-base font-semibold text-highlighted">My avatar</h2>
              </div>
            </div>
          </template>

          <div class="relative grid min-h-88 place-items-center overflow-hidden bg-neutral-950 p-6 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[32px_32px]">
            <img v-if="!previewUnavailable" class="relative z-10 max-h-72 max-w-full object-contain [image-rendering:pixelated]" :src="previewUrl" :alt="`${displayName}'s Habbo avatar`" @error="previewUnavailable = true">
            <UAlert v-else class="relative z-10 max-w-sm" color="warning" variant="subtle" title="Preview unavailable" description="Your saved avatar is still available in the editor." icon="pixelarticons:image-broken" />
          </div>

          <div class="flex flex-col gap-4 border-t border-default p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold tracking-widest text-muted uppercase">User</p>
              <code class="mt-1 block truncate text-xs text-highlighted">{{ displayName }} (@{{ twitchLogin }})</code>
            </div>
            <UButton to="/dashboard/avatar" color="primary" icon="pixelarticons:pencil" trailing-icon="pixelarticons:arrow-right">
              Edit avatar
            </UButton>
          </div>
        </UCard>

        <div class="grid gap-3">
          <p class="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Features</p>
          <NuxtLink to="/dashboard/avatar" class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-default p-4 transition-colors hover:border-primary/50 hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5">
            <span class="grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
              <UIcon name="pixelarticons:user" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-semibold tracking-widest text-primary">VIEWER</span>
              <span class="mt-1 block text-base font-semibold text-highlighted">Customize your Habbo</span>
              <span class="mt-1 block text-xs leading-5 text-muted">Your outfit appears in streamers' overlays</span>
            </span>
            <UIcon name="pixelarticons:arrow-right" class="size-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </NuxtLink>

          <NuxtLink to="/dashboard/obs-overlay" class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-default p-4 transition-colors hover:border-warning/50 hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning sm:p-5">
            <span class="grid size-11 place-items-center rounded-md bg-warning/10 text-warning">
              <UIcon name="pixelarticons:monitor" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-semibold tracking-widest text-warning">STREAMER</span>
              <span class="mt-1 block text-base font-semibold text-highlighted">Set up OBS overlay</span>
              <span class="mt-1 block text-xs leading-5 text-muted">Show your viewers as Habbo avatars on your stream</span>
            </span>
            <UIcon name="pixelarticons:arrow-right" class="size-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-warning" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>
