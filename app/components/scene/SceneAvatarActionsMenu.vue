<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

type AvatarElementRef = Element | ComponentPublicInstance | null;

const props = defineProps<{
  avatarType: AvatarType;
  displayName: string;
  danceAction: AvatarDanceAction | null;
  isSitting: boolean;
  cleaning: boolean;
  open: boolean;
  clickTargetRef: (element: AvatarElementRef) => void;
  menuAnchor?: HTMLElement | null;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  "action": [action: AvatarMenuAction];
}>();

const items = computed<DropdownMenuItem[]>(() => {
  const result: DropdownMenuItem[] = [];
  if (props.avatarType === "penguin") {
    result.push({
      label: "Dance",
      icon: "pixelarticons:music",
      onSelect: () => emit("action", { type: "dance", action: "dance1" })
    });
  }
  else {
    result.push({
      label: "Dances",
      icon: "pixelarticons:music",
      children: avatarDanceActions.map((danceAction, index) => ({
        label: `Dance ${index + 1}`,
        onSelect: () => emit("action", { type: "dance", action: danceAction })
      }))
    });
  }

  if (props.danceAction !== null) {
    result.push({
      label: "Stop Dance",
      icon: "pixelarticons:square",
      onSelect: () => emit("action", { type: "dance", action: null })
    });
  }

  result.push({
    label: props.isSitting ? "Stand Up" : "Sit",
    icon: "pixelarticons:sofa",
    onSelect: () => emit("action", { type: "toggle-sitting" })
  });

  if (props.avatarType === "penguin") {
    result.push({
      label: props.cleaning ? "Stop Clean" : "Clean",
      icon: props.cleaning ? "pixelarticons:square" : "pixelarticons:brush",
      onSelect: () => emit("action", { type: "clean", action: props.cleaning ? "stop" : "start" })
    });
  }

  result.push({
    label: "Refresh Avatar",
    icon: "pixelarticons:reload",
    onSelect: () => emit("action", { type: "refresh" })
  });
  return result;
});
</script>

<template>
  <UDropdownMenu
    :open="props.open"
    :items="items"
    size="sm"
    :content="{
      side: 'top',
      sideOffset: props.avatarType === 'penguin' ? -100 : 8,
      collisionPadding: 8,
      updatePositionStrategy: 'always',
      reference: props.menuAnchor ?? undefined,
    }"
    :modal="false"
    arrow
    :ui="{
      content: 'z-[60] w-max rounded-[8px] border border-[rgba(198,219,233,0.3)] bg-[rgba(15,21,29,0.96)] p-0 shadow-lg ring-0',
      group: 'flex flex-col gap-1 p-1 isolate',
      item: 'justify-start text-[#f5f2e9]',
      arrow: 'fill-[rgba(15,21,29,0.96)]',
    }"
    :class="props.avatarType === 'penguin' ? 'top-19' : 'top-5'"
    @update:open="isOpen => emit('update:open', isOpen)"
  >
    <button
      :ref="props.clickTargetRef"
      type="button"
      class="pointer-events-auto absolute z-[2] max-w-full cursor-pointer border-0 bg-transparent p-0"
      :class="props.avatarType === 'penguin'
        ? 'left-0'
        : ['left-10', props.isSitting ? 'top-6' : 'top-4']"
      :aria-label="`Opciones para el avatar de ${props.displayName}`"
    />
    <template #content-top="{ sub }">
      <p
        v-if="!sub"
        role="heading"
        aria-level="2"
        :title="props.displayName"
        class="mb-1 max-w-[min(220px,calc(100vw_-_40px))] border-b border-[rgba(198,219,233,0.2)] px-2 p-1 text-sm font-semibold leading-tight text-[#f5f2e9] whitespace-normal [overflow-wrap:anywhere]"
      >
        {{ props.displayName }}
      </p>
    </template>
  </UDropdownMenu>
</template>
