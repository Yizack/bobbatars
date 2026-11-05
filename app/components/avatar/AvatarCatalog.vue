<script setup lang="ts">
import { computed, ref, toRefs, watch } from "vue";
import { useInfiniteScroll } from "@vueuse/core";
import { withQuery } from "ufo";
import type { AvatarCatalog as AvatarCatalogData, AvatarGender, OutfitPart } from "../../types/avatar";
import { avatarImagingUrl, colorsForType, figureForParts, paletteForType } from "../../utils/avatar";

const props = defineProps<{
  catalog: AvatarCatalogData;
  gender: AvatarGender;
  savedParts: Record<string, OutfitPart>;
}>();
const { catalog, gender, savedParts } = toRefs(props);
const activeType = defineModel<string>("activeType", { required: true });
const search = defineModel<string>("search", { required: true });
const selectedParts = defineModel<Record<string, OutfitPart>>("selectedParts", { required: true });
const selectedEffect = defineModel<number | null>("selectedEffect", { required: true });

const categoryNames: Record<string, string> = { effects: "Effects" };
const categoryIcons: Record<string, string> = {
  hd: "body.png",
  hr: "hair.png",
  ch: "tops.png",
  lg: "bottoms.png",
  sh: "shoes.png",
  ha: "hats.png",
  he: "hair-accessories.png",
  ea: "glasses.png",
  fa: "moustaches.png",
  ca: "accessories.png",
  wa: "belts.png",
  cc: "jackets.png",
  cp: "chest.png",
  pt: "pet.png",
  mc: "extra.png",
  effects: "wand.png"
};

const figureTypes = catalog.value.categories;
const figureTypeByCode = new Map(figureTypes.map(type => [type.type, type]));
const activeCategory = computed(() => figureTypeByCode.get(activeType.value));
const activePart = computed(() => selectedParts.value[activeType.value]);
const activeSet = computed(() => {
  const part = activePart.value;
  return part ? activeCategory.value?.sets.find(set => set.id === part.setId) : undefined;
});
const availableSets = computed(() => {
  if (!activeCategory.value) return [];

  const query = search.value.trim().toLowerCase();

  return activeCategory.value.sets
    .filter((set) => {
      const genderAvailable = set.gender === "U" || set.gender === gender.value;
      const matchesQuery = !query
        || set.id.toLowerCase().includes(query)
        || set.label.toLowerCase().includes(query);
      return !set.nft && genderAvailable && matchesQuery;
    })
    .sort((left, right) => Number(left.id) - Number(right.id))
    .map(set => ({ setId: set.id, set, label: set.label }));
});
const availableEffects = computed(() => {
  const query = search.value.trim().toLowerCase();
  return catalog.value.effects.filter(effect => !query || effect.name.toLowerCase().includes(query));
});
const availableColors = computed(() => {
  if (!activeSet.value?.colorCount) return [];
  return paletteForType(catalog.value.palettes, activeCategory.value).filter(([, color]) => color.selectable);
});

const catalogItemsContainer = ref<HTMLElement | null>(null);
const effectItemsContainer = ref<HTMLElement | null>(null);
const pageSize = 18;
const visibleSetCount = ref(pageSize);
const visibleEffectCount = ref(pageSize);
const hasSetSearch = computed(() => Boolean(search.value.trim()));
const visibleSets = computed(() => {
  if (hasSetSearch.value) return availableSets.value;
  return availableSets.value.slice(0, visibleSetCount.value);
});
const visibleEffects = computed(() => availableEffects.value.slice(0, visibleEffectCount.value));

useInfiniteScroll(
  catalogItemsContainer,
  () => {
    visibleSetCount.value = Math.min(visibleSetCount.value + pageSize, availableSets.value.length);
  },
  {
    distance: 160,
    canLoadMore: () => !hasSetSearch.value && visibleSetCount.value < availableSets.value.length
  }
);

watch(availableSets, () => {
  visibleSetCount.value = pageSize;
  if (catalogItemsContainer.value) catalogItemsContainer.value.scrollTop = 0;
}, { flush: "post" });

useInfiniteScroll(
  effectItemsContainer,
  () => {
    visibleEffectCount.value = Math.min(visibleEffectCount.value + pageSize, availableEffects.value.length);
  },
  {
    distance: 160,
    canLoadMore: () => visibleEffectCount.value < availableEffects.value.length
  }
);

