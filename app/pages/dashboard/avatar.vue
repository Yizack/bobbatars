<script setup lang="ts">
import { withQuery } from "ufo";
import avatarCatalogJson from "../../data/avatar-generator/catalog.json";
import { DEFAULT_MALE_OUTFIT_FIGURE, DEFAULT_OUTFIT_FIGURES } from "../../data/avatar-generator/default-outfit";

definePageMeta({ layout: "dashboard" });

type Gender = "M" | "F";

interface AvatarColor {
  id: string;
  index: number;
  club: number;
  selectable: boolean;
  hex: string;
}

interface FigureSet {
  id: string;
  gender: Gender | "U";
  colorCount: number;
  nft?: boolean;
}

interface FigureSetType {
  type: string;
  label: string;
  icon: string;
  paletteId: string;
  sets: FigureSet[];
}

interface AvatarCatalog {
  schemaVersion: number;
  build: string;
  palettes: Record<string, AvatarColor[]>;
  categories: FigureSetType[];
}

interface OutfitPart {
  setId: string;
  colorIds: string[];
}

interface HabboFigureLookup {
  queued?: boolean;
  notFound?: boolean;
  message?: string | null;
  name?: string | null;
  figureString?: string | null;
}

const catalog = avatarCatalogJson as unknown as AvatarCatalog;
const imagingUrl = "https://habbohistory.com/habbo-imaging/avatarimage.webp";
type HabboHotel = "com" | "es";
const habboHotels: { label: string, value: HabboHotel }[] = [
  { label: "Habbo.com", value: "com" },
  { label: "Habbo.es", value: "es" }
];
const categoryNames: Record<string, string> = {
  hd: "Head",
  hr: "Hair",
  ch: "Shirt",
  lg: "Trousers",
  sh: "Shoes",
  ha: "Hats",
  he: "Hair accessories",
  ea: "Glasses",
  fa: "Face accessories",
  ca: "Accessories",
  wa: "Belts",
  cc: "Jackets",
  cp: "Chest prints"
};
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
  pt: "accessories.png",
  mc: "accessories.png"
};
const genderIcons: Record<Gender, string> = { M: "male.png", F: "female.png" };

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
    figure: DEFAULT_MALE_OUTFIT_FIGURE,
    effect: null
  })
});

const gender = ref<Gender>(avatar.value.gender);
const activeType = ref("hr");
const selectedParts = ref<Record<string, OutfitPart>>({});
const savedParts = ref<Record<string, OutfitPart>>({});
const search = ref("");
const importText = ref("");
const importError = ref("");
const lookupHotel = ref<HabboHotel>("es");
const lookupUsername = ref("");
const lookupState = ref<"idle" | "loading" | "queued" | "success" | "error">("idle");
const lookupName = ref("");
const lookupError = ref("");
const lookupQueueMessage = ref("");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const previewFailed = ref(false);
const previewDirection = ref(4);

watch([lookupHotel, lookupUsername], () => {
  if (lookupState.value === "loading") return;
  lookupState.value = "idle";
  lookupName.value = "";
  lookupError.value = "";
  lookupQueueMessage.value = "";
});

const figureTypes = catalog.categories;
const figureTypeByCode = new Map(figureTypes.map(type => [type.type, type]));
const activeCategory = computed(() => figureTypeByCode.get(activeType.value));
const activePart = computed(() => selectedParts.value[activeType.value]);
const activeSet = computed(() => {
  const part = activePart.value;
  return part ? activeCategory.value?.sets.find(set => set.id === part.setId) : undefined;
});
const outfitCount = computed(() => Object.keys(selectedParts.value).length);

function parseFigureString (figureString: string): Record<string, OutfitPart> {
  const parts: Record<string, OutfitPart> = {};

  for (const token of figureString.split(".")) {
    const [type, setId, ...colorIds] = token.split("-");
    if (!type || !setId) continue;

    parts[type] = { setId, colorIds };
  }

  return parts;
}

function copyOutfitParts (parts: Record<string, OutfitPart>): Record<string, OutfitPart> {
  const copy: Record<string, OutfitPart> = {};
  for (const [type, part] of Object.entries(parts)) {
    copy[type] = { setId: part.setId, colorIds: [...part.colorIds] };
  }
  return copy;
}

