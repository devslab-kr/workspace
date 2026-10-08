import { readFile, writeFile, mkdir, cp, access } from 'node:fs/promises';
import { posix } from 'node:path';
import { createRequire } from 'node:module';
import { Marked } from 'marked';
import { renderPublisherHtml } from '@devslab/site-kit';
import { DEVSLAB_PUBLISHER } from '@devslab/site-kit/devslab';

const root = new URL('../../', import.meta.url);
const output = new URL('site-dist/', root);
const pages = new Map([
  ['README.md', ['index.html', 'Workspace', 'en']],
  ['README.ko.md', ['index.ko.html', 'Workspace', 'ko']],
  ['docs/README.md', ['docs/index.html', 'Documentation', 'en']],
  ['docs/solid.md', ['docs/solid.html', 'SolidJS', 'en']],
  ['docs/react-vue.md', ['docs/react-vue.html', 'React and Vue', 'en']],
  ['src/svelte/README.md', ['docs/svelte.html', 'Svelte', 'en']],
  ['docs/brand.md', ['docs/brand.html', 'Brand guide', 'en']],
  ['docs/releasing.md', ['docs/releasing.html', 'OIDC releases', 'en']],
  ['docs/verification.md', ['docs/verification.html', 'Verification', 'en']],
  ['CONTRIBUTING.md', ['contributing.html', 'Contributing', 'en']],
  ['CHANGELOG.md', ['changelog.html', 'Changelog', 'en']],
]);
await mkdir(output, { recursive: true });
await cp(new URL('docs/assets/brand/', root), new URL('docs/assets/brand/', output), { recursive: true });
await access(new URL('demo-dist/index.html', root));
await cp(new URL('demo-dist/', root), new URL('demo/', output), { recursive: true });
await writeFile(new URL('.nojekyll', output), '');
const require = createRequire(import.meta.url);
await cp(require.resolve('@fontsource/geist/files/geist-latin-400-normal.woff2'), new URL('geist.woff2', output));
const stylesheet = `:root{color-scheme:light dark;--bg:#fff;--fg:#18181b;--muted:#52525b;--line:#e4e4e7;--accent:#1d4ed8;--code:#f4f4f5;font-family:Geist,system-ui,sans-serif}html[data-theme=dark]{--bg:#09090b;--fg:#fafafa;--muted:#a1a1aa;--line:#27272a;--accent:#93c5fd;--code:#18181b;color-scheme:dark}@media(prefers-color-scheme:dark){html:not([data-theme=light]){--bg:#09090b;--fg:#fafafa;--muted:#a1a1aa;--line:#27272a;--accent:#93c5fd;--code:#18181b}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);line-height:1.7}a{color:var(--accent);text-underline-offset:.2em}a:hover{text-decoration-thickness:2px}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:4px}header{border-bottom:1px solid var(--line);padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--fg);font-weight:600;font-size:20px}.brand img{width:36px;height:36px}.dark-mark{display:none}html[data-theme=dark] .light-mark{display:none}html[data-theme=dark] .dark-mark{display:block}@media(prefers-color-scheme:dark){html:not([data-theme=light]) .light-mark{display:none}html:not([data-theme=light]) .dark-mark{display:block}}nav{display:flex;gap:20px;align-items:center;flex-wrap:wrap}button{background:var(--bg);border:1px solid var(--line);color:var(--fg);font:inherit;border-radius:6px;min-height:40px;padding:4px 12px;cursor:pointer}.layout{display:grid;grid-template-columns:230px minmax(0,820px);gap:56px;max-width:1220px;margin:0 auto;padding:48px 28px}aside{min-width:0;border-right:1px solid var(--line);padding-right:24px}aside a{display:block;padding:6px 0;text-decoration:none;color:var(--muted)}aside a[aria-current=page]{color:var(--accent);font-weight:600}main{min-width:0;overflow-wrap:anywhere}h1{font-size:40px;line-height:1.2;letter-spacing:-.025em;margin:0 0 24px}h2{margin-top:48px;font-size:26px;line-height:1.35}h3{margin-top:32px;font-size:21px;line-height:1.4}p{margin:16px 0}img{max-width:100%;height:auto}pre{max-width:100%;background:var(--code);padding:20px;border-radius:8px;overflow:auto;font-size:14px;line-height:1.65}code{font-family:ui-monospace,Consolas,monospace;font-size:.9em}p code,li code,td code{background:var(--code);padding:2px 4px;border-radius:3px}table{max-width:100%;display:block;width:100%;overflow-x:auto;border-collapse:collapse;font-size:14px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:12px 16px;vertical-align:top}th{font-weight:600}blockquote{margin-left:0;padding:8px 20px;border-left:1px solid var(--line);color:var(--muted)}footer{border-top:1px solid var(--line);padding:28px;color:var(--muted);font-size:14px}.skip{position:fixed;top:-80px;left:16px;background:var(--bg);padding:8px}.skip:focus{top:8px}@media(max-width:800px){header{padding:12px 16px;align-items:flex-start;flex-wrap:wrap}nav{gap:14px;font-size:14px}.layout{grid-template-columns:1fr;gap:24px;padding:24px 16px}aside{border-right:0;border-bottom:1px solid var(--line);padding:0 0 16px;display:flex;gap:18px;overflow:auto}aside a{white-space:nowrap}h1{font-size:32px}pre{padding:14px}}`;
await writeFile(new URL('style.css', output), '@font-face{font-family:Geist;src:url(geist.woff2) format("woff2");font-weight:400;font-display:swap}' + stylesheet);
const escape = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function relativeLink(source, destination, href) {
  if (/^(?:[a-z]+:|#|\/\/)/i.test(href)) return href;
  const [file, anchor] = href.split('#');
  const resolved = posix.normalize(posix.join(posix.dirname(source), file));
  const target = pages.get(resolved)?.[0];
  if (target) return posix.relative(posix.dirname(destination), target) + (anchor ? `#${anchor}` : '');
  if (resolved.startsWith('docs/assets/')) return posix.relative(posix.dirname(destination), resolved);
  return `https://github.com/devslab-kr/workspace/blob/main/${resolved}${anchor ? `#${anchor}` : ''}`;
}
for (const [source, [destination, title, lang]] of pages) {
  let text = await readFile(new URL(source, root), 'utf8');
  // The site's own header supplies the brand; README package headers remain in npm/GitHub.
  text = text.replace(/<p align="center">[\s\S]*?<\/p>/, '');
  const markdown = new Marked();
  markdown.use({ renderer: {
    heading({ text, depth, tokens }) { const id = text.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N} _-]/gu,'').replaceAll(' ','-'); return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>`; },
    link({ href, tokens }) { return `<a href="${escape(relativeLink(source, destination, href))}">${this.parser.parseInline(tokens)}</a>`; },
    image({ href, text }) { return `<img src="${escape(relativeLink(source, destination, href))}" alt="${escape(text)}" loading="lazy">`; },
  }});
  const prefix = posix.relative(posix.dirname(destination), '.') || '.';
  const local = path => `${prefix}/${path}`;
  const navItems = [['index.html','Overview'],['docs/index.html','Guides'],['docs/solid.html','SolidJS'],['docs/react-vue.html','React / Vue'],['docs/svelte.html','Svelte'],['docs/brand.html','Brand'],['docs/releasing.html','Releases'],['contributing.html','Contributing'],['changelog.html','Changelog']];
  const sidebar = navItems.map(([path,label]) => `<a href="${local(path)}"${destination===path?' aria-current="page"':''}>${label}</a>`).join('');
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · DevsLab Workspace</title><meta name="description" content="Retained workspace tabs, keyboard shortcuts and open-screen switching for Solid, React, Vue and Svelte."><link rel="canonical" href="https://devslab-kr.github.io/workspace/${destination==='index.html'?'':destination}"><link rel="stylesheet" href="${local('style.css')}"><link rel="icon" href="${local('docs/assets/brand/favicon.svg')}"></head><body><a class="skip" href="#content">Skip to content</a><header><a class="brand" href="${local('index.html')}"><img class="light-mark" src="${local('docs/assets/brand/glyph-color.svg')}" alt=""><img class="dark-mark" src="${local('docs/assets/brand/glyph-dark.svg')}" alt="">Workspace</a><nav aria-label="Main"><a href="${local('demo/')}">Live demo</a><a href="${local(lang==='ko'?'index.html':'index.ko.html')}">${lang==='ko'?'English':'한국어'}</a><a href="https://github.com/devslab-kr/workspace">GitHub</a><button id="theme" type="button">Toggle theme</button></nav></header><div class="layout"><aside aria-label="Documentation">${sidebar}</aside><main id="content">${markdown.parse(text)}</main></div><footer>Open source by ${renderPublisherHtml(DEVSLAB_PUBLISHER)} · Apache-2.0 since 0.1.1 · <a href="https://github.com/devslab-kr/workspace/blob/main/${source}">Edit this page</a></footer><script>const saved=localStorage.getItem('workspace-docs-theme');if(saved==='light'||saved==='dark')document.documentElement.dataset.theme=saved;document.getElementById('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;const next=dark?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('workspace-docs-theme',next)});</script></body></html>`;
  await mkdir(new URL(posix.dirname(destination)+'/', output), { recursive: true });
  await writeFile(new URL(destination, output), html);
}
await writeFile(new URL('sitemap.xml', output), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...pages.values()].map(([path]) => `<url><loc>https://devslab-kr.github.io/workspace/${path==='index.html'?'':path}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${pages.size} documentation pages and the live demo in site-dist.`);