watch([availableEffects, activeType], () => {
  if (activeType.value !== "effects") return;
  visibleEffectCount.value = pageSize;
  if (effectItemsContainer.value) effectItemsContainer.value.scrollTop = 0;
}, { flush: "post" });

function categoryName (type: string): string {
  return figureTypeByCode.get(type)?.label || categoryNames[type] || type.toUpperCase();
}

function categoryIcon (type: string): string {
  return `/avatar-generator/icons/${categoryIcons[type] || "body.png"}`;
}

function selectSet (setId: string) {
  const type = activeCategory.value;
  const set = type?.sets.find(candidate => candidate.id === setId);
  if (!type || !set || set.nft || (set.gender !== "U" && set.gender !== gender.value)) return;

  const previous = selectedParts.value[type.type];
  const retainedColors = previous?.colorIds.length ? previous.colorIds : colorsForType(gender.value, type.type);
  const palette = paletteForType(catalog.value.palettes, type);
  const paletteIds = new Set(palette.map(([id]) => id));
  const validColors = retainedColors.filter(colorId => paletteIds.has(colorId)).slice(0, set.colorCount);
  const fallbackColor = palette.find(([, color]) => color.selectable)?.[0] ?? palette[0]?.[0];
  const colorIds = Array.from({ length: set.colorCount }, (_, index) => validColors[index] ?? fallbackColor)
    .filter((colorId): colorId is string => Boolean(colorId));

  selectedParts.value = {
    ...selectedParts.value,
    [type.type]: { setId, colorIds }
  };
}

function selectColor (colorIndex: number, colorId: string) {
  const type = activeType.value;
  const part = selectedParts.value[type];
  const colorCount = activeSet.value?.colorCount ?? 0;
  if (!part || colorIndex < 0 || colorIndex >= colorCount) return;

  const fallbackColor = availableColors.value[0]?.[0];
  const defaultColors = colorsForType(gender.value, type);
  const colorIds = Array.from({ length: colorCount }, (_, index) => {
    if (index === colorIndex) return colorId;
    return part.colorIds[index] ?? defaultColors[index] ?? fallbackColor ?? "";
  }).filter(Boolean);

  selectedParts.value = {
    ...selectedParts.value,
    [type]: { ...part, colorIds }
  };
}

function removeActivePart () {
  if (activeType.value === "hd" || activeType.value === "lg") return;

  const nextParts: Record<string, OutfitPart> = {};
  for (const [type, part] of Object.entries(selectedParts.value)) {
    if (type !== activeType.value) nextParts[type] = part;
  }
  selectedParts.value = nextParts;
}

function effectPreviewUrl (effectId: string | null): string {
  return withQuery(avatarImagingUrl, {
    figure: figureForParts(selectedParts.value),
    gender: gender.value,
    size: "m",
    position: "bottom",
    ...(effectId === null ? {} : { effect: effectId })
  });
}

function catalogPreviewColors (type: string, setId: string): string[] {
  const figureType = figureTypeByCode.get(type);
  const set = figureType?.sets.find(candidate => candidate.id === setId);
  if (!figureType || !set || !set.colorCount) return [];

  const palette = paletteForType(catalog.value.palettes, figureType);
  const paletteIds = new Set(palette.map(([id]) => id));
  let preferredColors = savedParts.value[type]?.colorIds ?? colorsForType(gender.value, type);
  if (type === "hd") preferredColors = selectedParts.value.hd?.colorIds ?? preferredColors;
  const validColors = preferredColors.filter(colorId => paletteIds.has(colorId)).slice(0, set.colorCount);
  const fallbackColor = palette.find(([, color]) => color.selectable)?.[0] ?? palette[0]?.[0];
  return Array.from({ length: set.colorCount }, (_, index) => validColors[index] ?? fallbackColor)
    .filter((colorId): colorId is string => Boolean(colorId));
}

function itemPreviewUrl (type: string, setId: string): string {
  const figureType = figureTypeByCode.get(type);
  const set = figureType?.sets.find(candidate => candidate.id === setId);
  if (!figureType || !set) return "";

  const previewParts: Record<string, OutfitPart> = {};
  for (const [partType, part] of Object.entries(selectedParts.value)) {
    previewParts[partType] = {
      setId: part.setId,
      colorIds: catalogPreviewColors(partType, part.setId)
    };
  }
  previewParts[type] = { setId, colorIds: catalogPreviewColors(type, setId) };

  return withQuery(avatarImagingUrl, {
    figure: figureForParts(previewParts),
    gender: gender.value,
    size: "m",
    position: "bottom"
  });
}
</script>

