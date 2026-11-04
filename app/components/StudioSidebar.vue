<script setup lang="ts">
import { computed, navigateTo, useRoute } from "#imports";
import type { NavigationMenuItem } from "@nuxt/ui";

const route = useRoute();
const navigationItems = computed<NavigationMenuItem[][]>(() => [
  [
    {
      label: "Overview",
      to: "/",
      icon: "i-lucide-layout-dashboard",
      active: route.path === "/"
    }
  ],
  [
    {
      label: "Viewer",
      type: "label"
    },
    {
      label: "My Avatar",
      to: "/dashboard/avatar",
      icon: "i-lucide-shirt",
      active: route.path === "/dashboard/avatar"
    }
  ],
  [
    {
      label: "Streamer",
      type: "label"
    },
    {
      label: "OBS overlay",
      to: "/dashboard/obs-overlay",
      icon: "i-lucide-monitor-play",
      active: route.path === "/dashboard/obs-overlay"
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
    collapsible="none"
    variant="inset"
    :ui="{
      container: 'h-full',
    }"
  >
    <template #default>
      <UNavigationMenu
        :items="navigationItems"
        orientation="vertical"
        variant="pill"
        aria-label="Workspace navigation"
        class="w-full"
      />
    </template>

    <template #footer>
      <div class="grid w-full gap-3">
        <div v-if="loggedIn" class="flex min-w-0 items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-default">{{ user?.displayName || user?.login || 'Twitch user' }}</p>
            <p v-if="user?.login" class="truncate text-xs text-muted">@{{ user.login }}</p>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" @click="logout">
            Log out
          </UButton>
        </div>
      </div>
    </template>
  </USidebar>
</template>
