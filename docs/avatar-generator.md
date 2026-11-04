# AvatarGenerate integration

## Source and data

The editor adapts [`synt4xy/avatargenerate`](https://github.com/synt4xy/avatargenerate) at commit
`a7e9537eee98ae3e57d0e7b23ef19cb167204f30`. Its embedded R63B catalog has 13 figure types, three
palettes, and gender/selectability/colorability metadata. The editor filters available items using
those source fields; male and female starter outfits also come from the original code.

`scripts/sync-avatargenerate-data.mjs` parses the pinned JavaScript with Acorn and writes
`palettesJSON`, `setsJSON`, and the default outfits as `app/data/avatar-generator/catalog.json`. It
does not execute the legacy jQuery app or PHP generator. The script also downloads the source
Apache-2.0 license into `LICENSES/AvatarGenerate-Apache-2.0.txt` and the original category and
gender PNGs into `public/avatar-generator/icons/`. Those source icons are used in the wardrobe.

## Figure strings

Each part is serialized as `type-setId-colorId[-colorId...]`; parts are joined with periods. The
editor appends `&gender=M` or `&gender=F`, matching AvatarGenerate's form output. Import accepts the
suffix and preserves multiple color IDs.

## Preview

The app uses the external `https://habbohistory.com/habbo-imaging/avatarimage.webp` endpoint for
full and per-item previews. Per-item previews include the selected head part so its skin color is
consistent across figure options. If the endpoint is unavailable, catalog selection and outfit
string export remain usable. This editor contains no Habbo image assets and makes no claim that
the 2016 catalog matches current inventory. The UI icons are from AvatarGenerate; no Habbo avatar
or clothing sprite assets are bundled.

## Scope

This build uses Vue/Nuxt and AvatarGenerate only. Nitro Renderer, PixiJS, room rendering, Twitch,
backend services, and databases are out of scope.
