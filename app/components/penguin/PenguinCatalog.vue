<script setup lang="ts">
import { useInfiniteScroll } from "@vueuse/core";

const props = defineProps<{
  items: PenguinCatalogItem[];
  categories: readonly PenguinClothingCategory[];
}>();
const { items, categories } = toRefs(props);
const activeType = defineModel<number>("activeType", { required: true });
const search = defineModel<string>("search", { required: true });
const selectedByType = defineModel<Record<number, number>>("selectedByType", { required: true });

const availableItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return items.value
    .filter((item) => {
      if (item.type !== activeType.value) return false;
      if (!query) return true;
      return `${item.label} ${item.prompt} ${item.paper_item_id}`.toLocaleLowerCase().includes(query);
    })
    .sort((first, second) =>
      (first.label || first.prompt).localeCompare(second.label || second.prompt)
      || first.paper_item_id - second.paper_item_id
    );
});
const activeCategory = computed(() => categories.value.find(category => category.type === activeType.value));
const selectedItemId = computed(() => selectedByType.value[activeType.value]);
const itemCounts = computed(() => new Map(
  categories.value.map(category => [
    category.type,
    items.value.filter(item => item.type === category.type).length
  ] as const)
));
const categoryIcons: Record<number, string> = {
  2: "pixelarticons:crown",
  3: "pixelarticons:sunglasses",
  4: "pixelarticons:heart",
  5: "pixelarticons:shirt",
  6: "pixelarticons:hand",
  7: "pixelarticons:arrow-down"
};
const visibleItemCount = ref(18);
const itemsContainer = ref<HTMLElement | null>(null);
const hasSearch = computed(() => Boolean(search.value.trim()));
const visibleItems = computed(() => hasSearch.value ? availableItems.value : availableItems.value.slice(0, visibleItemCount.value));

useInfiniteScroll(
  itemsContainer,
  () => {
    visibleItemCount.value = Math.min(visibleItemCount.value + 18, availableItems.value.length);
  },
  {
    distance: 160,
    canLoadMore: () => !hasSearch.value && visibleItemCount.value < availableItems.value.length
  }
);

watch([availableItems, activeType], () => {
  visibleItemCount.value = 18;
  if (itemsContainer.value) itemsContainer.value.scrollTop = 0;
}, { flush: "post" });

function itemLabel (item: PenguinCatalogItem): string {
  return item.label || item.prompt || `Item ${item.paper_item_id}`;
}

function selectItem (item: PenguinCatalogItem): void {
  const next: Record<number, number> = {};
  for (const [type, id] of Object.entries(selectedByType.value)) {
    if (Number(type) !== item.type) next[Number(type)] = id;
  }
  if (selectedByType.value[item.type] !== item.paper_item_id) next[item.type] = item.paper_item_id;
  selectedByType.value = next;
}

function removeActiveItem (): void {
  const next: Record<number, number> = {};
  for (const [type, id] of Object.entries(selectedByType.value)) {
    if (Number(type) !== activeType.value) next[Number(type)] = id;
  }
  selectedByType.value = next;
}
</script>

<template>
  <UCard variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-[10px] font-semibold tracking-widest text-primary">CLUB PENGUIN CATALOG</p>
          <h2 class="mt-1 text-lg font-semibold text-highlighted">Clothing</h2>
        </div>
        <UBadge color="neutral" variant="subtle" size="sm">{{ availableItems.length }} items</UBadge>
      </div>
    </template>

    <div class="grid xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav
        class="grid content-start grid-cols-2 gap-2 overflow-x-auto border-b border-default p-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-1 xl:overflow-x-visible xl:border-b-0 xl:border-r"
        aria-label="Penguin clothing categories"
      >
        <UButton
          v-for="category in categories"
          :key="category.type"
          :color="activeType === category.type ? 'primary' : 'neutral'"
          :variant="activeType === category.type ? 'soft' : 'ghost'"
          :aria-pressed="activeType === category.type"
          class="min-w-36 shrink-0 justify-start xl:w-full"
          @click="activeType = category.type; search = ''"
        >
          <UIcon :name="categoryIcons[category.type] || 'pixelarticons:shirt'" class="size-8 shrink-0" />
          <span class="truncate">{{ category.label }}</span>
          <UBadge class="ml-auto" color="neutral" variant="subtle" size="xs">
            {{ itemCounts.get(category.type) ?? 0 }}
          </UBadge>
        </UButton>
      </nav>

      <div class="min-w-0 space-y-4 p-4">
        <div class="flex items-center gap-2">
          <UInput
            v-model="search"
            type="search"
            icon="pixelarticons:search"
            class="min-w-0 flex-1"
            :aria-label="`Filter ${activeCategory?.label ?? 'clothing'} by name or ID`"
            placeholder="Filter by name or ID"
          />
          <UButton
            v-if="selectedItemId !== undefined"
            type="button"
            color="error"
            variant="ghost"
            icon="pixelarticons:close"
            @click="removeActiveItem"
          >
            Remove
          </UButton>
        </div>

        <p v-if="selectedItemId !== undefined" class="text-right text-xs text-muted">
          Selected #{{ selectedItemId }}
        </p>

        <div ref="itemsContainer" class="grid max-h-[34rem] grid-cols-3 content-start gap-2 overflow-y-auto" aria-label="Catalog items">
          <button
            v-for="item in visibleItems"
            :key="item.paper_item_id"
            type="button"
            class="grid min-w-0 gap-2 rounded-md border p-3 text-left transition-colors"
            :class="selectedItemId === item.paper_item_id ? 'border-primary bg-primary/10' : 'border-default hover:border-primary/50'"
            :aria-pressed="selectedItemId === item.paper_item_id"
            @click="selectItem(item)"
          >
            <span class="flex h-24 w-full items-center justify-center overflow-hidden rounded bg-neutral-950">
              <PenguinClothingThumbnail :item-id="item.paper_item_id" :label="itemLabel(item)" />
            </span>
            <span class="grid min-w-0 gap-1">
              <span class="line-clamp-2 text-sm font-medium text-highlighted">{{ itemLabel(item) }}</span>
              <span class="text-xs text-muted">#{{ item.paper_item_id }}</span>
            </span>
          </button>
        </div>

        <p v-if="!visibleItems.length" class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted">
          No items match your search.
        </p>
        <p v-else-if="!hasSearch && visibleItemCount < availableItems.length" class="text-xs text-muted">
          Scroll to load more items.
        </p>
      </div>
    </div>
  </UCard>
</template>
