<script setup lang="ts">
import { withQuery } from "ufo";
import habboCatalogJson from "../../data/avatar-generator/habbo-catalog.json";
import penguinCatalogJson from "../../data/avatar-generator/penguin-catalog.json";
import { DEFAULT_OUTFIT_FIGURES } from "../../data/avatar-generator/habbo-default-outfit";

definePageMeta({ layout: "dashboard", middleware: "authenticated" });

interface HabboFigureLookup {
  queued?: boolean;
  notFound?: boolean;
  message?: string | null;
  name?: string | null;
  figureString?: string | null;
}

const catalog = habboCatalogJson as unknown as AvatarCatalog;
const penguinCatalog = penguinCatalogJson as PenguinCatalogItem[];
const clothingCategories: PenguinClothingCategory[] = CLOTHING_PARTS.map(({ type, label }) => ({ type, label }));
const clothingCategoryTypes = new Set<number>(CLOTHING_PARTS.map(part => part.type));
const wearableItems = penguinCatalog.filter(item => clothingCategoryTypes.has(item.type));
const genderIcons: Record<AvatarGender, string> = { M: "male.png", F: "female.png" };
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

const defaultHabboAvatar: AvatarPreviewState = {
  avatarType: "habbo",
  gender: "M",
  figure: DEFAULT_OUTFIT_FIGURES.M,
  effect: null
};
const defaultPenguinAvatar: PenguinAppearance = {
  head: null,
  face: null,
  neck: null,
  body: null,
  hand: null,
  feet: null,
  color: "#003366"
};

const { data: avatar } = await useFetch<AvatarPreviewState>(`/api/avatars/${user.value.twitchLogin}`, {
  default: () => defaultHabboAvatar
});

const avatarType = ref<AvatarType>(avatar.value.avatarType);
const gender = ref<AvatarGender>(avatar.value.avatarType === "habbo" ? avatar.value.gender : "M");
const selectedEffect = ref<number | null>(avatar.value.avatarType === "habbo" ? avatar.value.effect : null);
const typeLoadError = ref("");
const typeLoading = ref(false);
const activeFigureType = ref("hr");
const activeFigureTypeNumber = ref(clothingCategories[0]?.type ?? 2);
const selectedParts = ref<Record<string, OutfitPart>>({});
const savedParts = ref<Record<string, OutfitPart>>({});
const selectedByType = ref<Record<number, number>>({});
const penguinColor = ref(defaultPenguinAvatar.color);
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
const penguinSaveState = ref<AvatarSaveState>("idle");
const penguinSaveError = ref("");
const previewDirection = ref(4);
const previewAction = ref<AvatarPreviewAction>("std");
const penguinDirection = ref<PenguinDirection>(4);
const penguinAction = ref<PenguinAction>("std");
const mobilePreviewOpen = ref(false);

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
const penguinAppearance = computed<PenguinAppearance>(() => ({
  ...clothingPartsFromSelection(selectedByType.value),
  color: penguinColor.value
}));
const penguinOutfitCount = computed(() => orderedClothingParts(penguinAppearance.value).length);
const loadedAvatarTypes = new Set<AvatarType>([avatar.value.avatarType]);

if (avatar.value.avatarType === "habbo") {
  selectedParts.value = parseFigureString(avatar.value.figure);
  savedParts.value = copyOutfitParts(selectedParts.value);
  gender.value = avatar.value.gender;
  selectedEffect.value = avatar.value.effect;
}
else {
  const savedPenguin: PenguinAppearance = {
    ...defaultPenguinAvatar,
    head: avatar.value.head ?? null,
    face: avatar.value.face ?? null,
    neck: avatar.value.neck ?? null,
    body: avatar.value.body ?? null,
    hand: avatar.value.hand ?? null,
    feet: avatar.value.feet ?? null,
    color: avatar.value.color ?? defaultPenguinAvatar.color
  };
  selectedByType.value = clothingSelectionFromParts(savedPenguin);
  penguinColor.value = savedPenguin.color;
}

function defaultOutfit (forGender: AvatarGender): Record<string, OutfitPart> {
  return parseFigureString(DEFAULT_OUTFIT_FIGURES[forGender]);
}

const figure = computed(() => figureForParts(selectedParts.value));
const presetOutfit = computed<AvatarPresetOutfit>(() => {
  if (avatarType.value === "habbo") {
    return { avatarType: "habbo", outfit: { figure: figure.value, gender: gender.value, effect: selectedEffect.value } };
  }
  return { avatarType: "penguin", outfit: penguinAppearance.value };
});