const defaultPartsByGender = {
  M: parseFigureString(DEFAULT_OUTFIT_FIGURES.M),
  F: parseFigureString(DEFAULT_OUTFIT_FIGURES.F)
};

function colorsForType (type: string): string[] {
  return defaultPartsByGender[gender.value][type]?.colorIds ?? [];
}

function paletteForType (type: FigureSetType | undefined): [string, AvatarColor][] {
  if (!type) return [];

  return [...(catalog.palettes[type.paletteId] || [])]
    .sort((left, right) => left.index - right.index)
    .map((color): [string, AvatarColor] => [color.id, color]);
}

function defaultOutfit (forGender: Gender): Record<string, OutfitPart> {
  if (forGender === "M") return parseFigureString(avatar.value.figure);
  return parseFigureString(DEFAULT_OUTFIT_FIGURES[forGender]);
}

selectedParts.value = defaultOutfit(gender.value);
savedParts.value = copyOutfitParts(selectedParts.value);

const availableSets = computed(() => {
  if (!activeCategory.value) return [];

  const query = search.value.trim().toLowerCase();

  return activeCategory.value.sets
    .filter((set) => {
      const genderAvailable = set.gender === "U" || set.gender === gender.value;
      return !set.nft && genderAvailable && (!query || set.id.includes(query));
    })
    .sort((left, right) => Number(left.id) - Number(right.id))
    .map(set => ({ setId: set.id, set }));
});

const availableColors = computed(() => {
  if (!activeSet.value?.colorCount) return [];

  return paletteForType(activeCategory.value).filter(([, color]) => color.selectable);
});

function figureForParts (parts: Record<string, OutfitPart>): string {
  return Object.entries(parts)
    .map(([type, part]) => {
      if (!part?.setId) return "";
      const colors = part.colorIds.length ? `-${part.colorIds.join("-")}` : "";
      return `${type}-${part.setId}${colors}`;
    })
    .filter(Boolean)
    .join(".");
}

const figure = computed(() => figureForParts(selectedParts.value));

const previewUrl = computed(() => {
  return withQuery(imagingUrl, {
    head_direction: String(previewDirection.value),
    direction: String(previewDirection.value),
    size: "l",
    figure: figure.value,
    gender: gender.value
  });
});

watch(previewUrl, () => {
  previewFailed.value = false;
});

watch([figure, gender], () => {
  if (saveState.value !== "saving") saveState.value = "idle";
});

function selectSet (setId: string) {
  const type = activeCategory.value;
  const set = type?.sets.find(candidate => candidate.id === setId);
  if (!type || !set || set.nft || (set.gender !== "U" && set.gender !== gender.value)) return;

  const previous = selectedParts.value[type.type];
  const retainedColors = previous?.colorIds.length ? previous.colorIds : colorsForType(type.type);
  const palette = paletteForType(type);
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
  const defaultColors = colorsForType(type);
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

  const nextParts = { ...selectedParts.value };
  delete nextParts[activeType.value];
  selectedParts.value = nextParts;
}

function changeGender (value: Gender) {
  if (gender.value === value) return;
  gender.value = value;
  selectedParts.value = defaultOutfit(value);
  importError.value = "";
}

function randomizeOutfit () {
  const nextParts: Record<string, OutfitPart> = {};

  for (const type of figureTypes) {
    const candidates = type.sets.filter(set => !set.nft && (set.gender === "U" || set.gender === gender.value));
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!candidate) continue;

    const palette = paletteForType(type);
    const selectableColors = palette.filter(([, color]) => color.selectable);
    const defaultColors = colorsForType(type.type);
    const colorIds = Array.from({ length: candidate.colorCount }, (_, index) =>
      selectableColors[Math.floor(Math.random() * selectableColors.length)]?.[0]
      ?? defaultColors[index]
      ?? palette[0]?.[0]
    ).filter((colorId): colorId is string => Boolean(colorId));

    nextParts[type.type] = { setId: candidate.id, colorIds };
  }

  selectedParts.value = nextParts;
}

