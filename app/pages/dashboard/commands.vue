<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

definePageMeta({ layout: "dashboard", middleware: "authenticated" });

const commands: AvatarCommand[] = [
  {
    command: "!avatar",
    description: "Refresh your saved Habbo outfit. To refresh another viewer's avatar, add @username.",
    alias: ["!refreshavatar", "!updateavatar"]
  },
  {
    command: "!dance",
    description: "Make your avatar do the basic dance.",
    alias: ["!dance 1"]
  },
  {
    command: "!dance 2",
    description: "Make your avatar do the Pogo Mogo dance."
  },
  {
    command: "!dance 3",
    description: "Make your avatar do the Duck Funk dance."
  },
  {
    command: "!dance 4",
    description: "Make your avatar do the Rollie dance."
  },
  {
    command: "!dance stop",
    description: "Stop your avatar from dancing."
  },
  {
    command: "!sit",
    description: "Make your avatar sit down and stop any current dance." },
  {
    command: "!up",
    description: "Make your avatar stand up and stop any current dance." }
];

const columns: TableColumn<AvatarCommand>[] = [
  {
    id: "command",
    accessorKey: "command",
    header: "Command and aliases"
  },
  {
    id: "description",
    accessorKey: "description",
    header: "Description"
  }
];
</script>

<template>
  <main>
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <section class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="page-title">
        <div class="max-w-2xl">
          <h1 id="page-title" class="mt-3 text-3xl font-semibold tracking-normal text-highlighted sm:text-4xl">Chat commands</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Send these commands in the streamer's Twitch chat to control your Habbo avatar.</p>
        </div>
      </section>

      <section aria-label="Habbo avatar chat commands">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <UTable
            :data="commands"
            :columns="columns"
          >
            <template #command-cell="{ row }">
              <div class="flex gap-2">
                <UBadge
                  color="primary"
                  variant="subtle"
                  :label="row.original.command"
                />
                <div v-if="row.original.alias && row.original.alias.length">
                  <div class="flex gap-2">
                    <UBadge
                      v-for="alias in row.original.alias"
                      :key="alias"
                      color="neutral"
                      variant="subtle"
                      :label="alias"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UTable>
        </UCard>
      </section>
    </div>
  </main>
</template>