const previewUrl = computed(() => {
  let headDirection = previewDirection.value;
  if (previewAction.value === "dance3" || previewAction.value === "dance4") {
    headDirection = previewDanceHeadDirectionOverrides[previewDirection.value] ?? previewDirection.value;
  }

  return withQuery(habboImagingUrl, {
    head_direction: String(headDirection),
    direction: String(previewDirection.value),
    size: "fl",
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

watch([selectedByType, penguinColor], () => {
  if (penguinSaveState.value !== "saving") penguinSaveState.value = "idle";
}, { deep: true });

async function loadAvatarTypeData (type: AvatarType): Promise<void> {
  const twitchLogin = user.value?.twitchLogin;
  if (!twitchLogin) throw new Error("User not authenticated.");

  const result = await $fetch<AvatarPreviewState>(`/api/avatars/${encodeURIComponent(twitchLogin)}`, {
    query: { type }
  });
  if (result.avatarType !== type) throw new Error(`The server returned an unexpected ${type} avatar.`);

  if (result.avatarType === "habbo") {
    const parts = parseFigureString(result.figure);
    selectedParts.value = parts;
    savedParts.value = copyOutfitParts(parts);
    gender.value = result.gender;
    selectedEffect.value = result.effect;
  }
  else {
    const appearance: PenguinAppearance = {
      head: result.head,
      face: result.face,
      neck: result.neck,
      body: result.body,
      hand: result.hand,
      feet: result.feet,
      color: result.color
    };
    selectedByType.value = clothingSelectionFromParts(appearance);
    penguinColor.value = appearance.color;
  }
  loadedAvatarTypes.add(type);
}

async function selectAvatarType (type: AvatarType): Promise<void> {
  if (type === avatarType.value || typeLoading.value) return;

  typeLoading.value = true;
  typeLoadError.value = "";
  try {
    if (!loadedAvatarTypes.has(type)) await loadAvatarTypeData(type);
    avatarType.value = type;
    search.value = "";
  }
  catch (error) {
    typeLoadError.value = error instanceof Error ? error.message : "Could not load this avatar type.";
  }
  finally {
    typeLoading.value = false;
  }
}

function loadPreset (preset: AvatarPreset) {
  if (preset.avatarType === "habbo") {
    selectedParts.value = parseFigureString(preset.outfit.figure);
    gender.value = preset.outfit.gender;
    selectedEffect.value = preset.outfit.effect;
    importError.value = "";
  }
  else {
    selectedByType.value = clothingSelectionFromParts(preset.outfit);
    penguinColor.value = preset.outfit.color;
  }
}

function changeGender (value: AvatarGender) {
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

function randomizePenguinOutfit (): void {
  const next: Record<number, number> = {};
  for (const category of clothingCategories) {
    const candidates = wearableItems.filter(item => item.type === category.type);
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (candidate) next[category.type] = candidate.paper_item_id;
  }
  selectedByType.value = next;
}

function resetPenguinOutfit (): void {
  selectedByType.value = {};
  penguinColor.value = defaultPenguinAvatar.color;
  penguinAction.value = "std";
  penguinDirection.value = 4;
  activeFigureTypeNumber.value = clothingCategories[0]?.type ?? 2;
  search.value = "";
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
  if (firstType) activeFigureType.value = firstType;
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
        avatarType: "habbo",
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

async function savePenguinAvatar (): Promise<void> {
  const twitchLogin = user.value?.twitchLogin;
  if (!twitchLogin || penguinSaveState.value === "saving") return;

  const appearanceToSave = { ...penguinAppearance.value };
  penguinSaveState.value = "saving";
  penguinSaveError.value = "";
  try {
    await $fetch(`/api/avatars/${encodeURIComponent(twitchLogin)}`, {
      method: "POST",
      body: { avatarType: "penguin", ...appearanceToSave }
    });
    const unchanged = JSON.stringify(penguinAppearance.value) === JSON.stringify(appearanceToSave);
    penguinSaveState.value = unchanged ? "saved" : "idle";
  }
  catch (error) {
    penguinSaveError.value = error instanceof Error ? error.message : "Could not save your penguin avatar.";
    const unchanged = JSON.stringify(penguinAppearance.value) === JSON.stringify(appearanceToSave);
    penguinSaveState.value = unchanged ? "error" : "idle";
  }
}

function genderIcon (value: AvatarGender): string {
  return `/avatar-generator/icons/${genderIcons[value]}`;
}

useHead({ title: "Avatar | Bobbatars" });
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <h1 id="page-title" class="mt-3 text-3xl max-sm:text-2xl font-semibold tracking-normal text-highlighted sm:text-4xl">My Avatar</h1>
          <p class="mt-2 text-sm max-sm:text-xs leading-6 text-muted">Choose your avatar type and customize it with items from the matching catalog.</p>
        </div>
        <div class="grid gap-2">
          <div class="flex gap-2" role="group" aria-label="Avatar type">
            <UButton
              class="max-sm:text-xs"
              color="primary"
              :variant="avatarType === 'habbo' ? 'solid' : 'subtle'"
              :aria-pressed="avatarType === 'habbo'"
              :loading="typeLoading"
              :disabled="typeLoading"
              @click="selectAvatarType('habbo')"
            >
              Habbo
            </UButton>
            <UButton
              class="max-sm:text-xs"
              color="info"
              :variant="avatarType === 'penguin' ? 'solid' : 'subtle'"
              :aria-pressed="avatarType === 'penguin'"
              :loading="typeLoading"
              :disabled="typeLoading"
              @click="selectAvatarType('penguin')"
            >
              Club Penguin
            </UButton>
          </div>
          <div v-if="avatarType === 'habbo'" class="flex gap-2" role="group" aria-label="Avatar gender">
            <UButton
              class="max-sm:text-xs"
              color="neutral"
              :variant="gender === 'M' ? 'subtle' : 'outline'"
              :aria-pressed="gender === 'M'"
              @click="changeGender('M')"
            >
              <img :src="genderIcon('M')" alt="" class="size-5 shrink-0 object-contain" style="object-position: 0 4px;">Male
            </UButton>
            <UButton
              class="max-sm:text-xs"
              color="neutral"
              :variant="gender === 'F' ? 'subtle' : 'outline'"
              :aria-pressed="gender === 'F'"
              @click="changeGender('F')"
            >
              <img :src="genderIcon('F')" alt="" class="size-5 shrink-0 object-contain">Female
            </UButton>
          </div>
        </div>
      </section>

      <UAlert
        v-if="typeLoadError"
        color="error"
        variant="subtle"
        title="Could not load avatar type"
        :description="typeLoadError"
        icon="pixelarticons:alert"
      />

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.8fr)]">
        <div v-if="avatarType === 'habbo'" class="flex flex-col gap-3 order-2 xl:order-1">
          <HabboCatalog
            v-model:active-type="activeFigureType"
            v-model:search="search"
            v-model:selected-parts="selectedParts"
            v-model:selected-effect="selectedEffect"
            :catalog="catalog"
            :gender="gender"
            :saved-parts="savedParts"
          />

          <HabboFigureImport v-model="importText" :error="importError" @import="importOutfit" />
        </div>
        <div v-else class="flex flex-col gap-3 order-2 xl:order-1">
          <PenguinCatalog
            v-model:active-type="activeFigureTypeNumber"
            v-model:search="search"
            v-model:selected-by-type="selectedByType"
            :items="wearableItems"
            :categories="clothingCategories"
          />
        </div>

        <aside class="order-1 flex content-start flex-col gap-3 sm:gap-4" aria-label="Avatar preview and controls">
          <HabboPreview
            v-if="avatarType === 'habbo'"
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
          <PenguinPreview
            v-else
            v-model:color="penguinColor"
            v-model:direction="penguinDirection"
            v-model:action="penguinAction"
            :selected-parts="penguinAppearance"
            :outfit-count="penguinOutfitCount"
            :save-state="penguinSaveState"
            :save-error="penguinSaveError"
            :can-save="Boolean(user?.twitchLogin)"
            @randomize="randomizePenguinOutfit"
            @reset="resetPenguinOutfit"
            @save="savePenguinAvatar"
          />

          <AvatarPresets
            v-if="user"
            :twitch-login="user.twitchLogin"
            :outfit="presetOutfit"
            :disabled="typeLoading || (avatarType === 'habbo' && lookupState === 'loading')"
            @load="loadPreset"
          />

          <HabboLookup
            v-if="avatarType === 'habbo'"
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

      <UModal
        v-model:open="mobilePreviewOpen"
        title="Avatar preview"
        :ui="{
          content: 'w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg',
          header: 'sr-only',
          body: 'p-0 sm:p-0',
        }"
      >
        <UButton
          v-if="avatarType === 'habbo'"
          color="neutral"
          variant="solid"
          class="fixed bottom-5 right-4 z-40 size-20 overflow-hidden rounded-full border-2 border-primary bg-neutral-950 p-0 shadow-lg xl:hidden"
          aria-label="Show avatar preview"
        >
          <HabboPreviewImage :src="previewUrl" />
        </UButton>
        <UButton
          v-else
          color="neutral"
          variant="solid"
          class="fixed bottom-5 right-4 z-40 size-20 overflow-hidden rounded-full border-2 border-primary bg-neutral-950 p-0 shadow-lg xl:hidden"
          aria-label="Show avatar preview"
        >
          <PenguinAvatarCanvas :appearance="penguinAppearance" :direction="penguinDirection" :action="penguinAction" :scale="0.55" animate />
        </UButton>

        <template #content>
          <div class="grid aspect-4/5 place-items-center overflow-hidden bg-neutral-950 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[24px_24px] p-3">
            <HabboPreviewImage v-if="avatarType === 'habbo'" :src="previewUrl" />
            <PenguinAvatarCanvas v-else :appearance="penguinAppearance" :direction="penguinDirection" :action="penguinAction" :scale="2" animate />
          </div>
        </template>
      </UModal>
    </div>
  </main>
</template>