function importOutfit (allowUnlistedParts = false) {
  const source = importText.value.trim();
  const segments = source.split("&");
  let rawFigure = segments.shift() || "";
  const genderParam = segments.find(value => value.toLowerCase().startsWith("gender="));
  const importedGender = genderParam?.slice(genderParam.indexOf("=") + 1).toUpperCase();

  if (rawFigure.startsWith("figure=")) rawFigure = rawFigure.slice("figure=".length);

  const parsedParts: Record<string, OutfitPart> = {};
  const tokens = rawFigure.split(".").filter(Boolean);

  if (!tokens.length) {
    importError.value = "Enter a figure string to import.";
    return;
  }

  for (const token of tokens) {
    const [type, setId, ...colorIds] = token.split("-");
    if (!type || !setId) {
      importError.value = `Figure part "${token}" is malformed.`;
      return;
    }

    const metadata = figureTypeByCode.get(type);
    if (!allowUnlistedParts && (!metadata || !metadata.sets.some(set => set.id === setId))) {
      importError.value = `Figure part "${type}" is not in the current avatar catalog.`;
      return;
    }

    parsedParts[type] = { setId, colorIds };
  }

  gender.value = importedGender === "F" ? "F" : "M";
  selectedParts.value = parsedParts;
  const firstType = tokens
    .map(token => token.split("-")[0])
    .find(type => type && figureTypeByCode.has(type));
  if (firstType) activeType.value = firstType;
  importError.value = "";
}

function lookupErrorMessage (error: unknown) {
  if (error instanceof Error) {
    if ("statusMessage" in error && typeof error.statusMessage === "string") return error.statusMessage;
    if (error.message) return error.message;
  }
  return "Could not look up this Habbo user. Check the username and hotel.";
}

function isHabboFigureLookup (value: unknown): value is HabboFigureLookup {
  if (typeof value !== "object" || value === null) return false;
  return (!("queued" in value) || typeof value.queued === "boolean")
    && (!("notFound" in value) || typeof value.notFound === "boolean")
    && (!("message" in value) || typeof value.message === "string" || value.message === null)
    && (!("name" in value) || typeof value.name === "string" || value.name === null)
    && (!("figureString" in value) || typeof value.figureString === "string" || value.figureString === null);
}

async function lookupHabboFigure () {
  const username = lookupUsername.value.trim();
  if (!username || lookupState.value === "loading") return;

  lookupState.value = "loading";
  lookupError.value = "";
  lookupQueueMessage.value = "";
  importError.value = "";

  try {
    const result = await $fetch<unknown>("/api/habbo/figure", {
      query: {
        hotel: lookupHotel.value,
        username
      },
      timeout: 10000
    });
    if (!isHabboFigureLookup(result)) {
      throw new Error("Habbo History returned an unexpected response.");
    }

    lookupName.value = result.name?.trim() || username;

    if (result.notFound) {
      lookupError.value = result.message?.trim() || "No Habbo with this username could be found in this hotel.";
      lookupState.value = "error";
      return;
    }

    if (!result.figureString) {
      if (result.queued) {
        lookupQueueMessage.value = result.message?.trim()
          || "Habbo History is preparing this figure. Try the lookup again shortly.";
        lookupState.value = "queued";
        return;
      }
      throw new Error("Habbo History did not return a figure for this user.");
    }

    importText.value = `${result.figureString}&gender=${gender.value}`;
    importOutfit(true);
    if (importError.value) {
      lookupError.value = importError.value;
      lookupState.value = "error";
      importError.value = "";
      return;
    }
    lookupState.value = "success";
  }
  catch (error) {
    lookupState.value = "error";
    lookupError.value = lookupErrorMessage(error);
  }
}

