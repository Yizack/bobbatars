<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '#imports'
import { withQuery } from 'ufo'
import avatarCatalogJson from '../data/avatar-generator/catalog.json'
import { DEFAULT_MALE_OUTFIT_FIGURE } from '../data/avatar-generator/default-outfit'

const avatarCatalog = avatarCatalogJson as unknown as {
  sourceCommit: string
  palettes: Record<string, Record<string, { selectable: number }>>
  setTypes: Array<{ type: string, sets: Record<string, { selectable: number }> }>
}
const defaultFigure = DEFAULT_MALE_OUTFIT_FIGURE
const defaultFigureString = `${defaultFigure}&gender=M`
const previewUrl = withQuery('https://habbohistory.com/habbo-imaging/avatarimage.webp', {
  head_direction: '4',
  direction: '4',
  size: 'l',
  figure: defaultFigure,
  gender: 'M',
})
const selectableSetCount = avatarCatalog.setTypes.reduce((count, type) =>
  count + Object.values(type.sets).filter(set => set.selectable === 1).length, 0,
)
const previewUnavailable = ref(false)

useHead({
  title: 'Habbo Outfit Studio',
})
</script>

<template>
  <div class="min-h-screen bg-default text-default md:flex">
    <StudioSidebar />

    <main id="overview" class="min-w-0 flex-1">
      <header class="flex h-14 items-center justify-between border-b border-default px-4 sm:px-8">
        <div class="flex items-center gap-2 text-xs text-muted"><span>WORKSPACE</span><span aria-hidden="true">/</span><strong class="text-default">OVERVIEW</strong></div>
        <UBadge color="success" variant="subtle" size="sm" dot>LOCAL BUILD</UBadge>
      </header>

      <div class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
          <div class="max-w-2xl">
            <UBadge color="primary" variant="soft" size="sm">AVATARGENERATE / R63B</UBadge>
            <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">Habbo Outfit Studio</h1>
            <p class="mt-2 text-sm leading-6 text-muted">Build a look from the original figure catalog and export its Habbo string.</p>
          </div>
          <UButton to="/dashboard/avatar-generator" color="primary" size="lg" icon="i-lucide-shirt" trailing-icon="i-lucide-arrow-up-right">
            Open Avatar Studio
          </UButton>
        </section>

        <section class="grid gap-3 sm:grid-cols-3" aria-label="Workspace status">
          <UCard v-for="stat in [
            { label: 'FIGURE TYPES', value: `${avatarCatalog.setTypes.length} categories`, detail: 'Head, hair, clothes, accessories', icon: 'i-lucide-layout-grid' },
            { label: 'SELECTABLE SETS', value: `${selectableSetCount} outfit items`, detail: 'Filtered by source metadata', icon: 'i-lucide-shirt' },
            { label: 'HOTEL CONNECTION', value: 'Not required', detail: 'Outfit strings generated locally', icon: 'i-lucide-unplug' },
          ]" :key="stat.label" variant="outline" class="min-w-0">
            <div class="flex items-start justify-between gap-3">
              <div class="grid gap-2">
                <span class="text-[10px] font-semibold tracking-widest text-muted">{{ stat.label }}</span>
                <strong class="text-lg font-semibold text-highlighted">{{ stat.value }}</strong>
                <span class="text-xs text-muted">{{ stat.detail }}</span>
              </div>
              <UIcon :name="stat.icon" class="size-5 text-primary" />
            </div>
          </UCard>
        </section>

        <section class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]" aria-label="Outfit workspace">
          <UCard variant="outline" class="min-w-0" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-[10px] font-semibold tracking-widest text-primary">STARTER LOOK / MALE</p>
                  <h2 class="mt-1 text-lg font-semibold text-highlighted">Avatar preview</h2>
                </div>
                <UBadge color="success" variant="subtle" size="sm" dot>HABBO IMAGING</UBadge>
              </div>
            </template>

            <div class="relative grid min-h-80 place-items-center overflow-hidden rounded-md bg-neutral-950 p-6">
              <img v-if="!previewUnavailable" class="max-h-72 max-w-full object-contain" :src="previewUrl" alt="AvatarGenerate default male outfit" @error="previewUnavailable = true">
              <UAlert v-else color="warning" variant="subtle" title="Preview unavailable" description="Habbo Imaging did not return this avatar. The editor and figure string remain available." icon="i-lucide-image-off" />
            </div>

            <div class="mt-4 grid gap-2">
              <span class="text-[10px] font-semibold tracking-widest text-muted">FIGURE STRING</span>
              <UTextarea :model-value="defaultFigureString" readonly :rows="2" aria-label="Default Habbo figure string" />
            </div>
          </UCard>

          <UCard variant="outline" class="min-w-0">
            <template #header>
              <UBadge color="primary" variant="soft" size="sm">YOUR OUTFIT</UBadge>
              <h2 class="mt-2 text-lg font-semibold text-highlighted">Start with the figure code</h2>
              <p class="mt-1 text-sm leading-5 text-muted">The editor updates the code as you choose each figure set and color.</p>
            </template>
            <div class="grid gap-4">
              <div class="flex items-start gap-3 text-sm text-muted">
                <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                <span>13 figure types from AvatarGenerate</span>
              </div>
              <div class="flex items-start gap-3 text-sm text-muted">
                <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                <span>{{ selectableSetCount }} selectable outfit sets</span>
              </div>
              <div class="flex items-start gap-3 text-sm text-muted">
                <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
                <span>Import/export with the gender suffix</span>
              </div>
              <UButton to="/dashboard/avatar-generator" color="primary" icon="i-lucide-shirt" trailing-icon="i-lucide-arrow-right" block>
                Create an outfit
              </UButton>
            </div>
          </UCard>
        </section>

        <USeparator label="CATALOG SOURCE" />
        <p class="text-xs text-muted">AvatarGenerate R63B · pinned source <a class="text-primary underline underline-offset-4" :href="`https://github.com/synt4xy/avatargenerate/tree/${avatarCatalog.sourceCommit}`">{{ avatarCatalog.sourceCommit.slice(0, 7) }}</a> · external preview by Habbo Imaging</p>
      </div>
    </main>
  </div>
</template>
