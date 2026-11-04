<script setup lang="ts">
import { useIntervalFn, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import type { ChatClient as TwitchChatClient } from '@twurple/chat'
import { withQuery } from 'ufo'
import { useHead } from '#imports'
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { ComponentPublicInstance, CSSProperties } from 'vue'

const props = defineProps<{
  user: string
}>()

interface Tile {
  column: number
  row: number
}

interface ActiveUser {
  login: string
  displayName: string
  activity: number
  lastActivity: number
  lastMessage: string
  lastMessageAt: number
}

interface AvatarElements {
  image: HTMLImageElement | null
  label: HTMLElement | null
  bubble: HTMLElement | null
}

type AvatarElementRef = Element | ComponentPublicInstance | null
type AvatarPart = keyof AvatarElements
type BubbleStyle = CSSProperties & { '--tail-offset': string }

interface AvatarState {
  login: string
  displayName: string
  activity: number
  current: Tile | null
  visual: Tile | null
  destination: Tile | null
  direction: number
  action: 'std' | 'wlk'
  gesture: 'std' | 'spk'
  currentImage: string
  imageWidth: number
  imageHeight: number
  bubbleMessage: string
  bubbleVisible: boolean
  position: {
    shadow: CSSProperties
    image: CSSProperties
    label: CSSProperties
    bubble: BubbleStyle
  }
  imageRef: (element: AvatarElementRef) => void
  labelRef: (element: AvatarElementRef) => void
  bubbleRef: (element: AvatarElementRef) => void
  isWalking: boolean
  nextStep: Tile | null
  animationFrame: number | null
  movementVersion: number
  randomTimer: number | null
  waitTimer: number | null
  bubbleTimer: number | null
  gestureTimer: number | null
  speechVersion: number
  removed: boolean
}

const imageEndpoint = 'https://habbohistory.com/habbo-imaging/avatarimage.webp'
const figure = 'hd-180-1.hr-100-61.ch-210-66.lg-270-82.sh-290-80'
const tileWidth = 76
const tileHeight = tileWidth / 2
const stepDuration = 320
const chatChannel = props.user.toLowerCase()
const maxAvatars = 50
const inactiveTimeout = 15 * 60 * 1000
const knownChatBots = new Set([
  'ankhbot',
  'blerp',
  'botisimo',
  'botrix',
  'coebot',
  'commanderroot',
  'deepbot',
  'fossabot',
  'mixitup',
  'moobot',
  'nightbot',
  'phantombot',
  'pretzel_rocks',
  'sery_bot',
  'soundalerts',
  'streamcaptain',
  'streamcord',
  'streamelements',
  'streamlabs',
  'streamlabscharity',
  'twitchat',
  'wizebot',
])

const room = ref<HTMLDivElement | null>(null)
const status = ref('Conectando al chat de Twitch…')
const avatars = ref<AvatarState[]>([])
const activeUsers = new Map<string, ActiveUser>()
const avatarsByUser = new Map<string, AvatarState>()
const avatarElements = new Map<string, AvatarElements>()
const preloadedImages = new Map<string, {
  image: HTMLImageElement
  promise: Promise<HTMLImageElement | null>
}>()

let columns = 0
let rows = 0
let roomWidth = 0
let roomHeight = 0
let originX = 0
let originY = 0
let chatClient: TwitchChatClient | null = null
let chatConnected = false
let isUnmounting = false

useHead({
  title: 'Widget de sala Habbo',
  link: [{ rel: 'preconnect', href: 'https://habbohistory.com' }],
  htmlAttrs: {
    class: 'overflow-hidden bg-transparent',
  },
  bodyAttrs: {
    class: 'm-0 overflow-hidden bg-transparent',
  },
})

function imageUrl(direction: number, action: AvatarState['action'], gesture = 'std') {
  return withQuery(imageEndpoint, {
    figure,
    direction,
    head_direction: direction,
    gesture,
    action,
    size: 'm',
    format: 'webp',
    rv: 55,
    animv: 28,
  })
}

function preloadAvatar(
  direction: number,
  action: AvatarState['action'],
  gesture = 'std',
): Promise<HTMLImageElement | null> {
  const url = imageUrl(direction, action, gesture)
  const cached = preloadedImages.get(url)
  if (cached) return cached.promise

  const image = new Image()
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', () => {
      preloadedImages.delete(url)
      console.warn('No se pudo precargar la animación del avatar.')
      resolve(null)
    }, { once: true })
  })
  preloadedImages.set(url, { image, promise })
  image.src = url
  return promise
}