async function saveAvatar () {
  const twitchLogin = user.value?.twitchLogin;
  if (!twitchLogin || saveState.value === "saving") return;

  const partsToSave = copyOutfitParts(selectedParts.value);
  const figureToSave = figureForParts(partsToSave);
  const genderToSave = gender.value;
  saveState.value = "saving";

  try {
    await $fetch(`/api/avatars/${encodeURIComponent(twitchLogin)}`, {
      method: "POST",
      body: {
        figure: figureToSave,
        gender: genderToSave,
        effect: null
      }
    });
    savedParts.value = partsToSave;
    saveState.value = figure.value === figureToSave && gender.value === genderToSave ? "saved" : "idle";
  }
  catch {
    saveState.value = figure.value === figureToSave && gender.value === genderToSave ? "error" : "idle";
  }
}

function categoryName (type: string): string {
  return figureTypeByCode.get(type)?.label || categoryNames[type] || type.toUpperCase();
}

function categoryIcon (type: string): string {
  return `/avatar-generator/icons/${categoryIcons[type] || "body.png"}`;
}

function genderIcon (value: Gender): string {
  return `/avatar-generator/icons/${genderIcons[value]}`;
}

function catalogPreviewColors (type: string, setId: string): string[] {
  const figureType = figureTypeByCode.get(type);
  const set = figureType?.sets.find(candidate => candidate.id === setId);
  if (!figureType || !set || !set.colorCount) return [];

  const palette = paletteForType(figureType);
  const paletteIds = new Set(palette.map(([id]) => id));
  let preferredColors = savedParts.value[type]?.colorIds ?? colorsForType(type);
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
  const previewFigure = Object.entries(previewParts)
    .map(([partType, part]) => {
      if (!part.setId) return "";
      const colors = part.colorIds.length ? `-${part.colorIds.join("-")}` : "";
      return `${partType}-${part.setId}${colors}`;
    })
    .filter(Boolean)
    .join(".");

  return withQuery(imagingUrl, {
    figure: previewFigure,
    gender: gender.value,
    size: "m"
  });
}

