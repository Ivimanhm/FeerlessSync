import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1672, height: 941 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`Inicio muestra cuatro filas y desplaza solo los campeones a ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const scroll = page.getByRole('region', { name: 'Campeones disponibles' });
    await expect(scroll.locator('.champion-card')).toHaveCount(150);
    await expect(page.getByRole('table')).toHaveCount(0);
    await scroll.scrollIntoViewIfNeeded();
    const metrics = await scroll.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll('.champion-card')].map((card) => card.getBoundingClientRect());
      const rows = new Set(cards.filter((card) => card.top >= bounds.top && card.bottom <= bounds.bottom + 1).map((card) => Math.round(card.top)));
      return { rows: rows.size, height: element.clientHeight, scrollHeight: element.scrollHeight, pageHeight: document.documentElement.scrollHeight, viewport: window.innerHeight };
    });
    expect(metrics.rows).toBe(4);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
    if (viewport.width >= 781) expect(metrics.pageHeight).toBeLessThanOrEqual(metrics.viewport + 1);
    const before = await page.evaluate(() => ({ scrollY: window.scrollY, heading: document.querySelector('h1')!.getBoundingClientRect().top }));
    await scroll.hover();
    await page.mouse.wheel(0, 420);
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const after = await page.evaluate(() => ({ scrollY: window.scrollY, heading: document.querySelector('h1')!.getBoundingClientRect().top }));
    expect(after).toEqual(before);
    await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.mouse.wheel(0, 800);
    expect(await page.evaluate(() => window.scrollY)).toBe(before.scrollY);
    await scroll.evaluate((element) => { element.scrollTop = 0; });
    await page.screenshot({ path: testInfo.outputPath(`home-${viewport.width}.png`), fullPage: true });
  });
}

test('consulta los equipos completos y los IDs usados en Historial', async ({ page }) => {
  await page.goto('/#/historial');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(21);
  await expect(page.getByRole('table').getByRole('row').nth(1).locator('td').first()).toHaveText('1');
  await expect(page.getByText('Equipo Azul', { exact: true })).toHaveCount(10);
  await expect(page.getByText('Equipo Rojo', { exact: true })).toHaveCount(10);
  await expect(page.locator('.used-id-grid span')).toHaveCount(20);
});

test('muestra serie no encontrada y permite volver a consultar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.champion-card')).toHaveCount(150);
  await page.getByRole('textbox', { name: 'ID de serie' }).fill('missing');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No hay datos de esta serie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Borrar partidas', exact: true })).toHaveCount(0);
});

test('borra las partidas con la confirmación de Sites y conserva la serie', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('.champion-card')).toHaveCount(150);
  await page.getByRole('button', { name: 'Borrar partidas', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Borrar partidas', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Clave de administrador').fill('wrong-key');
  await dialog.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
  await confirm.click();
  await expect(dialog.getByRole('alert')).toHaveText('La clave de administrador no es válida.');
  await dialog.getByLabel('Clave de administrador').fill('browser-test-token');
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.series-context [role=status]')).toHaveText('Partidas borradas: 2');
  await expect(page.locator('.champion-card')).toHaveCount(170);
  const seriesResponse = await request.get('http://127.0.0.1:8789/api/series/fearless-001');
  expect(seriesResponse.status()).toBe(200);
  expect(await seriesResponse.json()).toMatchObject({ seriesId: 'fearless-001', games: [], usedChampions: [] });
});
