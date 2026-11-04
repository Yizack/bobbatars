# Avatar catalog integration

## Catalog data

The dashboard editor and overview use `app/data/avatar-generator/catalog.json`. The catalog
provides category metadata, figure sets, gender restrictions, color-slot counts, and selectable
palette colors. The editor displays all catalog sets that match the selected gender.

Starter figure strings are kept in `app/data/avatar-generator/default-outfit.ts`. The legacy
`catalog.json` and `scripts/sync-avatargenerate-data.mjs` remain for the older AvatarGenerate data
pipeline and are not used by the dashboard pages.

## Figure strings

Each part is serialized as `type-setId[-colorId...]`; parts are joined with periods. Items with
color slots include one color ID per slot, while fixed-color items omit color IDs. Import also
accepts an optional `&gender=M` or `&gender=F` suffix.

## Preview

The app uses the external `https://habbohistory.com/habbo-imaging/avatarimage.webp` endpoint for
full and per-item previews. Each catalog preview keeps the rest of the current outfit and replaces
only the category being browsed. Clothing previews use stable catalog colors instead of the selected
clothing colors until Save succeeds, while retaining the current skin color immediately. If the
endpoint is unavailable, catalog selection and outfit string export remain usable. This editor
contains no Habbo avatar or clothing sprite assets.

## Scope

This build uses Vue/Nuxt and the embedded catalog. Nitro Renderer, PixiJS, room rendering, Twitch,
backend services, and databases are out of scope.
