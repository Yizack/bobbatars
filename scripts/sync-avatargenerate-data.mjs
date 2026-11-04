import { parse } from 'acorn'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const sourceCommit = 'a7e9537eee98ae3e57d0e7b23ef19cb167204f30'
const sourceBase = `https://raw.githubusercontent.com/synt4xy/avatargenerate/${sourceCommit}`
const sourceUrl = `${sourceBase}/app/js/jquery.avatargenerate.js`
const licenseUrl = `${sourceBase}/LICENSE`
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(root, 'app/data/avatar-generator')
const licenseDirectory = resolve(root, 'LICENSES')
const iconDirectory = resolve(root, 'public/avatar-generator/icons')
const iconFiles = [
  'body.png', 'hair.png', 'tops.png', 'bottoms.png', 'male.png', 'female.png',
  'hats.png', 'hair-accessories.png', 'glasses.png', 'moustaches.png',
  'chest.png', 'jackets.png', 'accessories.png', 'shoes.png', 'belts.png',
]

const response = await fetch(sourceUrl)

if(!response.ok) throw new Error(`AvatarGenerate source download failed: ${response.status}`)

const source = await response.text()
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' })
const extracted = {}

function readLiteral(node) {
  if(node.type === 'Literal') return node.value

  if(node.type === 'UnaryExpression' && node.operator === '-') return -readLiteral(node.argument)

  if(node.type === 'ArrayExpression') return node.elements.map(readLiteral)

  if(node.type === 'ObjectExpression') {
    return Object.fromEntries(node.properties.map(property => [
      (property.key.name ?? property.key.value),
      readLiteral(property.value)
    ]))
  }

  throw new Error(`Unsupported AvatarGenerate catalog literal: ${node.type}`)
}

function visit(node) {
  if(!node || typeof node !== 'object') return

  if(node.type === 'VariableDeclarator' && [ 'palettesJSON', 'setsJSON', 'habbo', 'habboFemale' ].includes(node.id?.name)) {
    extracted[node.id.name] = readLiteral(node.init)
  }

  for(const value of Object.values(node)) {
    if(Array.isArray(value)) value.forEach(visit)
    else if(value && typeof value === 'object') visit(value)
  }
}

visit(ast)

if(!extracted.palettesJSON || !extracted.setsJSON || !extracted.habbo || !extracted.habboFemale) {
  throw new Error('AvatarGenerate source is missing an expected catalog declaration')
}

const catalog = {
  source: 'synt4xy/avatargenerate',
  sourceCommit,
  palettes: extracted.palettesJSON,
  setTypes: extracted.setsJSON,
  defaults: {
    M: extracted.habbo,
    F: extracted.habboFemale
  }
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(resolve(outputDirectory, 'catalog.json'), `${JSON.stringify(catalog)}\n`)

const licenseResponse = await fetch(licenseUrl)

if(!licenseResponse.ok) throw new Error(`AvatarGenerate license download failed: ${licenseResponse.status}`)

await mkdir(licenseDirectory, { recursive: true })
await writeFile(resolve(licenseDirectory, 'AvatarGenerate-Apache-2.0.txt'), await licenseResponse.text())

await mkdir(iconDirectory, { recursive: true })

for(const filename of iconFiles) {
  const iconResponse = await fetch(`${sourceBase}/app/img/${filename}`)

  if(!iconResponse.ok) throw new Error(`AvatarGenerate icon ${filename} download failed: ${iconResponse.status}`)

  await writeFile(resolve(iconDirectory, filename), Buffer.from(await iconResponse.arrayBuffer()))
}

console.log(`Wrote ${extracted.setsJSON.length} figure types, ${Object.keys(extracted.palettesJSON).length} palettes, and ${iconFiles.length} source icons from ${sourceCommit}`)
