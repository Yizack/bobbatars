<script setup lang="ts">
import { withQuery } from "ufo";
import avatarCatalogJson from "../../data/avatar-generator/catalog.json";
import { DEFAULT_OUTFIT_FIGURES } from "../../data/avatar-generator/default-outfit";
import type { AvatarCatalog as AvatarCatalogData, AvatarLookupState, AvatarPreviewAction, AvatarSaveState, AvatarGender as Gender, HabboHotel, OutfitPart } from "../../types/avatar";
import { avatarImagingUrl, colorsForType, copyOutfitParts, figureForParts, paletteForType, parseFigureString } from "../../utils/avatar";

definePageMeta({ layout: "dashboard" });

interface HabboFigureLookup {
  queued?: boolean;
  notFound?: boolean;
  message?: string | null;
  name?: string | null;
  figureString?: string | null;
}

const catalog = avatarCatalogJson as unknown as AvatarCatalogData;
const genderIcons: Record<Gender, string> = { M: "male.png", F: "female.png" };
const previewDanceHeadDirectionOverrides: Partial<Record<number, number>> = {
  3: 2,
  4: 5,
  6: 5,
  7: 0
};

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

const gender = ref<Gender>(avatar.value.gender);
const selectedEffect = ref<number | null>(avatar.value.effect);
const activeType = ref("hr");
const selectedParts = ref<Record<string, OutfitPart>>({});
const savedParts = ref<Record<string, OutfitPart>>({});
const search = ref("");
const importText = ref("");
const importError = ref("");
const lookupHotel = ref<HabboHotel>("es");
const lookupUsername = ref("");
const lookupState = ref<AvatarLookupState>("idle");
const lookupName = ref("");
const lookupError = ref("");
const lookupQueueMessage = ref("");
const saveState = ref<AvatarSaveState>("idle");
const previewDirection = ref(4);
const previewAction = ref<AvatarPreviewAction>("std");

watch([lookupHotel, lookupUsername], () => {
  if (lookupState.value === "loading") return;
  lookupState.value = "idle";
  lookupName.value = "";
  lookupError.value = "";
  lookupQueueMessage.value = "";
});

const figureTypes = catalog.categories;
const figureTypeByCode = new Map(figureTypes.map(type => [type.type, type]));
const outfitCount = computed(() => Object.keys(selectedParts.value).length);

function defaultOutfit (forGender: Gender): Record<string, OutfitPart> {
  return parseFigureString(DEFAULT_OUTFIT_FIGURES[forGender]);
}

selectedParts.value = parseFigureString(avatar.value.figure);
savedParts.value = copyOutfitParts(selectedParts.value);

const figure = computed(() => figureForParts(selectedParts.value));

const previewUrl = computed(() => {
  let headDirection = previewDirection.value;
  if (previewAction.value === "dance3" || previewAction.value === "dance4") {
    headDirection = previewDanceHeadDirectionOverrides[previewDirection.value] ?? previewDirection.value;
  }

  return withQuery(avatarImagingUrl, {
    head_direction: String(headDirection),
    direction: String(previewDirection.value),
    size: "l",
    figure: figure.value,
    gender: gender.value,
    action: previewAction.value,
    gesture: "std",
    format: "webp",
    rv: 55,
    animv: 28,
    position: "bottom",
    ...(selectedEffect.value === null ? {} : { effect: String(selectedEffect.value) })
  });
});

watch([figure, gender, selectedEffect], () => {
  if (saveState.value !== "saving") saveState.value = "idle";
});

function changeGender (value: Gender) {
  if (gender.value === value) return;
  gender.value = value;
  selectedParts.value = defaultOutfit(value);
  importError.value = "";
}

function resetOutfit () {
  selectedParts.value = defaultOutfit(gender.value);
  selectedEffect.value = null;
}

function randomizeOutfit () {
  const nextParts: Record<string, OutfitPart> = {};

  for (const type of figureTypes) {
    const candidates = type.sets.filter(set => !set.nft && (set.gender === "U" || set.gender === gender.value));
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!candidate) continue;

    const palette = paletteForType(catalog.palettes, type);
    const selectableColors = palette.filter(([, color]) => color.selectable);
    const defaultColors = colorsForType(gender.value, type.type);
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
  let rawFigure = source.split("&")[0] || "";

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

    importText.value = result.figureString;
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
  const effectToSave = selectedEffect.value;
  saveState.value = "saving";

  try {
    await $fetch(`/api/avatars/${encodeURIComponent(twitchLogin)}`, {
      method: "POST",
      body: {
        figure: figureToSave,
        gender: genderToSave,
        effect: effectToSave
      }
    });
    savedParts.value = partsToSave;
    saveState.value = figure.value === figureToSave && gender.value === genderToSave && selectedEffect.value === effectToSave ? "saved" : "idle";
  }
  catch {
    saveState.value = figure.value === figureToSave && gender.value === genderToSave && selectedEffect.value === effectToSave ? "error" : "idle";
  }
}

function genderIcon (value: Gender): string {
  return `/avatar-generator/icons/${genderIcons[value]}`;
}

useHead({ title: "Avatar Studio | Habbo Outfit Studio" });
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">My Avatar</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Choose catalog items, colors, and effects to customize your avatar.</p>
        </div>
        <div class="flex gap-2" role="group" aria-label="Avatar gender">
          <UButton
            color="neutral"
            :variant="gender === 'M' ? 'subtle' : 'outline'"
            :aria-pressed="gender === 'M'"
            @click="changeGender('M')"
          >
            <img :src="genderIcon('M')" alt="" class="size-5 shrink-0 object-contain" style="object-position: 0 4px;">Male
          </UButton>
          <UButton
            color="neutral"
            :variant="gender === 'F' ? 'subtle' : 'outline'"
            :aria-pressed="gender === 'F'"
            @click="changeGender('F')"
          >
            <img :src="genderIcon('F')" alt="" class="size-5 shrink-0 object-contain">Female
          </UButton>
        </div>
      </section>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <div class="flex flex-col gap-3 order-2 xl:order-1">
          <AvatarCatalog
            v-model:active-type="activeType"
            v-model:search="search"
            v-model:selected-parts="selectedParts"
            v-model:selected-effect="selectedEffect"
            :catalog="catalog"
            :gender="gender"
            :saved-parts="savedParts"
          />

          <AvatarFigureImport v-model="importText" :error="importError" @import="importOutfit" />
        </div>

        <aside class="order-1 content-start flex flex-col gap-3 sm:gap-4" aria-label="Avatar preview and controls">
          <AvatarPreview
            v-model:direction="previewDirection"
            v-model:action="previewAction"
            :preview-url="previewUrl"
            :gender="gender"
            :outfit-count="outfitCount"
            :save-state="saveState"
            :can-save="Boolean(user?.twitchLogin)"
            @randomize="randomizeOutfit"
            @reset="resetOutfit"
            @save="saveAvatar"
          />

          <AvatarLookup
            v-model:hotel="lookupHotel"
            v-model:username="lookupUsername"
            :state="lookupState"
            :name="lookupName"
            :error="lookupError"
            :queue-message="lookupQueueMessage"
            @lookup="lookupHabboFigure"
          />
        </aside>
      </div>
    </div>
  </main>
</template>
