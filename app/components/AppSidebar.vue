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
      class: "max-sm:text-xs",
      onSelect: closeSidebar
    }
  ],
  [
    {
      label: "Viewer",
      type: "label",
      class: "uppercase max-sm:text-[11px]"
    },
    {
      label: "My Avatar",
      to: "/dashboard/avatar",
      icon: "pixelarticons:shirt",
      class: "max-sm:text-xs",
      onSelect: closeSidebar
    }
  ],
  [
    {
      label: "Streamer",
      type: "label",
      class: "uppercase max-sm:text-[11px]"
    },
    {
      label: "OBS overlay",
      to: "/dashboard/obs-overlay",
      icon: "pixelarticons:monitor",
      class: "max-sm:text-xs",
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
            <p class="truncate text-sm max-sm:text-xs font-semibold text-default">{{ user?.twitchDisplay || user?.twitchLogin || 'Twitch user' }}</p>
            <p v-if="user?.twitchLogin" class="truncate text-xs max-sm:text-[11px] text-muted">@{{ user.twitchLogin }}</p>
          </div>
          <UButton class="max-sm:text-xs" color="neutral" variant="ghost" icon="pixelarticons:logout" @click="logout">
            Log out
          </UButton>
        </div>
      </div>
    </template>
  </USidebar>
</template>