<template>
  <UCard variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-[10px] max-sm:text-[9px] font-semibold tracking-widest text-primary uppercase">Catalog</p>
          <h2 class="mt-1 text-lg max-sm:text-base font-semibold text-highlighted">Wardrobe</h2>
        </div>
        <UBadge class="max-sm:text-[11px]" color="neutral" variant="subtle" size="sm">{{ activeType === 'effects' ? availableEffects.length : availableSets.length }} items</UBadge>
      </div>
    </template>

    <div class="grid xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-1 gap-2 overflow-x-auto border-b border-default p-3 xl:overflow-x-visible xl:border-b-0 xl:border-r" aria-label="Outfit categories">
        <UButton
          v-for="type in figureTypes"
          :key="type.type"
          :color="activeType === type.type ? 'primary' : 'neutral'"
          :variant="activeType === type.type ? 'soft' : 'ghost'"
          :aria-pressed="activeType === type.type"
          class="min-w-36 shrink-0 justify-start xl:w-full max-sm:text-xs"
          @click="activeType = type.type; search = ''"
        >
          <img :src="categoryIcon(type.type)" alt="" class="size-8 shrink-0 object-contain">
          <span class="truncate">{{ categoryName(type.type) }}</span>
          <UBadge class="ml-auto max-sm:text-[9px]" color="neutral" variant="subtle" size="xs">
            {{ type.sets.filter(set => !set.nft && (set.gender === 'U' || set.gender === gender)).length }}
          </UBadge>
        </UButton>
        <UButton
          :color="activeType === 'effects' ? 'primary' : 'neutral'"
          :variant="activeType === 'effects' ? 'soft' : 'ghost'"
          :aria-pressed="activeType === 'effects'"
          class="min-w-36 shrink-0 justify-start xl:w-full max-sm:text-xs"
          @click="activeType = 'effects'; search = ''"
        >
          <img :src="categoryIcon('effects')" alt="" class="size-8 shrink-0 object-contain">
          <span class="truncate">{{ categoryName('effects') }}</span>
          <UBadge class="ml-auto max-sm:text-[9px]" color="neutral" variant="subtle" size="xs">{{ catalog.effects.length }}</UBadge>
        </UButton>
      </nav>

      <div class="min-w-0 space-y-4 p-4">
        <div class="flex items-center gap-2">
          <UInput v-model="search" type="search" icon="pixelarticons:search" class="min-w-0 flex-1" :aria-label="activeType === 'effects' ? 'Filter effects by name' : `Filter ${categoryName(activeType)} by name or ID`" :placeholder="activeType === 'effects' ? 'Filter by effect name' : 'Filter by name or ID'" />
          <UButton v-if="activeType === 'effects' && selectedEffect !== null" type="button" class="max-sm:text-xs" color="error" variant="ghost" icon="pixelarticons:close" @click="selectedEffect = null">Remove effect</UButton>
          <UButton v-else-if="activeType !== 'hd' && activeType !== 'lg' && activePart" type="button" class="max-sm:text-xs" color="error" variant="ghost" icon="pixelarticons:close" @click="removeActivePart">Remove</UButton>
        </div>

        <div v-if="activeType === 'effects'" ref="effectItemsContainer" class="grid max-h-112 grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 2xl:grid-cols-4" aria-label="Avatar effects">
          <UButton
            type="button"
            :color="selectedEffect === null ? 'primary' : 'neutral'"
            :variant="selectedEffect === null ? 'soft' : 'outline'"
            class="h-auto min-w-0 flex-col items-stretch gap-2 p-2 text-left"
            aria-label="No effect"
            :aria-pressed="selectedEffect === null"
            @click="selectedEffect = null"
          >
            <span class="flex h-36 w-full items-center justify-center overflow-hidden rounded bg-neutral-950">
              <img class="max-h-28 max-w-full object-contain" :src="effectPreviewUrl(null)" alt="" loading="lazy">
            </span>
            <span class="w-full truncate text-center text-xs max-sm:text-[11px]">None</span>
          </UButton>
          <UButton
            v-for="effect in visibleEffects"
            :key="effect.id"
            type="button"
            :color="selectedEffect === Number(effect.id) ? 'primary' : 'neutral'"
            :variant="selectedEffect === Number(effect.id) ? 'soft' : 'outline'"
            class="h-auto min-w-0 flex-col items-stretch gap-2 p-2 text-left"
            :aria-label="`Effect ${effect.name}`"
            :aria-pressed="selectedEffect === Number(effect.id)"
            @click="selectedEffect = Number(effect.id)"
          >
            <span class="flex h-36 w-full items-center justify-center overflow-hidden rounded bg-neutral-950">
              <img class="max-h-28 max-w-full object-contain" :src="effectPreviewUrl(effect.id)" alt="" loading="lazy">
            </span>
            <span class="w-full truncate text-center text-xs max-sm:text-[11px] text-muted">{{ effect.name }}</span>
          </UButton>
          <UAlert v-if="!availableEffects.length" class="col-span-full" color="neutral" variant="subtle" title="No matching effects" description="Try another effect name." icon="pixelarticons:letter-x-circle" :ui="{ title: 'max-sm:text-xs', description: 'max-sm:text-[11px]' }" />
        </div>
        <template v-else>
          <div ref="catalogItemsContainer" class="grid max-h-112 grid-cols-3 content-start gap-2 overflow-y-auto sm:grid-cols-4 2xl:grid-cols-5" :aria-label="`${categoryName(activeType)} options`">
            <UButton
              v-for="item in visibleSets"
              :key="item.setId"
              type="button"
              :color="activePart?.setId === item.setId ? 'primary' : 'neutral'"
              :variant="activePart?.setId === item.setId ? 'soft' : 'outline'"
              class="h-auto min-w-0 flex-col items-stretch gap-2 p-2 text-left"
              :aria-label="`${categoryName(activeType)} set ${item.setId}`"
              :aria-pressed="activePart?.setId === item.setId"
              @click="selectSet(item.setId)"
            >
              <span class="flex h-36 w-full items-center justify-center overflow-hidden rounded bg-neutral-950">
                <img class="max-h-28 max-w-full scale-130 object-contain self-center" :src="itemPreviewUrl(activeType, item.setId)" alt="" loading="lazy">
              </span>
              <div class="flex flex-col">
                <span class="w-full truncate text-center font-mono text-xs max-sm:text-[11px]">{{ item.label }}</span>
                <span class="w-full truncate text-center font-mono text-xs max-sm:text-[11px] text-muted">#{{ item.setId }}</span>
              </div>
            </UButton>
            <UAlert v-if="!availableSets.length" class="col-span-full" color="neutral" variant="subtle" title="No matching items" description="Try another set ID or category." icon="pixelarticons:letter-x-circle" :ui="{ title: 'max-sm:text-xs', description: 'max-sm:text-[11px]' }" />
          </div>

          <USeparator label="PALETTE" />
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs max-sm:text-[11px] font-semibold text-highlighted">Colors</span>
              <UBadge class="max-sm:text-[9px]" color="neutral" variant="subtle" size="xs">
                {{ activeSet?.colorCount ? `${activeSet.colorCount} color slots` : activeSet ? 'Fixed color' : 'Select an item' }}
              </UBadge>
            </div>
            <div v-if="availableColors.length && activeSet?.colorCount" class="space-y-3" aria-label="Available colors">
              <div v-for="colorIndex in activeSet.colorCount" :key="colorIndex" class="space-y-2">
                <p class="text-xs max-sm:text-[11px] text-muted">Color {{ colorIndex }}</p>
                <div class="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-2 overflow-y-auto p-0.5" :aria-label="`Available colors for slot ${colorIndex}`">
                  <UButton
                    v-for="[colorId, color] in availableColors"
                    :key="colorId"
                    class="size-7 min-w-7 rounded-none p-0 ring-1 ring-inset ring-white/20"
                    :class="activePart?.colorIds[colorIndex - 1] === colorId ? 'ring-2 ring-primary ring-offset-2 ring-offset-default' : ''"
                    :style="{ backgroundColor: `#${color.hex}` }"
                    type="button"
                    :aria-label="`Color slot ${colorIndex}: ${color.hex}, ID ${colorId}`"
                    :aria-pressed="activePart?.colorIds[colorIndex - 1] === colorId"
                    @click="selectColor(colorIndex - 1, colorId)"
                  />
                </div>
              </div>
            </div>
            <p v-else class="text-xs max-sm:text-[11px] text-muted">Select a set with color slots to view its palette.</p>
          </div>
        </template>
      </div>
    </div>
  </UCard>
</template>
