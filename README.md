# Habbo Outfit Studio

Nuxt/Vue outfit editor adapted from AvatarGenerate. Nitro Renderer and PixiJS are not used. The
editor uses the AvatarGenerate R63B figure catalog and produces the original Habbo outfit string
format.

## Local setup

Requires Node.js 22.22.3+, 24.15.0+, or 26+, plus pnpm.

```powershell
pnpm install
pnpm dev
```

Open `/dashboard/avatar` to choose gender, figure parts, and palette colors. Import
accepts an existing figure string; the readonly output includes its `&gender=M` or `&gender=F`
suffix. The preview uses the Habbo Imaging URL referenced by AvatarGenerate and does not require a
hotel client.

## Catalog update

`pnpm sync:avatar-data` parses the embedded palette, set type, and default outfit literals from the
pinned AvatarGenerate commit and writes the catalog under `app/data/avatar-generator/`. It also
copies the upstream Apache-2.0 license into `LICENSES/` and the original category/gender PNG icons
into `public/avatar-generator/icons/`.

## Attribution and limitations

Adapted from [synt4xy/avatargenerate](https://github.com/synt4xy/avatargenerate), Apache-2.0. See
[docs/avatar-generator.md](docs/avatar-generator.md) and `LICENSES/AvatarGenerate-Apache-2.0.txt`.
The embedded catalog is from 2016/R63B and may not match current Habbo inventories. The preview
depends on Habbo Imaging and can be unavailable independently of the local outfit-string editor. The
included PNGs are AvatarGenerate UI icons, not Habbo avatar/clothing sprites. This build does not
include room rendering, Twitch, a backend, or a database.
