<script setup lang="ts">
import { withQuery } from "ufo";
import avatarCatalogJson from "../../data/avatar-generator/catalog.json";
import { DEFAULT_MALE_OUTFIT_FIGURE } from "../../data/avatar-generator/default-outfit";

definePageMeta({ layout: "dashboard" });

type Gender = "M" | "F";

interface AvatarColor {
  index: number;
  club: number;
  selectable: number;
  hex: string;
}

interface FigureSet {
  gender: Gender | "U";
  club: number;
  colorable: number;
  selectable: number;
  preselectable: number;
}

interface FigureSetType {
  paletteid: number;
  type: string;
  sets: Record<string, FigureSet>;
}

interface DefaultPart {
  set: string;
  color: string;
}

interface AvatarCatalog {
  source: string;
  sourceCommit: string;
  palettes: Record<string, Record<string, AvatarColor>>;
  setTypes: FigureSetType[];
  defaults: Record<Gender, Record<string, DefaultPart>>;
}

interface OutfitPart {
  setId: string;
  colorIds: string[];
}

const catalog = avatarCatalogJson as unknown as AvatarCatalog;
const imagingUrl = "https://habbohistory.com/habbo-imaging/avatarimage.webp";
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
  cp: "chest.png"
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
const search = ref("");
const importText = ref("");
const importError = ref("");
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const previewFailed = ref(false);
const previewDirection = ref(4);

const figureTypes = catalog.setTypes;
const figureTypeByCode = new Map(figureTypes.map(type => [type.type, type]));
const activeCategory = computed(() => figureTypeByCode.get(activeType.value));
const activePart = computed(() => selectedParts.value[activeType.value]);
const activeSet = computed(() => activePart.value && activeCategory.value?.sets[activePart.value.setId]);
const outfitCount = computed(() => Object.keys(selectedParts.value).length);

function colorsForType (type: string): string[] {
  const defaultPart = catalog.defaults[gender.value][type];
  return String(defaultPart?.color || "").split("-").filter(Boolean);
}

function paletteForType (type: FigureSetType | undefined): [string, AvatarColor][] {
  if (!type) return [];

  return Object.entries(catalog.palettes[String(type.paletteid)] || {})
    .sort((left, right) => left[1].index - right[1].index);
}

function defaultOutfit (forGender: Gender): Record<string, OutfitPart> {
  const nextParts: Record<string, OutfitPart> = {};

  if (forGender === "M") {
    for (const partString of avatar.value.figure.split(".")) {
      const [type, setId, ...colorIds] = partString.split("-");
      if (!type || !setId || !colorIds.length) continue;

      nextParts[type] = { setId, colorIds };
    }

    return nextParts;
  }

  for (const type of figureTypes) {
    const part = catalog.defaults[forGender][type.type];
    if (!part?.set || !part.color) continue;

    nextParts[type.type] = {
      setId: String(part.set),
      colorIds: String(part.color).split("-").filter(Boolean)
    };
  }

  return nextParts;
}

selectedParts.value = defaultOutfit(gender.value);

const availableSets = computed(() => {
  if (!activeCategory.value) return [];

  const query = search.value.trim().toLowerCase();

  return Object.entries(activeCategory.value.sets)
    .filter(([setId, set]) => {
      const genderAvailable = set.gender === "U" || set.gender === gender.value;
      return set.selectable === 1 && genderAvailable && (!query || setId.includes(query));
    })
    .map(([setId, set]) => ({ setId, set }));
});

const availableColors = computed(() => {
  if (activeSet.value?.colorable !== 1) return [];

  return paletteForType(activeCategory.value).filter(([, color]) => color.selectable === 1);
});

const figure = computed(() => Object.entries(selectedParts.value)
  .map(([type, part]) => {
    if (!part?.setId || !part.colorIds.length) return "";
    return `${type}-${part.setId}-${part.colorIds.join("-")}`;
  })
  .filter(Boolean)
  .join("."));

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
  const set = type?.sets[setId];
  if (!type || !set || set.selectable !== 1 || (set.gender !== "U" && set.gender !== gender.value)) return;

  const previous = selectedParts.value[type.type];
  const retainedColors = previous?.colorIds.length ? previous.colorIds : colorsForType(type.type);
  const palette = paletteForType(type);
  const fallbackColor = palette.find(([, color]) => color.selectable === 1)?.[0] ?? palette[0]?.[0];
  const colorIds = retainedColors.length ? retainedColors : fallbackColor ? [fallbackColor] : [];

  selectedParts.value = {
    ...selectedParts.value,
    [type.type]: { setId, colorIds }
  };
}