async function preloadAllWalkAnimations() {
  let nextDirection = 0
  const loadNext = async () => {
    while (nextDirection < 8) {
      const directionToLoad = nextDirection++
      await preloadAvatar(directionToLoad, 'wlk')
    }
  }
  await Promise.all([loadNext(), loadNext()])
}

async function updateAvatar(
  avatar: AvatarState,
  direction: number,
  action: AvatarState['action'],
  gesture = avatar.gesture,
): Promise<void> {
  avatar.direction = direction
  avatar.action = action
  avatar.gesture = gesture
  const nextImage = imageUrl(avatar.direction, avatar.action, avatar.gesture)

  if (nextImage === avatar.currentImage && avatar.imageWidth > 0) {
    placeHabbo(avatar)
    return
  }

  avatar.currentImage = nextImage
  const image = await preloadAvatar(avatar.direction, avatar.action, avatar.gesture)
  if (avatar.removed) return

  const latestImage = imageUrl(avatar.direction, avatar.action, avatar.gesture)
  if (nextImage !== latestImage) {
    await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture)
    return
  }
  if (!image) throw new Error('No se pudo cargar la imagen del avatar.')

  avatar.imageWidth = image.naturalWidth * 1.08
  avatar.imageHeight = image.naturalHeight * 1.08
  await nextTick()
  if (avatar.removed) return
  if (nextImage !== avatar.currentImage) {
    await updateAvatar(avatar, avatar.direction, avatar.action, avatar.gesture)
    return
  }
  placeHabbo(avatar)
}

function positionFor(column: number, row: number) {
  return {
    x: originX + (column - row) * tileWidth / 2,
    y: originY + (column + row) * tileHeight / 2,
  }
}

function isRoomTile(tile: Tile) {
  if (
    tile.column < 0 || tile.column >= columns ||
    tile.row < 0 || tile.row >= rows
  ) return false
  const point = positionFor(tile.column, tile.row)
  const horizontalMargin = Math.min(40, roomWidth * 0.04)
  return point.x >= horizontalMargin && point.x <= roomWidth - horizontalMargin &&
    point.y >= roomHeight * 0.18 && point.y <= roomHeight * 0.94
}

function placeHabbo(avatar: AvatarState) {
  if (!avatar.visual) return
  const point = positionFor(avatar.visual.column, avatar.visual.row)
  const groundY = point.y + tileHeight * 0.34
  const depth = Math.round(avatar.visual.column + avatar.visual.row)
  const elements = avatarElements.get(avatar.login)
  const imageHeight = elements?.image?.offsetHeight || avatar.imageHeight
  const labelHalfWidth = (elements?.label?.offsetWidth ?? 0) / 2
  const labelHeight = elements?.label?.offsetHeight ?? 0
  const labelX = Math.max(
    labelHalfWidth + 8,
    Math.min(roomWidth - labelHalfWidth - 8, point.x),
  )
  const bubbleHalfWidth = (elements?.bubble?.offsetWidth ?? 0) / 2
  const bubbleX = Math.max(
    bubbleHalfWidth + 8,
    Math.min(roomWidth - bubbleHalfWidth - 8, point.x),
  )
  const tailOffset = Math.max(
    -bubbleHalfWidth + 12,
    Math.min(bubbleHalfWidth - 12, point.x - bubbleX),
  )

  avatar.position.image = {
    left: `${point.x}px`,
    top: `${groundY}px`,
    zIndex: depth + 2,
    width: avatar.imageWidth > 0 ? `${avatar.imageWidth}px` : undefined,
  }
  avatar.position.shadow = {
    left: `${point.x}px`,
    top: `${groundY}px`,
    zIndex: depth + 1,
  }
  avatar.position.label = {
    left: `${labelX}px`,
    top: `${groundY - imageHeight}px`,
    zIndex: depth + 3,
  }
  avatar.position.bubble = {
    left: `${bubbleX}px`,
    top: `${groundY - imageHeight - labelHeight * 0.7 - 8}px`,
    zIndex: depth + 4,
    '--tail-offset': `${tailOffset}px`,
  }
}

