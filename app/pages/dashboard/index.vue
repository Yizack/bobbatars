<script setup lang="ts">
import { withQuery } from "ufo";
import { CLOTHING_PARTS } from "#shared/clothing";
import { DEFAULT_OUTFIT_FIGURES } from "../../data/avatar-generator/habbo-default-outfit";
import avatarCatalogJson from "../../data/avatar-generator/habbo-catalog.json";
import penguinCatalogJson from "../../data/avatar-generator/penguin-catalog.json";

definePageMeta({ layout: "dashboard", middleware: "authenticated" });

const { user } = useUserSession();

if (!user.value) {
  throw createError({
    status: 401,
    message: "User not authenticated",
    fatal: true
  });
}

const defaultAvatar: AvatarPreviewState = {
  avatarType: "habbo",
  gender: "M",
  figure: DEFAULT_OUTFIT_FIGURES.M,
  effect: null
};

const { data: avatar } = await useFetch<AvatarPreviewState>(`/api/avatars/${user.value.twitchLogin}`, {
  default: () => defaultAvatar
});

const twitchLogin = computed(() => user.value?.twitchLogin || "");
const displayName = computed(() => user.value?.twitchDisplay || twitchLogin.value || "Twitch user");
const previewUrl = computed(() => avatar.value.avatarType === "habbo" ? withQuery(habboImagingUrl, {
  head_direction: "4",
  direction: "4",
  size: "fl",
  figure: avatar.value.figure,
  gender: avatar.value.gender,
  format: "webp",
  position: "bottom",
  ...(avatar.value.effect === null ? {} : { effect: String(avatar.value.effect) })
}) : "");
const previewUnavailable = ref(false);

const avatarCatalog = avatarCatalogJson as unknown as {
  schemaVersion: number;
  build: string;
  categories: Array<{ type: string, sets: Array<{ id: string, nft?: boolean }> }>;
  effects?: Array<{ id: string }>;
};
const penguinCatalog = penguinCatalogJson as PenguinCatalogItem[];
const penguinCategoryTypes = new Set<number>(CLOTHING_PARTS.map(part => part.type));

const habboItemCount = avatarCatalog.categories.reduce((count, category) =>
  count + category.sets.filter(set => !set.nft).length, 0
) + (avatarCatalog?.effects?.length || 0);
const habboCategoryCount = avatarCatalog.categories.length + (avatarCatalog?.effects?.length ? 1 : 0);
const penguinItemCount = penguinCatalog.filter(item => penguinCategoryTypes.has(item.type)).length;
const penguinCategoryCount = CLOTHING_PARTS.length;
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 border-b border-default pb-6 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div>
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-primary uppercase">Bobbatars</p>
          <h1 id="page-title" class="mt-2 text-3xl max-sm:text-2xl font-semibold text-highlighted sm:text-4xl">Your avatar, on Twitch</h1>
          <p class="mt-3 text-sm max-sm:text-xs leading-6 text-muted">Choose a Habbo or Club Penguin avatar for your Twitch account and your community overlays.</p>
        </div>
      </section>

      <section class="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Habbo and Penguin catalog statistics">
        <div class="border-l-2 border-primary/50 pl-4">
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-primary uppercase">Habbo categories</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl max-sm:text-xl font-semibold tabular-nums text-highlighted">{{ habboCategoryCount }}</span>
            <span class="text-sm max-sm:text-xs text-muted">categories</span>
          </p>
        </div>
        <div class="border-l-2 border-warning/50 pl-4">
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-warning uppercase">Habbo items</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl max-sm:text-xl font-semibold tabular-nums text-highlighted">{{ habboItemCount }}</span>
            <span class="text-sm max-sm:text-xs text-muted">items</span>
          </p>
        </div>
        <div class="border-l-2 border-info/50 pl-4">
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-info uppercase">Penguin categories</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl max-sm:text-xl font-semibold tabular-nums text-highlighted">{{ penguinCategoryCount }}</span>
            <span class="text-sm max-sm:text-xs text-muted">categories</span>
          </p>
        </div>
        <div class="border-l-2 border-info/50 pl-4">
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-info uppercase">Penguin items</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="text-2xl max-sm:text-xl font-semibold tabular-nums text-highlighted">{{ penguinItemCount }}</span>
            <span class="text-sm max-sm:text-xs text-muted">items</span>
          </p>
        </div>
      </section>

      <section class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]" aria-label="Avatar and stream tools">
        <UCard variant="outline" class="min-w-0 overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <UIcon name="pixelarticons:shirt" class="size-5 text-primary" />
                <h2 class="text-base max-sm:text-sm font-semibold text-highlighted">My avatar</h2>
              </div>
            </div>
          </template>

          <div class="relative grid min-h-88 place-items-center overflow-hidden bg-neutral-950 p-6 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[32px_32px]">
            <HabboPreviewImage v-if="avatar.avatarType === 'habbo' && !previewUnavailable" class="relative z-10" :src="previewUrl" @error="previewUnavailable = true" />
            <PenguinAvatarCanvas v-else-if="avatar.avatarType === 'penguin'" class="relative z-10" :appearance="avatar" :direction="4" action="std" :scale="3" />
            <UAlert v-else class="relative z-10 max-w-sm" color="warning" variant="subtle" title="Preview unavailable" description="Your saved avatar is still available in the editor." icon="pixelarticons:image-broken" :ui="{ title: 'max-sm:text-xs', description: 'max-sm:text-[11px]' }" />
          </div>

          <div class="flex flex-col gap-4 border-t border-default p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-widest text-muted uppercase">User</p>
              <code class="mt-1 block truncate text-xs max-sm:text-[11px] text-highlighted">{{ displayName }} (@{{ twitchLogin }})</code>
            </div>
            <UButton class="max-sm:text-xs" to="/dashboard/avatar" color="primary" icon="pixelarticons:pencil" trailing-icon="pixelarticons:arrow-right">
              Edit avatar
            </UButton>
          </div>
        </UCard>

        <div class="grid gap-3">
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-[0.18em] text-muted uppercase">Features</p>
          <NuxtLink to="/dashboard/avatar" class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-default p-4 transition-colors hover:border-primary/50 hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5">
            <span class="grid size-11 place-items-center rounded-md bg-primary/10 text-primary">
              <UIcon name="pixelarticons:user" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] max-sm:text-[9px] font-semibold tracking-widest text-primary">VIEWER</span>
              <span class="mt-1 block text-base max-sm:text-sm font-semibold text-highlighted">Customize your avatar</span>
              <span class="mt-1 block text-xs max-sm:text-[11px] leading-5 text-muted">Your outfit appears in streamers' overlays</span>
            </span>
            <UIcon name="pixelarticons:arrow-right" class="size-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </NuxtLink>

          <NuxtLink to="/dashboard/obs-overlay" class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-default p-4 transition-colors hover:border-warning/50 hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning sm:p-5">
            <span class="grid size-11 place-items-center rounded-md bg-warning/10 text-warning">
              <UIcon name="pixelarticons:monitor" class="size-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] max-sm:text-[9px] font-semibold tracking-widest text-warning">STREAMER</span>
              <span class="mt-1 block text-base max-sm:text-sm font-semibold text-highlighted">Set up OBS overlay</span>
              <span class="mt-1 block text-xs max-sm:text-[11px] leading-5 text-muted">Show your community's Habbo and Club Penguin avatars on stream</span>
            </span>
            <UIcon name="pixelarticons:arrow-right" class="size-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-warning" />
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>
