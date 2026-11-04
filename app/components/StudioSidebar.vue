<script setup lang="ts">
import { useRoute } from '#imports'

const route = useRoute()
</script>

<template>
  <aside class="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 p-3 max-md:h-auto max-md:w-full max-md:border-r-0 max-md:border-b">
    <NuxtLink class="flex min-h-12 items-center gap-3 px-3 text-default no-underline" to="/" aria-label="Habbo Outfit Studio overview">
      <span class="grid size-8 grid-cols-2 gap-1" aria-hidden="true">
        <span class="bg-primary"></span><span class="bg-secondary"></span>
        <span class="bg-amber-700"></span><span class="bg-emerald-700"></span>
      </span>
      <span class="grid gap-0.5">
        <strong class="text-sm font-bold tracking-widest">ROOMTONE</strong>
        <small class="text-[10px] font-semibold tracking-wider text-muted">OUTFIT STUDIO</small>
      </span>
    </NuxtLink>

    <div class="px-3 pb-2 pt-8 text-[10px] font-semibold tracking-widest text-muted max-md:pt-4">CREATOR WORKSPACE</div>
    <nav class="grid grid-cols-1 gap-1 max-md:grid-cols-2" aria-label="Workspace navigation">
      <UButton to="/" :color="route.path === '/' ? 'primary' : 'neutral'" :variant="route.path === '/' ? 'soft' : 'ghost'" icon="i-lucide-layout-dashboard" class="justify-start">
        Overview
      </UButton>

      <USeparator class="my-2 max-md:col-span-2" label="STUDIO" />
      <UButton disabled color="neutral" variant="ghost" icon="i-lucide-panels-top-left" class="justify-start">
        Room editor <UBadge class="ml-auto" color="neutral" variant="subtle" size="xs">Out of scope</UBadge>
      </UButton>
      <UButton to="/dashboard/avatar-generator" :color="route.path === '/dashboard/avatar-generator' ? 'primary' : 'neutral'" :variant="route.path === '/dashboard/avatar-generator' ? 'soft' : 'ghost'" icon="i-lucide-shirt" class="justify-start">
        Avatar studio
      </UButton>
      <UButton disabled color="neutral" variant="ghost" icon="i-lucide-message-square" class="justify-start">
        Chat simulator <UBadge class="ml-auto" color="neutral" variant="subtle" size="xs">Later</UBadge>
      </UButton>
      <UButton to="/dashboard/obs-overlay" :color="route.path === '/dashboard/obs-overlay' ? 'primary' : 'neutral'" :variant="route.path === '/dashboard/obs-overlay' ? 'soft' : 'ghost'" icon="i-lucide-monitor-play" class="justify-start">
        OBS overlay
      </UButton>
    </nav>

    <div class="mt-auto flex items-center gap-3 border-t border-neutral-800 px-3 py-4 max-md:hidden">
      <UBadge color="success" variant="subtle" size="sm" dot>Local mode</UBadge>
      <span class="text-xs text-muted">No hotel connection</span>
    </div>
  </aside>
</template>
