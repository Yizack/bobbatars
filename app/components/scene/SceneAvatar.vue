<script setup lang="ts">
import { ref } from "vue";
import SceneAvatarActionsMenu from "./SceneAvatarActionsMenu.vue";
import type { AvatarElementRef, AvatarState } from "../../types/sceneAvatar";
import type { AvatarMenuAction } from "../../types/avatar";

const props = defineProps<{
  avatar: AvatarState;
  user: string;
  chat: boolean;
}>();

const emit = defineEmits<{
  "menu-open-change": [isOpen: boolean];
  "menu-action": [action: AvatarMenuAction];
}>();

const menuAnchor = ref<HTMLElement | null>(null);

function setMenuAnchor (element: AvatarElementRef) {
  menuAnchor.value = typeof HTMLElement !== "undefined" && element instanceof HTMLElement ? element : null;
  props.avatar.menuAnchorRef(element);
}
</script>

<template>
  <div
    v-if="props.avatar.avatarType === 'habbo'"
    :ref="props.avatar.shadowRef"
    class="pointer-events-none absolute left-0.5 -top-1 z-[1] h-[18px] w-[38px] rounded-[50%] bg-[rgba(15,21,29,0.42)]"
    aria-hidden="true"
  />
  <HabboPreviewImage
    v-if="props.avatar.avatarType === 'habbo' && props.avatar.currentImage"
    :image-ref="props.avatar.imageRef"
    class="pointer-events-none absolute left-3.5 z-[2] h-auto max-w-full select-none"
    :class="props.avatar.isSitting ? 'top-1' : '-top-1.5'"
    :src="props.avatar.currentImage"
    :alt="`Avatar de ${props.avatar.displayName}`"
    aria-hidden="true"
    draggable="false"
  />
  <canvas
    v-else-if="props.avatar.avatarType === 'penguin' && props.avatar.currentImage"
    :ref="props.avatar.imageRef"
    class="pointer-events-none absolute left-0 top-19 z-[2] max-w-full select-none"
    :aria-label="`Avatar de ${props.avatar.displayName}`"
    aria-hidden="true"
  />
  <span
    :ref="setMenuAnchor"
    class="pointer-events-none absolute left-0 top-5 h-0 w-0"
    aria-hidden="true"
  />
  <SceneAvatarActionsMenu
    v-if="props.avatar.currentImage"
    :avatar-type="props.avatar.avatarType"
    :display-name="props.avatar.displayName"
    :dance-action="props.avatar.danceAction"
    :is-sitting="props.avatar.isSitting"
    :cleaning="props.avatar.cleaning"
    :open="props.avatar.menuVisible"
    :click-target-ref="props.avatar.clickTargetRef"
    :menu-anchor="menuAnchor"
    @update:open="isOpen => emit('menu-open-change', isOpen)"
    @action="action => emit('menu-action', action)"
  />
  <span
    :ref="props.avatar.labelRef"
    class="pointer-events-none absolute left-0 z-[3] w-max max-w-[min(180px,calc(100%_-_16px))] overflow-hidden rounded-[5px] border border-[rgba(198,219,233,0.2)] bg-[rgba(15,21,29,0.86)] px-[6px] py-[2px] text-[11px] leading-[1.2] text-[#f5f2e9] truncate font-[Ubuntu]"
    :class="props.avatar.avatarType === 'penguin' ? 'top-34' : 'top-7'"
    :title="`${props.avatar.displayName}: ${props.avatar.activity} mensajes`"
  >
    {{ props.avatar.displayName }}
  </span>
  <UPopover
    v-if="props.chat && props.avatar.bubbleVisible"
    :open="true"
    :dismissible="false"
    :content="{ side: 'top', sideOffset: 8, collisionPadding: 8, updatePositionStrategy: 'always' }"
    arrow
    :ui="{
      content: 'z-50 pointer-events-none w-max max-w-[min(240px,calc(100vw_-_24px))] overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.95)] px-[9px] py-[7px] text-[13px] leading-[1.3] text-[#202630] whitespace-pre-wrap [overflow-wrap:anywhere]',
      arrow: 'fill-white',
    }"
  >
    <template #anchor>
      <span
        :ref="props.avatar.popoverAnchorRef"
        class="pointer-events-none absolute left-0 h-0 w-0"
        :class="props.avatar.avatarType === 'penguin' ? 'top-32' : 'top-5'"
        aria-hidden="true"
      />
    </template>
    <template #content>
      <ChatEmotes
        :text="props.avatar.bubbleMessage"
        :emote-offsets="props.avatar.bubbleEmoteOffsets"
        :user="props.user"
        class="font-[Ubuntu]"
      />
    </template>
  </UPopover>
</template>