function setAvatarElement(login: string, part: AvatarPart, value: AvatarElementRef) {
  const elements = avatarElements.get(login) ?? {
    image: null,
    label: null,
    bubble: null,
  }

  if (part === 'image') {
    elements.image = typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement
      ? value
      : null
  } else {
    const element = typeof HTMLElement !== 'undefined' && value instanceof HTMLElement
      ? value
      : null
    elements[part] = element
  }

  if (elements.image || elements.label || elements.bubble) {
    avatarElements.set(login, elements)
  } else {
    avatarElements.delete(login)
  }

}

function updateRoomLayout() {
  const bounds = room.value?.getBoundingClientRect()
  if (!bounds) return

  const nextWidth = bounds.width
  const nextHeight = bounds.height
  const horizontalMargin = Math.min(40, nextWidth * 0.04)
  const verticalRange = nextHeight * 0.76
  const requiredGridSize = Math.ceil(
    (nextWidth - horizontalMargin * 2) / (tileWidth / 2) +
    verticalRange / (tileHeight / 2),
  ) + 2
  const gridSize = Math.max(2, Math.ceil(requiredGridSize / 2) * 2)
  const layoutChanged = nextWidth !== roomWidth || nextHeight !== roomHeight ||
    gridSize !== columns || gridSize !== rows

  roomWidth = nextWidth
  roomHeight = nextHeight
  columns = gridSize
  rows = gridSize
  originX = roomWidth / 2
  originY = roomHeight / 2 - (columns + rows - 2) * tileHeight / 4

  if (layoutChanged && avatars.value.length > 0) {
    for (const avatar of [...avatars.value]) {
      avatar.movementVersion++
      if (avatar.animationFrame !== null) {
        window.cancelAnimationFrame(avatar.animationFrame)
      }
      avatar.animationFrame = null
      if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer)
      if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer)
      avatar.randomTimer = null
      avatar.waitTimer = null
      avatar.isWalking = false
      avatar.nextStep = null
      avatar.current = null
      avatar.visual = null
      avatar.destination = null
    }

    for (const avatar of avatars.value) {
      const spawn = findFreeTile()
      if (!spawn) {
        removeAvatarState(avatar)
        continue
      }
      avatar.current = { ...spawn }
      avatar.visual = { ...spawn }
      avatar.destination = { ...spawn }
      placeHabbo(avatar)
      scheduleRandomMove(avatar)
    }
    return
  }

  avatars.value.forEach(placeHabbo)
}

function habboDirection(deltaColumn: number, deltaRow: number) {
  const directions: Record<string, number> = {
    '1,0': 2,
    '-1,0': 6,
    '0,1': 4,
    '0,-1': 0,
    '1,1': 3,
    '-1,-1': 7,
    '1,-1': 1,
    '-1,1': 5,
  }
  const direction = directions[`${deltaColumn},${deltaRow}`]
  if (direction === undefined) {
    throw new Error(`Dirección Habbo no válida: ${deltaColumn},${deltaRow}`)
  }
  return direction
}

function sameTile(first: Tile | null, second: Tile | null) {
  return first !== null && second !== null &&
    first.column === second.column &&
    first.row === second.row
}

function tileUnavailable(tile: Tile, movingAvatar: AvatarState | null) {
  return avatars.value.some(other => other !== movingAvatar && (
    sameTile(tile, other.current) ||
    sameTile(tile, other.nextStep) ||
    sameTile(tile, other.destination)
  ))
}