function selectColor (colorId: string) {
  const part = selectedParts.value[activeType.value];
  if (!part || activeSet.value?.colorable !== 1) return;

  selectedParts.value = {
    ...selectedParts.value,
    [activeType.value]: { ...part, colorIds: [colorId] }
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
    const candidates = Object.entries(type.sets).filter(([, set]) =>
      set.selectable === 1 && (set.gender === "U" || set.gender === gender.value)
    );
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!candidate) continue;

    const [setId, set] = candidate;
    const palette = paletteForType(type);
    const selectableColors = palette.filter(([, color]) => color.selectable === 1);
    const randomColor = selectableColors[Math.floor(Math.random() * selectableColors.length)]?.[0];
    const color = set.colorable === 1 ? randomColor : (colorsForType(type.type)[0] ?? palette[0]?.[0]);

    if (color) nextParts[type.type] = { setId, colorIds: [color] };
  }

  selectedParts.value = nextParts;
}

function importOutfit () {
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
    if (!metadata || !metadata.sets[setId] || !colorIds.length) {
      importError.value = `Figure part "${type}" is not in the AvatarGenerate catalog.`;
      return;
    }

    parsedParts[type] = { setId, colorIds };
  }

  gender.value = importedGender === "F" ? "F" : "M";
  selectedParts.value = parsedParts;
  const firstType = tokens[0]?.split("-")[0];
  if (firstType) activeType.value = firstType;
  importError.value = "";
}

async function saveAvatar () {
  const twitchLogin = user.value?.twitchLogin;
  if (!twitchLogin || saveState.value === "saving") return;

  const figureToSave = figure.value;
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
    saveState.value = figure.value === figureToSave && gender.value === genderToSave ? "saved" : "idle";
  }
  catch {
    saveState.value = figure.value === figureToSave && gender.value === genderToSave ? "error" : "idle";
  }
}

function categoryName (type: string): string {
  return categoryNames[type] || type.toUpperCase();
}

function categoryIcon (type: string): string {
  return `/avatar-generator/icons/${categoryIcons[type] || "body.png"}`;
}

function genderIcon (value: Gender): string {
  return `/avatar-generator/icons/${genderIcons[value]}`;
}

