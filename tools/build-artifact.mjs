// Assembles dist-artifact/ (from `vite build -c vite.artifact.config.ts`) into one
// self-contained page: inline CSS and JS, Google Fonts link kept.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script')
  // Escape non-ASCII so the page renders correctly whatever charset it is served with.
  .replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8').replace(/[\u0080-\uffff]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `);

const page = `<title>Golden Fortune</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=%E7%A6%8F%E7%A6%84%E5%AF%BF%E5%96%9C&family=Cinzel:wght@700;900&display=block" rel="stylesheet">
<style>
:root { color-scheme: dark; }
html, body { height: 100%; }
${css}
#debug-toggle { top: calc(10px + env(safe-area-inset-top, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); }
#debug { top: calc(54px + env(safe-area-inset-top, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); }
</style>
<div id="stage"></div>
<button id="debug-toggle" title="Debug panel (D)" aria-label="Debug panel">&#9881;</button>
<aside id="debug" hidden></aside>
<script type="module">
${js}
</script>
`;
writeFileSync('dist-artifact/golden-fortune.html', page);
console.log(`dist-artifact/golden-fortune.html ${(page.length / 1024).toFixed(0)} KB`);