function updateChatStatus() {
  const connection = chatConnected
    ? `Conectado a #${chatChannel}`
    : `Conectando a #${chatChannel}`
  status.value = `${connection} · ${avatars.value.length}/${maxAvatars} avatares activos`
}

function findFreeTile(): Tile | null {
  const freeTiles: Tile[] = []
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const tile = { column, row }
      if (isRoomTile(tile) && !tileUnavailable(tile, null)) freeTiles.push(tile)
    }
  }
  if (freeTiles.length === 0) return null
  return freeTiles[Math.floor(Math.random() * freeTiles.length)] ?? null
}

function createAvatarState(user: ActiveUser): AvatarState | null {
  const spawn = findFreeTile()
  if (!spawn) return null

  const avatar = reactive<AvatarState>({
    login: user.login,
    displayName: user.displayName,
    activity: user.activity,
    current: { ...spawn },
    visual: { ...spawn },
    destination: { ...spawn },
    direction: 2,
    action: 'std',
    gesture: 'std',
    currentImage: '',
    imageWidth: 0,
    imageHeight: 0,
    bubbleMessage: '',
    bubbleVisible: false,
    position: {
      shadow: {},
      image: {},
      label: {},
      bubble: { '--tail-offset': '0px' },
    },
    imageRef: element => setAvatarElement(user.login, 'image', element),
    labelRef: element => setAvatarElement(user.login, 'label', element),
    bubbleRef: element => setAvatarElement(user.login, 'bubble', element),
    isWalking: false,
    nextStep: null,
    animationFrame: null,
    movementVersion: 0,
    randomTimer: null,
    waitTimer: null,
    bubbleTimer: null,
    gestureTimer: null,
    speechVersion: 0,
    removed: false,
  })

  avatars.value.push(avatar)
  avatarsByUser.set(user.login, avatar)
  placeHabbo(avatar)
  void updateAvatar(avatar, avatar.direction, 'std')
    .then(() => {
      if (!avatar.removed) scheduleRandomMove(avatar)
    })
    .catch(error => reportAvatarLoadError(avatar, error))
  return avatar
}

function clearAvatarTimers(avatar: AvatarState) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer)
  if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer)
  if (avatar.bubbleTimer !== null) window.clearTimeout(avatar.bubbleTimer)
  if (avatar.gestureTimer !== null) window.clearTimeout(avatar.gestureTimer)
  avatar.randomTimer = null
  avatar.waitTimer = null
  avatar.bubbleTimer = null
  avatar.gestureTimer = null
}

function removeAvatarState(avatar: AvatarState) {
  avatar.removed = true
  avatar.movementVersion++
  clearAvatarTimers(avatar)
  if (avatar.animationFrame !== null) {
    window.cancelAnimationFrame(avatar.animationFrame)
  }
  avatar.animationFrame = null
  avatarElements.delete(avatar.login)
  avatarsByUser.delete(avatar.login)
  const index = avatars.value.indexOf(avatar)
  if (index >= 0) avatars.value.splice(index, 1)
}

function reconcileActiveAvatars() {
  const now = Date.now()
  for (const [login, user] of activeUsers) {
    if (now - user.lastActivity >= inactiveTimeout) activeUsers.delete(login)
  }

  const topUsers = [...activeUsers.values()]
    .sort((first, second) =>
      second.activity - first.activity ||
      second.lastActivity - first.lastActivity ||
      first.login.localeCompare(second.login),
    )
    .slice(0, maxAvatars)
  const topLogins = new Set(topUsers.map(user => user.login))

  for (const avatar of [...avatars.value]) {
    if (!topLogins.has(avatar.login)) removeAvatarState(avatar)
  }

  for (const user of topUsers) {
    const avatar = avatarsByUser.get(user.login)
    if (!avatar) {
      const newAvatar = createAvatarState(user)
      if (
        newAvatar &&
        user.lastMessage &&
        Date.now() - user.lastMessageAt < 3000
      ) {
        void showChatMessage(newAvatar, user.lastMessage)
      }
      continue
    }
    avatar.displayName = user.displayName
    avatar.activity = user.activity
  }

  updateChatStatus()
}

