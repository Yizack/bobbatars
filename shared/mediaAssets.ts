const FIXED_MEDIA_ASSETS: Record<string, string> = {
  "penguin/body.json": "penguin/penguin.json",
  "penguin/body.webp": "penguin/penguin-0.webp",
  "penguin/base.json": "penguin/penguin_base.json",
  "penguin/base.webp": "penguin/penguin_base-0.webp"
};

export function resolveMediaAssetPath (asset: string): string | undefined {
  const fixedAsset = FIXED_MEDIA_ASSETS[asset];
  if (fixedAsset) return fixedAsset;

  const clothingAsset = /^clothing\/sprites\/(\d{1,10})\.(json|webp)$/.exec(asset);
  if (!clothingAsset) return undefined;
  const [, id, extension] = clothingAsset;
  if (extension === "json") return `clothing/sprites/${id}.json`;
  return `clothing/sprites/${id}-0.webp`;
}
