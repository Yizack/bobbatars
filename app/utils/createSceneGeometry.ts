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
