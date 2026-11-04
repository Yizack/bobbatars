<script setup lang="ts">
import { navigateTo, useRoute } from "#imports";

const route = useRoute();
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
      <div class="px-3 pb-2 pt-5 text-[10px] font-semibold tracking-widest text-muted">CREATOR WORKSPACE</div>
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
