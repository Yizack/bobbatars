<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { useMediaQuery } from "@vueuse/core";

const sidebarOpen = defineModel<boolean>("open", { default: true });
const isMobile = useMediaQuery("(max-width: 1023px)");

function closeSidebar () {
  sidebarOpen.value = isMobile.value ? false : sidebarOpen.value;
}

const navigationItems = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: "Overview",
      to: "/dashboard",
      icon: "pixelarticons:home",
      onSelect: closeSidebar
    }
  ],
  [
    {
      label: "Viewer",
      type: "label",
      class: "uppercase"
    },
    {
      label: "My Avatar",
      to: "/dashboard/avatar",
      icon: "pixelarticons:shirt",
      onSelect: closeSidebar
    }
  ],
  [
    {
      label: "Streamer",
      type: "label",
      class: "uppercase"
    },
    {
      label: "OBS overlay",
      to: "/dashboard/obs-overlay",
      icon: "pixelarticons:monitor",
      onSelect: closeSidebar
    }
  ]
]);
const { clear, loggedIn, user } = useUserSession();

async function logout () {
  await clear();
  await navigateTo("/");
}
</script>

<template>
  <USidebar
    v-model:open="sidebarOpen"
    collapsible="offcanvas"
    variant="inset"
    title="Bobbatars"
    :menu="{ title: 'Workspace navigation' }"
    :ui="{
      container: 'h-full',
    }"
  >
    <UNavigationMenu
      :items="navigationItems"
      orientation="vertical"
      variant="pill"
      aria-label="Workspace navigation"
      class="w-full"
    />

    <template #footer>
      <div class="grid w-full gap-3">
        <div v-if="loggedIn" class="flex min-w-0 items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-default">{{ user?.twitchDisplay || user?.twitchLogin || 'Twitch user' }}</p>
            <p v-if="user?.twitchLogin" class="truncate text-xs text-muted">@{{ user.twitchLogin }}</p>
          </div>
          <UButton color="neutral" variant="ghost" icon="pixelarticons:logout" @click="logout">
            Log out
          </UButton>
        </div>
      </div>
    </template>
  </USidebar>
</template>
