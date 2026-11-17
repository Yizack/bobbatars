export interface SceneGeometry {
  roomWidth: number;
  roomHeight: number;
  columns: number;
  rows: number;
  originX: number;
  originY: number;
}

export function createSceneGeometry (roomWidth: number, roomHeight: number): SceneGeometry {
  const horizontalMargin = Math.min(40, roomWidth * 0.04);
  const verticalRange = roomHeight * 0.76;
  const requiredGridSize = Math.ceil(
    (roomWidth - horizontalMargin * 2) / (OVERLAY_SCENE.tileWidth / 2)
    + verticalRange / (OVERLAY_SCENE.tileHeight / 2)
  ) + 2;
  const gridSize = Math.max(2, Math.ceil(requiredGridSize / 2) * 2);
  const floorDiagonal = gridSize;

  return {
    roomWidth,
    roomHeight,
    columns: gridSize,
    rows: gridSize,
    originX: roomWidth / 2,
    originY: roomHeight - OVERLAY_SCENE.tileHeight / 2 - floorDiagonal * OVERLAY_SCENE.tileHeight / 2
  };
}

export function positionForTile (tile: Tile, geometry: SceneGeometry) {
  return {
    x: geometry.originX + (tile.column - tile.row) * OVERLAY_SCENE.tileWidth / 2,
    y: geometry.originY + (tile.column + tile.row) * OVERLAY_SCENE.tileHeight / 2
  };
}

export function roomTilePoints (tile: RoomTile) {
  return [
    `${tile.x},${tile.y - OVERLAY_SCENE.tileHeight / 2}`,
    `${tile.x + OVERLAY_SCENE.tileWidth / 2},${tile.y}`,
    `${tile.x},${tile.y + OVERLAY_SCENE.tileHeight / 2}`,
    `${tile.x - OVERLAY_SCENE.tileWidth / 2},${tile.y}`
  ].join(" ");
}

export function isTileInScene (tile: Tile, geometry: SceneGeometry): boolean {
  if (
    tile.column < 0 || tile.column >= geometry.columns
    || tile.row < 0 || tile.row >= geometry.rows
  ) return false;
  const point = positionForTile(tile, geometry);
  const horizontalMargin = Math.min(40, geometry.roomWidth * 0.04);
  return point.x >= horizontalMargin && point.x <= geometry.roomWidth - horizontalMargin
    && point.y >= geometry.roomHeight * 0.18 && point.y <= geometry.roomHeight - OVERLAY_SCENE.tileHeight / 2;
}

export function createRoomTiles (geometry: SceneGeometry): RoomTile[] {
  const tiles: RoomTile[] = [];
  for (let column = 0; column < geometry.columns; column++) {
    for (let row = 0; row < geometry.rows; row++) {
      const tile = { column, row };
      if (!isTileInScene(tile, geometry)) continue;
      tiles.push({ ...tile, ...positionForTile(tile, geometry) });
    }
  }
  return tiles;
}

interface SceneMovementOptions {
  avatars: Ref<AvatarState[]>;
  roomTiles: Ref<RoomTile[]>;
  animatingPenguins: Set<AvatarState>;
  preloadedImages: Map<string, PreloadedImage>;
  getGeometry: () => SceneGeometry;
  updateAvatar: (
    avatar: AvatarState,
    direction: AvatarDirection,
    action: AvatarAction,
    gesture?: AvatarState["gesture"]
  ) => Promise<void>;
  placeAvatar: (avatar: AvatarState, now?: number) => void;
  reportAvatarLoadError: (avatar: AvatarState | null, error: unknown) => void;
}

