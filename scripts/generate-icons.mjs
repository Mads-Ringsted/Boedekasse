// Renders the PNG app icons from public/app-icon.svg (the design master
// docs/design/app-icon.svg with the "$" drawn as a path, so no font is
// needed). Run with `npm run icons` after changing the SVG, and commit the
// PNGs. The build does not run this.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const svg = await readFile(`${pub}app-icon.svg`);

const outputs = [
  ['apple-touch-icon-180x180.png', 180],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-icon-1024x1024.png', 1024],
  ['favicon-32x32.png', 32],
];

for (const [name, size] of outputs) {
  await sharp(svg, { density: (72 * size) / 100 })
    .resize(size, size)
    .flatten({ background: '#0E1220' })
    .png()
    .toFile(`${pub}${name}`);
  console.log(`wrote public/${name}`);
}