function recordChatActivity(username: string, message: string, twitchDisplayName: string) {
  const messageText = String(message || '')
  if (messageText.trimStart().startsWith('!')) return

  const login = String(username || '').trim().toLowerCase()
  if (!login || knownChatBots.has(login)) return
  const displayName = String(twitchDisplayName || username).trim()

  const now = Date.now()
  let user = activeUsers.get(login)
  if (!user || now - user.lastActivity >= inactiveTimeout) {
    user = {
      login,
      displayName,
      activity: 0,
      lastActivity: now,
      lastMessage: '',
      lastMessageAt: 0,
    }
    activeUsers.set(login, user)
  }
  user.displayName = displayName
  user.activity++
  user.lastActivity = now
  user.lastMessage = messageText
  user.lastMessageAt = now

  const avatar = avatarsByUser.get(login)
  if (avatar && messageText.trim()) void showChatMessage(avatar, messageText)
  scheduleReconciliation()
}

async function showChatMessage(avatar: AvatarState, message: string) {
  if (avatar.removed || !message.trim()) return

  avatar.bubbleMessage = message
  avatar.bubbleVisible = true
  window.clearTimeout(avatar.bubbleTimer ?? undefined)
  avatar.bubbleTimer = window.setTimeout(() => {
    if (avatar.removed) return
    avatar.bubbleVisible = false
    avatar.bubbleTimer = null
  }, 5000)

  window.clearTimeout(avatar.gestureTimer ?? undefined)
  const speechVersion = ++avatar.speechVersion
  avatar.gesture = 'spk'
  await nextTick()
  if (avatar.removed) return
  placeHabbo(avatar)

  try {
    await updateAvatar(avatar, avatar.direction, avatar.action, 'spk')
  } catch (error) {
    reportAvatarLoadError(avatar, error)
    return
  }
  if (avatar.removed || speechVersion !== avatar.speechVersion) return

  avatar.gestureTimer = window.setTimeout(() => {
    avatar.gestureTimer = null
    if (avatar.removed || speechVersion !== avatar.speechVersion) return
    avatar.gesture = 'std'
    void updateAvatar(avatar, avatar.direction, avatar.action, 'std')
      .catch(error => reportAvatarLoadError(avatar, error))
  }, 5000)
}