export function createSceneMovement (options: SceneMovementOptions) {
  const movingAvatars = new Set<AvatarState>();
  let animationFrame: number | null = null;
  let lastAnimationFrameAt = 0;

  function sameTile (first: Tile | null, second: Tile | null) {
    return first !== null && second !== null
      && first.column === second.column
      && first.row === second.row;
  }

  function tileKey (tile: Tile) {
    return `${tile.column},${tile.row}`;
  }

  function occupiedTileKeys (movingAvatar: AvatarState | null) {
    const occupiedTiles = new Set<string>();
    for (const avatar of options.avatars.value) {
      if (avatar === movingAvatar) continue;
      if (avatar.current) occupiedTiles.add(tileKey(avatar.current));
      if (avatar.nextStep) occupiedTiles.add(tileKey(avatar.nextStep));
      if (avatar.destination) occupiedTiles.add(tileKey(avatar.destination));
    }
    return occupiedTiles;
  }

  function tileUnavailable (tile: Tile, movingAvatar: AvatarState | null) {
    return options.avatars.value.some(other => other !== movingAvatar && (
      sameTile(tile, other.current)
      || sameTile(tile, other.nextStep)
      || sameTile(tile, other.destination)
    ));
  }

  function isPenguinDancing (avatar: AvatarState) {
    return avatar.avatarType === "penguin" && avatar.danceAction !== null;
  }

  function canMoveRandomly (avatar: AvatarState): avatar is AvatarState & { current: Tile } {
    return !avatar.removed
      && !avatar.movementPaused
      && !avatar.isSitting
      && !isPenguinDancing(avatar)
      && !avatar.cleaning
      && avatar.action !== "snowball"
      && Boolean(avatar.current);
  }

  function scheduleAvatarAnimation () {
    if (animationFrame === null) {
      animationFrame = window.requestAnimationFrame(animateAvatarSteps);
    }
  }

  function stopAvatarAnimation (avatar: AvatarState) {
    movingAvatars.delete(avatar);
    avatar.animationStartedAt = avatar.avatarType === "penguin" && avatar.danceAction !== null ? performance.now() : null;
    options.animatingPenguins.delete(avatar);
    if (movingAvatars.size === 0 && options.animatingPenguins.size === 0 && animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function moveNextStep (avatar: AvatarState) {
    if (avatar.removed || avatar.movementPaused || avatar.isSitting || isPenguinDancing(avatar) || avatar.cleaning || !avatar.current || !avatar.destination) return;
    const movementVersion = avatar.movementVersion;
    const reportError = (error: unknown) => {
      if (movementVersion === avatar.movementVersion) {
        options.reportAvatarLoadError(avatar, error);
      }
    };

    if (sameTile(avatar.current, avatar.destination)) {
      void options.updateAvatar(avatar, avatar.direction, "std")
        .then(() => {
          if (avatar.removed || movementVersion !== avatar.movementVersion) return;
          if (!sameTile(avatar.current, avatar.destination)) {
            void moveNextStep(avatar);
            return;
          }
          avatar.isWalking = false;
          avatar.nextStep = null;
          scheduleRandomMove(avatar);
        })
        .catch(reportError);
      return;
    }

    const deltaColumn = Math.sign(avatar.destination.column - avatar.current.column);
    const deltaRow = Math.sign(avatar.destination.row - avatar.current.row);
    const next = {
      column: avatar.current.column + deltaColumn,
      row: avatar.current.row + deltaRow
    };
    if (tileUnavailable(next, avatar)) {
      avatar.nextStep = null;
      if (avatar.action === "std" || avatar.danceAction !== null) {
        avatar.destination = { ...avatar.current };
        avatar.isWalking = false;
        scheduleRandomMove(avatar);
        return;
      }

      void options.updateAvatar(avatar, avatar.direction, "std")
        .then(() => {
          if (avatar.removed || movementVersion !== avatar.movementVersion) return;
          avatar.waitTimer = window.setTimeout(() => {
            avatar.waitTimer = null;
            void moveNextStep(avatar);
          }, 250);
        })
        .catch(reportError);
      return;
    }

    avatar.nextStep = next;
    const nextDirection = directionForTileDelta(deltaColumn, deltaRow);
    if (avatar.avatarType === "habbo") {
      void preloadHabboAvatar(
        options.preloadedImages,
        nextDirection,
        "std",
        "std",
        avatar.figure,
        avatar.effect
      );
    }

    void options.updateAvatar(avatar, nextDirection, "wlk")
      .then(() => {
        if (avatar.removed || movementVersion !== avatar.movementVersion) return;
        if (sameTile(avatar.current, avatar.destination)) {
          avatar.nextStep = null;
          void moveNextStep(avatar);
          return;
        }

        const latestCurrent = avatar.current;
        const latestDestination = avatar.destination;
        if (!latestCurrent || !latestDestination) return;
        const latestColumn = Math.sign(latestDestination.column - latestCurrent.column);
        const latestRow = Math.sign(latestDestination.row - latestCurrent.row);
        if (directionForTileDelta(latestColumn, latestRow) !== avatar.direction) {
          avatar.nextStep = null;
          void moveNextStep(avatar);
          return;
        }

        avatar.animationStartedAt = performance.now();
        movingAvatars.add(avatar);
        scheduleAvatarAnimation();
      })
      .catch(reportError);
  }

  function animateAvatarSteps (now: number) {
    animationFrame = null;
    if (now - lastAnimationFrameAt < OVERLAY_SCENE.animationFrameInterval) {
      if (movingAvatars.size > 0 || options.animatingPenguins.size > 0) scheduleAvatarAnimation();
      return;
    }
    lastAnimationFrameAt = now;

    for (const avatar of movingAvatars) {
      const startedAt = avatar.animationStartedAt;
      const current = avatar.current;
      const next = avatar.nextStep;
      if (avatar.removed || avatar.isSitting || startedAt === null || !current || !next) {
        movingAvatars.delete(avatar);
        avatar.animationStartedAt = null;
        continue;
      }

      const progress = Math.min((now - startedAt) / OVERLAY_SCENE.avatarStepDuration, 1);
      avatar.visual = {
        column: current.column + (next.column - current.column) * progress,
        row: current.row + (next.row - current.row) * progress
      };
      options.placeAvatar(avatar, now);

      if (progress === 1) {
        avatar.animationStartedAt = null;
        avatar.current = { ...next };
        avatar.visual = { ...next };
        avatar.nextStep = null;
        movingAvatars.delete(avatar);
        void moveNextStep(avatar);
      }
    }

    for (const avatar of options.animatingPenguins) {
      if (
        avatar.removed
        || avatar.avatarType !== "penguin"
        || (avatar.danceAction === null && avatar.action !== "snowball" && !avatar.cleaning)
      ) {
        options.animatingPenguins.delete(avatar);
        continue;
      }
      options.placeAvatar(avatar, now);
    }

    if (movingAvatars.size > 0 || options.animatingPenguins.size > 0) scheduleAvatarAnimation();
  }

  function stopAvatarMovement (avatar: AvatarState) {
    avatar.movementVersion++;
    if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
    if (avatar.waitTimer !== null) window.clearTimeout(avatar.waitTimer);
    avatar.randomTimer = null;
    avatar.waitTimer = null;
    stopAvatarAnimation(avatar);
    avatar.isWalking = false;
    avatar.nextStep = null;
    avatar.destination = avatar.current ? { ...avatar.current } : null;
    avatar.visual = avatar.current ? { ...avatar.current } : null;
    if (avatar.current) options.placeAvatar(avatar);
  }

  function scheduleRandomMove (avatar: AvatarState, delay = 1200 + Math.random() * 3800) {
    if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
    avatar.randomTimer = null;
    if (!canMoveRandomly(avatar)) return;
    avatar.randomTimer = window.setTimeout(() => {
      avatar.randomTimer = null;
      if (!canMoveRandomly(avatar)) return;
      const occupiedTiles = occupiedTileKeys(avatar);
      const optionsByDistance: Tile[][] = [[], [], []];
      for (let columnStep = -4; columnStep <= 4; columnStep++) {
        for (let rowStep = -4; rowStep <= 4; rowStep++) {
          const distance = Math.max(Math.abs(columnStep), Math.abs(rowStep));
          if (distance === 0) continue;
          const tile = {
            column: avatar.current.column + columnStep,
            row: avatar.current.row + rowStep
          };
          if (isTileInScene(tile, options.getGeometry()) && !occupiedTiles.has(tileKey(tile))) {
            optionsByDistance[distance - 1]?.push(tile);
          }
        }
      }

      const availableOptions = optionsByDistance.filter(destinations => destinations.length > 0);
      if (availableOptions.length === 0) {
        scheduleRandomMove(avatar, 300);
        return;
      }

      const destinations = availableOptions[Math.floor(Math.random() * availableOptions.length)];
      const destination = destinations?.[Math.floor(Math.random() * destinations.length)];
      if (!destination) {
        scheduleRandomMove(avatar, 300);
        return;
      }
      avatar.destination = destination;
      walk(avatar);
    }, delay);
  }

  function walk (avatar: AvatarState) {
    if (avatar.randomTimer !== null) window.clearTimeout(avatar.randomTimer);
    avatar.randomTimer = null;
    if (avatar.removed || avatar.movementPaused || avatar.isSitting || isPenguinDancing(avatar) || avatar.cleaning || avatar.isWalking) return;
    avatar.isWalking = true;
    void moveNextStep(avatar);
  }

  function findFreeTile (): Tile | null {
    const occupiedTiles = occupiedTileKeys(null);
    const freeTiles: Tile[] = [];
    for (const roomTile of options.roomTiles.value) {
      if (!occupiedTiles.has(tileKey(roomTile))) freeTiles.push({ column: roomTile.column, row: roomTile.row });
    }
    if (freeTiles.length === 0) return null;
    return freeTiles[Math.floor(Math.random() * freeTiles.length)] ?? null;
  }

  function penguinDirectionTowardAvatar (avatar: AvatarState, target: AvatarState): AvatarDirection {
    const origin = avatar.visual ?? avatar.current;
    const destination = target.visual ?? target.current;
    if (!origin || !destination) return avatar.direction;

    const deltaColumn = Math.sign(destination.column - origin.column);
    const deltaRow = Math.sign(destination.row - origin.row);
    if (deltaColumn === 0 && deltaRow === 0) return avatar.direction;
    return directionForTileDelta(deltaColumn, deltaRow);
  }

  return {
    findFreeTile,
    penguinDirectionTowardAvatar,
    scheduleAvatarAnimation,
    scheduleRandomMove,
    stopAvatarAnimation,
    stopAvatarMovement
  };
}
