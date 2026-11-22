# Regenerating library thumbnails

The compose bench shows pre-rendered thumbnails from `public/thumbs/<look>/<template-id>.jpg`
(320×180 JPEG, one per template per look). Regenerate them after adding or changing a template.

1. Start the dev server: `npm run dev`.
2. Run this function with any Playwright runner (for example `page` from a Playwright script or the
   Playwright MCP `browser_run_code`). It renders each template's establishing state with
   `director.thumbnail()` and saves a screenshot of it.

```js
async (page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5173/?pause');
  await page.waitForFunction(() => window.__mt);
  await page.addStyleTag({ content: '#ui{display:none!important} #shot{position:fixed;left:0;top:0;width:320px;height:180px;z-index:9999}' });
  await page.evaluate(() => { const i = document.createElement('img'); i.id = 'shot'; document.body.append(i); });
  // The backdrop each look's thumbnails use (matches its house show).
  const bgFor = { neon: 0, paper: 1, ink: 1, glass: 0, cartoon: 0 };
  const styles = await page.evaluate(() => window.__mt.STYLES.map((s) => s.id));
  const ids = await page.evaluate(() => window.__mt.TEMPLATES.map((t) => t.id));
  for (const st of styles) {
    await page.evaluate(([st, bg]) => {
      const m = window.__mt;
      const style = m.styleById(st);
      m.stage.applyStyle(style, bg);
      m.director.load({ v: 1, style: st, bg, link: 'auto', seed: 7, segments: [{ id: m.TEMPLATES[0].id, len: 1 }] }, style, 0);
      m.director.playing = false;
      m.stage.app.renderer.render(m.stage.app.stage);
    }, [st, bgFor[st] ?? 0]);
    await page.waitForTimeout(400);
    for (const id of ids) {
      await page.evaluate(async (id) => {
        const m = window.__mt;
        const img = document.getElementById('shot');
        img.src = m.director.thumbnail(m.TEMPLATES.find((t) => t.id === id), 320);
        await img.decode();
      }, id);
      // A clipped page screenshot (an element screenshot waits on rAF, which background tabs throttle).
      await page.screenshot({ path: `public/thumbs/${st}/${id}.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 320, height: 180 } });
    }
  }
}
```