async function moveNextStep(avatar: AvatarState) {
  if (avatar.removed || !avatar.current || !avatar.destination) return
  const movementVersion = avatar.movementVersion
  const reportError = (error: unknown) => {
    if (movementVersion === avatar.movementVersion) {
      reportAvatarLoadError(avatar, error)
    }
  }

  if (sameTile(avatar.current, avatar.destination)) {
    try {
      await updateAvatar(avatar, avatar.direction, 'std')
    } catch (error) {
      reportError(error)
      return
    }
    if (avatar.removed || movementVersion !== avatar.movementVersion) return
    if (!sameTile(avatar.current, avatar.destination)) {
      void moveNextStep(avatar)
      return
    }
    avatar.isWalking = false
    avatar.nextStep = null
    scheduleRandomMove(avatar)
    return
  }

  const deltaColumn = Math.sign(avatar.destination.column - avatar.current.column)
  const deltaRow = Math.sign(avatar.destination.row - avatar.current.row)
  const next = {
    column: avatar.current.column + deltaColumn,
    row: avatar.current.row + deltaRow,
  }
  if (tileUnavailable(next, avatar)) {
    avatar.nextStep = null
    if (avatar.action === 'std') {
      avatar.destination = { ...avatar.current }
      avatar.isWalking = false
      scheduleRandomMove(avatar)
      return
    }

    try {
      await updateAvatar(avatar, avatar.direction, 'std')
    } catch (error) {
      reportError(error)
      return
    }
    if (avatar.removed || movementVersion !== avatar.movementVersion) return
    avatar.waitTimer = window.setTimeout(() => {
      avatar.waitTimer = null
      void moveNextStep(avatar)
    }, 250)
    return
  }

  avatar.nextStep = next
  const nextDirection = habboDirection(deltaColumn, deltaRow)
  void preloadAvatar(nextDirection, 'std')

  try {
    await updateAvatar(avatar, nextDirection, 'wlk')
  } catch (error) {
    reportError(error)
    return
  }
  if (avatar.removed || movementVersion !== avatar.movementVersion) return
  if (sameTile(avatar.current, avatar.destination)) {
    avatar.nextStep = null
    void moveNextStep(avatar)
    return
  }

  const latestColumn = Math.sign(avatar.destination.column - avatar.current.column)
  const latestRow = Math.sign(avatar.destination.row - avatar.current.row)
  if (habboDirection(latestColumn, latestRow) !== avatar.direction) {
    avatar.nextStep = null
    void moveNextStep(avatar)
    return
  }

  const startedAt = performance.now()
  const animateStep = (now: number) => {
    if (avatar.removed || movementVersion !== avatar.movementVersion) return
    avatar.animationFrame = null
    const progress = Math.min((now - startedAt) / stepDuration, 1)
    avatar.visual = {
      column: avatar.current!.column + deltaColumn * progress,
      row: avatar.current!.row + deltaRow * progress,
    }
    placeHabbo(avatar)

    if (progress < 1) {
      avatar.animationFrame = window.requestAnimationFrame(animateStep)
    } else {
      avatar.animationFrame = null
      avatar.current = next
      avatar.visual = { ...next }
      avatar.nextStep = null
      void moveNextStep(avatar)
    }
  }
  avatar.animationFrame = window.requestAnimationFrame(animateStep)
}

function reportAvatarLoadError(avatar: AvatarState | null, error: unknown) {
  if (avatar) {
    if (avatar.removed) return
    avatar.isWalking = false
    avatar.nextStep = null
    if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer)
    avatar.waitTimer = null
  }
  status.value = 'No se pudo cargar la imagen del avatar. Revisa tu conexión con habbohistory.com.'
  console.error(error)
}

function scheduleRandomMove(avatar: AvatarState, delay = 1200 + Math.random() * 1800) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer)
  avatar.randomTimer = window.setTimeout(() => {
    if (avatar.removed || !avatar.current) return
    avatar.randomTimer = null
    const optionsByDistance: Tile[][] = [[], [], []]
    for (let columnStep = -3; columnStep <= 3; columnStep++) {
      for (let rowStep = -3; rowStep <= 3; rowStep++) {
        const distance = Math.max(Math.abs(columnStep), Math.abs(rowStep))
        if (distance === 0) continue
        const tile = {
          column: avatar.current.column + columnStep,
          row: avatar.current.row + rowStep,
        }
        if (isRoomTile(tile) && !tileUnavailable(tile, avatar)) {
          optionsByDistance[distance - 1]?.push(tile)
        }
      }
    }

    const availableOptions = optionsByDistance.filter(options => options.length > 0)
    if (availableOptions.length === 0) {
      scheduleRandomMove(avatar, 300)
      return
    }

    const options = availableOptions[Math.floor(Math.random() * availableOptions.length)]
    const destination = options?.[Math.floor(Math.random() * options.length)]
    if (!destination) {
      scheduleRandomMove(avatar, 300)
      return
    }
    avatar.destination = destination
    walk(avatar)
  }, delay)
}

function walk(avatar: AvatarState) {
  if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer)
  avatar.randomTimer = null
  if (avatar.removed || avatar.isWalking) return
  avatar.isWalking = true
  void moveNextStep(avatar)
}