function itemPreviewUrl (type: string, setId: string): string {
  const figureType = figureTypeByCode.get(type);
  const set = figureType?.sets[setId];
  if (!figureType || !set) return "";

  const palette = paletteForType(figureType);
  const paletteIds = new Set(palette.map(([id]) => id));
  const currentColors = selectedParts.value[type]?.colorIds.length ? selectedParts.value[type].colorIds : colorsForType(type);
  const validCurrentColors = currentColors.filter(colorId => paletteIds.has(colorId));
  const fallbackColor = palette.find(([, color]) => color.selectable === 1)?.[0];
  const colorIds = set.colorable === 1 ? (validCurrentColors.length ? validCurrentColors : fallbackColor ? [fallbackColor] : []) : [];
  const figurePart = colorIds.length ? `${type}-${setId}-${colorIds.join("-")}` : `${type}-${setId}`;
  const selectedHead = selectedParts.value.hd;
  const defaultHead = catalog.defaults[gender.value].hd;
  const headSetId = selectedHead?.setId || String(defaultHead?.set || "");
  const headColorIds = selectedHead?.colorIds.length ? selectedHead.colorIds : String(defaultHead?.color || "").split("-").filter(Boolean);
  const headPart = headSetId && headColorIds.length ? `hd-${headSetId}-${headColorIds.join("-")}` : "";
  const previewFigure = type !== "hd" && headPart ? `${headPart}.${figurePart}` : figurePart;

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
          <UButton :color="gender === 'M' ? 'primary' : 'neutral'" :variant="gender === 'M' ? 'solid' : 'outline'" :aria-pressed="gender === 'M'" @click="changeGender('M')">
            <img :src="genderIcon('M')" alt="" class="size-5 shrink-0 object-contain">Male
          </UButton>
          <UButton :color="gender === 'F' ? 'primary' : 'neutral'" :variant="gender === 'F' ? 'solid' : 'outline'" :aria-pressed="gender === 'F'" @click="changeGender('F')">
            <img :src="genderIcon('F')" alt="" class="size-5 shrink-0 object-contain">Female
          </UButton>
        </div>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <UCard variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
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
            <nav class="flex gap-2 overflow-x-auto border-b border-default p-3 xl:flex-col xl:overflow-x-visible xl:border-b-0 xl:border-r" aria-label="Outfit categories">
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
                  {{ Object.values(type.sets).filter(set => set.selectable === 1 && (set.gender === 'U' || set.gender === gender)).length }}
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
                      class="max-h-28 max-w-full object-contain self-center"
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
                    {{ activeSet?.colorable === 1 ? `${availableColors.length} selectable` : 'Catalog color' }}
                  </UBadge>
                </div>
                <div v-if="availableColors.length" class="grid max-h-32 grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-2 overflow-y-auto p-0.5" aria-label="Available colors">
                  <UButton
                    v-for="[colorId, color] in availableColors"
                    :key="colorId"
                    class="size-7 min-w-7 rounded-none p-0 ring-1 ring-inset ring-white/20"
                    :class="activePart?.colorIds.includes(colorId) ? 'ring-2 ring-primary ring-offset-2 ring-offset-default' : ''"
                    :style="{ backgroundColor: `#${color.hex}` }"
                    type="button"
                    :aria-label="`Color ${color.hex}, ID ${colorId}`"
                    :aria-pressed="activePart?.colorIds.includes(colorId) || false"
                    @click="selectColor(colorId)"
                  />
                </div>
                <p v-else class="text-xs text-muted">Select a colorable set to view its palette.</p>
              </div>
            </div>
          </div>
        </UCard>

        <aside class="grid min-w-0 content-start gap-4" aria-label="Avatar preview and controls">
          <UCard variant="outline" class="min-w-0">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-[10px] font-semibold tracking-widest text-primary">HABBO IMAGING</p>
                  <h2 class="mt-1 text-lg font-semibold text-highlighted">Outfit preview</h2>
                </div>
                <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-rotate-3d" @click="previewDirection = (previewDirection + 1) % 8">
                  Turn · {{ previewDirection }}
                </UButton>
              </div>
            </template>

            <div class="relative grid min-h-72 place-items-center overflow-hidden rounded-md bg-neutral-950 p-4">
              <img
                v-if="!previewFailed"
                :key="previewUrl"
                class="relative z-10 max-h-72 max-w-full object-contain"
                :src="previewUrl"
                :alt="`${gender === 'M' ? 'Male' : 'Female'} Habbo avatar preview`"
                loading="eager"
                @error="previewFailed = true"
              >
              <UAlert v-else color="warning" variant="subtle" title="Preview unavailable" description="Habbo Imaging did not return this outfit. You can still save it." icon="i-lucide-image-off" />
              <UBadge class="absolute bottom-3 right-3 z-20" color="neutral" variant="subtle">{{ gender }} / DIR {{ previewDirection }}</UBadge>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <UButton color="secondary" variant="soft" icon="i-lucide-shuffle" @click="randomizeOutfit">Randomize</UButton>
              <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="selectedParts = defaultOutfit(gender)">Reset</UButton>
              <UButton color="primary" icon="i-lucide-save" :loading="saveState === 'saving'" :disabled="!user?.twitchLogin || saveState === 'saving'" @click="saveAvatar">Save avatar</UButton>
              <UBadge class="ml-auto" color="neutral" variant="subtle">{{ outfitCount }} parts</UBadge>
            </div>
            <UAlert v-if="saveState === 'saved'" class="mt-3" color="success" variant="subtle" title="Avatar saved" description="Your current avatar has been saved to your account." icon="i-lucide-circle-check" />
            <UAlert v-else-if="saveState === 'error'" class="mt-3" color="error" variant="subtle" title="Could not save avatar" description="Please try again." icon="i-lucide-circle-alert" />
          </UCard>

          <UCard variant="outline" class="min-w-0">
            <template #header>
              <div class="flex items-center gap-2"><UIcon name="i-lucide-download" class="size-4 text-primary" /><h2 class="text-sm font-semibold text-highlighted">Import an existing figure</h2></div>
            </template>
            <div class="grid gap-3">
              <UTextarea id="import-figure" v-model="importText" :rows="2" placeholder="hd-3092-2.hr-831-61.ch-3438-110-1408&gender=M" aria-label="Paste a Habbo figure string" />
              <UAlert v-if="importError" color="error" variant="subtle" :description="importError" />
              <UButton color="primary" icon="i-lucide-download" @click="importOutfit">Import outfit</UButton>
            </div>
          </UCard>
        </aside>
      </div>
    </div>
  </main>
</template>