useHead({ title: "Avatar Studio | Habbo Outfit Studio" });
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <UBadge color="primary" variant="soft" size="sm" class="uppercase">Habbo Builder</UBadge>
          <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">My Avatar</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Choose catalog items and colors to customize your avatar.</p>
        </div>
        <div class="flex gap-2" role="group" aria-label="Avatar gender">
          <UButton
            :color="gender === 'M' ? 'primary' : 'neutral'"
            :variant="gender === 'M' ? 'solid' : 'outline'"
            :aria-pressed="gender === 'M'"
            @click="changeGender('M')"
          >
            <img :src="genderIcon('M')" alt="" class="size-5 shrink-0 object-contain" style="object-position: 0 4px;">Male
          </UButton>
          <UButton
            :color="gender === 'F' ? 'primary' : 'neutral'"
            :variant="gender === 'F' ? 'solid' : 'outline'"
            :aria-pressed="gender === 'F'"
            @click="changeGender('F')"
          >
            <img :src="genderIcon('F')" alt="" class="size-5 shrink-0 object-contain">Female
          </UButton>
        </div>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <UCard variant="outline" class="order-2 min-w-0 xl:order-1" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-[10px] font-semibold tracking-widest text-primary uppercase">Catalog</p>
                <h2 class="mt-1 text-lg font-semibold text-highlighted">Wardrobe</h2>
              </div>
              <UBadge color="neutral" variant="subtle" size="sm">{{ availableSets.length }} items</UBadge>
            </div>
          </template>

          <div class="grid xl:grid-cols-[13rem_minmax(0,1fr)]">
            <nav class="flex flex-wrap gap-2 overflow-x-auto border-b border-default p-3 xl:flex-col xl:overflow-x-visible xl:border-b-0 xl:border-r" aria-label="Outfit categories">
              <UButton
                v-for="type in figureTypes"
                :key="type.type"
                :color="activeType === type.type ? 'primary' : 'neutral'"
                :variant="activeType === type.type ? 'soft' : 'ghost'"
                :aria-pressed="activeType === type.type"
                class="min-w-36 shrink-0 justify-start xl:w-full"
                @click="activeType = type.type; search = ''"
              >
                <img :src="categoryIcon(type.type)" alt="" class="size-5 shrink-0 object-contain">
                <span class="truncate">{{ categoryName(type.type) }}</span>
                <UBadge class="ml-auto" color="neutral" variant="subtle" size="xs">
                  {{ type.sets.filter(set => !set.nft && (set.gender === 'U' || set.gender === gender)).length }}
                </UBadge>
              </UButton>
            </nav>

            <div class="min-w-0 space-y-4 p-4">
              <div class="flex items-center gap-2">
                <UInput v-model="search" type="search" icon="i-lucide-search" class="min-w-0 flex-1" :aria-label="`Filter ${categoryName(activeType)} by set ID`" placeholder="Filter by set ID" />
                <UButton v-if="activeType !== 'hd' && activeType !== 'lg' && activePart" type="button" color="error" variant="ghost" icon="i-lucide-eraser" @click="removeActivePart">Remove</UButton>
              </div>

              <div class="grid max-h-112 grid-cols-3 content-start gap-2 overflow-y-auto sm:grid-cols-4 2xl:grid-cols-5" :aria-label="`${categoryName(activeType)} options`">
                <UButton
                  v-for="item in availableSets"
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
                    <img
                      class="max-h-28 max-w-full scale-130 object-contain self-center"
                      :src="itemPreviewUrl(activeType, item.setId)"
                      alt=""
                      loading="lazy"
                    >
                  </span>
                  <span class="w-full truncate text-center font-mono text-xs">#{{ item.setId }}</span>
                </UButton>
                <UAlert v-if="!availableSets.length" class="col-span-full" color="neutral" variant="subtle" title="No matching items" description="Try another set ID or category." icon="i-lucide-search-x" />
              </div>

              <USeparator label="PALETTE" />
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs font-semibold text-highlighted">Colors</span>
                  <UBadge color="neutral" variant="subtle" size="xs">
                    {{ activeSet?.colorCount ? `${activeSet.colorCount} color slots` : activeSet ? 'Fixed color' : 'Select an item' }}
                  </UBadge>
                </div>
                <div v-if="availableColors.length && activeSet?.colorCount" class="space-y-3" aria-label="Available colors">
                  <div v-for="colorIndex in activeSet.colorCount" :key="colorIndex" class="space-y-2">
                    <p class="text-xs text-muted">Color {{ colorIndex }}</p>
                    <div class="grid max-h-32 grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-2 overflow-y-auto p-0.5" :aria-label="`Available colors for slot ${colorIndex}`">
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
                <p v-else class="text-xs text-muted">Select a set with color slots to view its palette.</p>
              </div>
            </div>
          </div>
        </UCard>

        <aside class="order-1 grid min-w-0 content-start grid-cols-2 gap-3 sm:gap-4 xl:order-2 xl:grid-cols-1" aria-label="Avatar preview and controls">
          <UCard variant="outline" class="min-w-0">
            <template #header>
              <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-[10px] font-semibold tracking-widest text-primary">HABBO IMAGING</p>
                  <h2 class="mt-1 text-lg font-semibold text-highlighted">Outfit preview</h2>
                </div>
                <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-rotate-3d" @click="previewDirection = (previewDirection + 1) % 8">
                  Turn · {{ previewDirection }}
                </UButton>
              </div>
            </template>

            <div class="relative grid min-h-56 place-items-center overflow-hidden rounded-md bg-neutral-950 p-2 sm:min-h-72 sm:p-4">
              <img
                v-if="!previewFailed"
                :key="previewUrl"
                class="relative z-10 max-h-56 max-w-full object-contain sm:max-h-72"
                :src="previewUrl"
                :alt="`${gender === 'M' ? 'Male' : 'Female'} Habbo avatar preview`"
                loading="eager"
                @error="previewFailed = true"
              >
              <UAlert v-else color="warning" variant="subtle" title="Preview unavailable" description="Habbo Imaging did not return this outfit. You can still save it." icon="i-lucide-image-off" />
              <UBadge class="absolute bottom-3 right-3 z-20" color="neutral" variant="subtle">{{ gender }} / DIR {{ previewDirection }}</UBadge>
            </div>

            <div class="mt-3 grid grid-cols-2 items-center gap-2 sm:mt-4 sm:flex sm:flex-wrap">
              <UButton size="sm" class="min-w-0 justify-center" color="secondary" variant="soft" icon="i-lucide-shuffle" @click="randomizeOutfit">Randomize</UButton>
              <UButton size="sm" class="min-w-0 justify-center" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="selectedParts = defaultOutfit(gender)">Reset</UButton>
              <UButton size="sm" class="col-span-2 justify-center sm:col-span-1" color="primary" icon="i-lucide-save" :loading="saveState === 'saving'" :disabled="!user?.twitchLogin || saveState === 'saving'" @click="saveAvatar">Save avatar</UButton>
              <UBadge class="col-span-2 justify-center sm:ml-auto sm:col-span-1" color="neutral" variant="subtle">{{ outfitCount }} parts</UBadge>
            </div>
            <UAlert v-if="saveState === 'saved'" class="mt-3" color="success" variant="subtle" title="Avatar saved" description="Your current avatar has been saved to your account." icon="i-lucide-circle-check" />
            <UAlert v-else-if="saveState === 'error'" class="mt-3" color="error" variant="subtle" title="Could not save avatar" description="Please try again." icon="i-lucide-circle-alert" />
          </UCard>

          <UCard variant="outline" class="min-w-0">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-user-round-search" class="size-4 text-primary" />
                <h2 class="text-sm font-semibold text-highlighted">Look up a Habbo figure</h2>
              </div>
            </template>
            <div class="grid min-w-0 gap-3">
              <label class="grid min-w-0 gap-1 text-sm font-medium text-highlighted">
                <span>Hotel</span>
                <USelect
                  v-model="lookupHotel"
                  :items="habboHotels"
                  value-key="value"
                  label-key="label"
                  aria-label="Habbo hotel"
                  class="w-full"
                  :disabled="lookupState === 'loading'"
                />
              </label>
              <label class="grid min-w-0 gap-1 text-sm font-medium text-highlighted">
                <span>Username</span>
                <UInput
                  v-model="lookupUsername"
                  autocomplete="off"
                  aria-label="Habbo username"
                  placeholder="Enter a Habbo username"
                  class="w-full"
                  :disabled="lookupState === 'loading'"
                  @keydown.enter.prevent="lookupHabboFigure"
                />
              </label>
              <UButton
                type="button"
                class="w-full justify-center"
                color="primary"
                icon="i-lucide-search"
                :loading="lookupState === 'loading'"
                :disabled="!lookupUsername.trim() || lookupState === 'loading'"
                @click="lookupHabboFigure"
              >
                Look up
              </UButton>
            </div>
            <UAlert
              v-if="lookupState === 'queued'"
              class="mt-3"
              color="warning"
              variant="subtle"
              title="Figure lookup queued"
              :description="lookupQueueMessage"
              icon="i-lucide-clock-3"
            />
            <UAlert
              v-else-if="lookupState === 'success'"
              class="mt-3"
              color="success"
              variant="subtle"
              :title="`Loaded ${lookupName}'s figure`"
              description="The figure is ready to preview and edit. Save it to keep it on your account."
              icon="i-lucide-circle-check"
            />
            <UAlert
              v-else-if="lookupState === 'error'"
              class="mt-3"
              color="error"
              variant="subtle"
              title="Could not look up this figure"
              :description="lookupError"
              icon="i-lucide-circle-alert"
            />
          </UCard>

          <UCard variant="outline" class="col-span-2 min-w-0 xl:col-span-1">
            <template #header>
              <div class="flex items-center gap-2"><UIcon name="i-lucide-download" class="size-4 text-primary" /><h2 class="text-sm font-semibold text-highlighted">Import an existing figure</h2></div>
            </template>
            <div class="grid gap-3">
              <UTextarea id="import-figure" v-model="importText" :rows="2" placeholder="hd-3092-2.hr-831-61.ch-3438-110-1408&gender=M" aria-label="Paste a Habbo figure string" />
              <UAlert v-if="importError" color="error" variant="subtle" :description="importError" />
              <UButton color="primary" icon="i-lucide-download" @click="importOutfit()">Import outfit</UButton>
            </div>
          </UCard>
        </aside>
      </div>
    </div>
  </main>
</template>
