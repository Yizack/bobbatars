<script setup lang="ts">
const sidebarOpen = ref(true);
</script>

<template>
  <div class="flex min-h-dvh flex-1 bg-neutral-950">
    <StudioSidebar v-model:open="sidebarOpen" />
    <div class="min-w-0 flex-1 flex flex-col overflow-hidden lg:peer-data-[variant=floating]:my-4 peer-data-[variant=inset]:m-4 lg:peer-data-[variant=inset]:not-peer-data-[collapsible=offcanvas]:ms-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:shadow-sm peer-data-[variant=inset]:ring peer-data-[variant=inset]:ring-default bg-default">
      <header class="flex shrink-0 items-center gap-2 border-b border-default px-4 py-2 lg:hidden">
        <UButton
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-menu"
          aria-label="Open dashboard navigation"
          :aria-expanded="sidebarOpen"
          @click="sidebarOpen = !sidebarOpen"
        />
        <span class="text-sm font-semibold text-highlighted">Bobbatars</span>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <slot />
      </div>
    </div>
  </div>
</template>
