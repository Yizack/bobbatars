<script setup lang="ts">
import { toRefs } from "vue";
import type { AvatarLookupState, HabboHotel } from "../../types/avatar";

const props = defineProps<{
  state: AvatarLookupState;
  name: string;
  error: string;
  queueMessage: string;
}>();
const { error, name, queueMessage, state } = toRefs(props);
const hotel = defineModel<HabboHotel>("hotel", { required: true });
const username = defineModel<string>("username", { required: true });
const emit = defineEmits<{
  lookup: [];
}>();

const hotels: { label: string, value: HabboHotel }[] = [
  { label: "Habbo.com", value: "com" },
  { label: "Habbo.es", value: "es" }
];
</script>

<template>
  <UCard variant="outline" class="min-w-0">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-round-search" class="size-4 text-primary" />
        <h2 class="text-sm font-semibold text-highlighted">Look up a Habbo figure</h2>
      </div>
    </template>
    <div class="grid min-w-0 gap-3">
      <label class="grid min-w-0 gap-1 text-sm font-medium text-highlighted">
        <span>Hotel</span>
        <USelect
          v-model="hotel"
          :items="hotels"
          value-key="value"
          label-key="label"
          aria-label="Habbo hotel"
          class="w-full"
          :disabled="state === 'loading'"
        />
      </label>
      <label class="grid min-w-0 gap-1 text-sm font-medium text-highlighted">
        <span>Username</span>
        <UInput
          v-model="username"
          autocomplete="off"
          aria-label="Habbo username"
          placeholder="Enter a Habbo username"
          class="w-full"
          :disabled="state === 'loading'"
          @keydown.enter.prevent="emit('lookup')"
        />
      </label>
      <UButton
        type="button"
        class="w-full justify-center"
        color="primary"
        icon="i-lucide-search"
        :loading="state === 'loading'"
        :disabled="!username.trim() || state === 'loading'"
        @click="emit('lookup')"
      >
        Look up
      </UButton>
    </div>
    <UAlert
      v-if="state === 'queued'"
      class="mt-3"
      color="warning"
      variant="subtle"
      title="Figure lookup queued"
      :description="queueMessage"
      icon="i-lucide-clock-3"
    />
    <UAlert
      v-else-if="state === 'success'"
      class="mt-3"
      color="success"
      variant="subtle"
      :title="`Loaded ${name}'s figure`"
      description="The figure is ready to preview and edit. Save it to keep it on your account."
      icon="i-lucide-circle-check"
    />
    <UAlert
      v-else-if="state === 'error'"
      class="mt-3"
      color="error"
      variant="subtle"
      title="Could not look up this figure"
      :description="error"
      icon="i-lucide-circle-alert"
    />
  </UCard>
</template>