async function connectToChat() {
  try {
    const { ChatClient } = await import('@twurple/chat')
    if (isUnmounting) return

    chatClient = new ChatClient({
      channels: [chatChannel],
      webSocket: true,
    })
    chatClient.onConnect(() => {
      if (isUnmounting) return
      chatConnected = true
      updateChatStatus()
    })
    chatClient.onDisconnect(() => {
      if (isUnmounting) return
      chatConnected = false
      updateChatStatus()
    })
    chatClient.onMessage((channel, username, message, msg) => {
      if (channel.replace(/^#/, '').toLowerCase() === chatChannel) {
        recordChatActivity(username, message, msg.userInfo.displayName ?? username)
      }
    })
    chatClient.connect()
  } catch (error) {
    if (isUnmounting) return
    status.value = `No se pudo conectar al chat #${chatChannel}.`
    console.error(error)
  }
}

const avatarReconcileInterval = useIntervalFn(reconcileActiveAvatars, 5000, {
  immediate: false,
})
const {
  start: scheduleReconciliation,
  stop: stopReconciliation,
} = useTimeoutFn(reconcileActiveAvatars, 250, { immediate: false })

useResizeObserver(room, () => updateRoomLayout())

onMounted(() => {
  updateRoomLayout()
  avatarReconcileInterval.resume()
  void preloadAvatar(2, 'std').then((image) => {
    if (image) return preloadAllWalkAnimations()
  })
  void connectToChat()
})

onBeforeUnmount(() => {
  isUnmounting = true
  avatarReconcileInterval.pause()
  stopReconciliation()
  chatClient?.quit()
  chatClient = null

  for (const avatar of [...avatars.value]) removeAvatarState(avatar)
  avatarElements.clear()
  activeUsers.clear()
  preloadedImages.clear()
})
</script>

<template>
  <main class="fixed inset-0 flex w-full items-end overflow-hidden bg-transparent [font-family:Trebuchet_MS,Arial,sans-serif]">
    <section class="h-[min(266px,100vh)] w-full" aria-label="Sala Habbo">
      <div ref="room" class="relative h-full w-full">
        <p class="sr-only" role="status" aria-live="polite">
          {{ status }}
        </p>

        <template v-for="avatar in avatars" :key="avatar.login">
          <div
            class="pointer-events-none absolute z-[1] h-[14px] w-[34px] -translate-x-[60%] -translate-y-[120%] rounded-[50%] bg-[rgba(15,21,29,0.42)]"
            :style="avatar.position.shadow"
            aria-hidden="true"
          />
          <img
            v-if="avatar.currentImage"
            :ref="avatar.imageRef"
            class="pointer-events-none absolute z-[2] h-auto max-w-full select-none -translate-x-[56%] -translate-y-full"
            :src="avatar.currentImage"
            :style="avatar.position.image"
            :alt="`Avatar de ${avatar.displayName}`"
            draggable="false"
          >
          <span
            :ref="avatar.labelRef"
            class="pointer-events-none absolute z-[3] w-max max-w-[min(180px,calc(100%_-_16px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[5px] border border-[rgba(198,219,233,0.2)] bg-[rgba(15,21,29,0.86)] px-[6px] py-[2px] text-[11px] leading-[1.2] text-[#f5f2e9] truncate"
            :style="avatar.position.label"
            :title="`${avatar.displayName}: ${avatar.activity} mensajes`"
          >
            {{ avatar.displayName }}
          </span>
          <div
            v-show="avatar.bubbleVisible"
            :ref="avatar.bubbleRef"
            class="pointer-events-none absolute z-[4] w-max max-w-[min(240px,calc(100%_-_24px))] -translate-x-1/2 -translate-y-[90%] overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.85)] bg-[rgba(255,255,255,0.95)] px-[9px] py-[7px] text-[13px] leading-[1.3] text-[#202630] whitespace-pre-wrap [overflow-wrap:anywhere] after:absolute after:bottom-[-5px] after:left-[calc(50%_+_var(--tail-offset,0px))] after:border-[5px] after:border-solid after:border-transparent after:border-t-[rgba(255,255,255,0.95)] after:content-[''] after:-translate-x-1/2"
            :style="avatar.position.bubble"
          >
            {{ avatar.bubbleMessage }}
          </div>
        </template>
      </div>
    </section>
  </main>
</template>
