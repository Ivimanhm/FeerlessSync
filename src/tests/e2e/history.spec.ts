import { expect, test } from '@playwright/test';
import catalog from '../../frontend/data/championCatalog.json' with { type: 'json' };

const championCount = catalog.champions.length;

const api = 'http://127.0.0.1:8789/api';
const authorization = { Authorization: 'Bearer browser-test-token' };

test.beforeEach(async ({ page, request }) => {
  // Keep this spec on the two-game fixture while other series contribute global stats.
  await page.route('**/api/series?*', route => route.fulfill({ json: { success: true, series: [{ seriesId: 'fearless-001' }, { seriesId: 'no-such-series' }], total: 2 } }));
  // Other browser specs exercise clearing this series; restore its two games.
  const currentSeries = await request.get(`${api}/series/fearless-001`);
  const currentGames = (await currentSeries.json()).games as { gameNumber: number }[];
  for (const game of [
    { gameNumber: 1, blueTeam: [266, 32, 103, 523, 12], redTeam: [122, 131, 84, 22, 201] },
    { gameNumber: 2, blueTeam: [164, 245, 34, 51, 53], redTeam: [86, 60, 1, 119, 432] },
  ]) {
    if (!currentGames.some(stored => stored.gameNumber === game.gameNumber)) {
      const response = await request.post(`${api}/series/fearless-001/games`, { data: game });
      expect(response.status()).toBe(201);
    }
  }
  for (const [seriesId, gameNumber, winner] of [
    ['fearless-001', 1, 'blue'], ['fearless-001', 2, null], ['fearless-002', 1, 'blue'], ['fearless-003', 1, 'red'],
  ]) {
    const response = await request.put(`${api}/series/${seriesId}/games/${gameNumber}/winner`, { headers: authorization, data: { winner } });
    expect(response.ok()).toBe(true);
  }
});

for (const viewport of [{ width: 1672, height: 941 }, { width: 1366, height: 768 }, { width: 1366, height: 620 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 700 }]) {
  test(`Historial: diseño y victorias globales a ${viewport.width}×${viewport.height}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/historial');
    await expect(page.getByRole('table')).toHaveCount(2);
    const leaderboard = page.getByRole('region', { name: 'Campeones con más victorias' });
    await expect(leaderboard.getByText('TODAS LAS SERIES')).toHaveCount(0);
    await expect(leaderboard.getByText('Cada campeón del equipo ganador suma una victoria.')).toHaveCount(0);
    const list = leaderboard.getByRole('list', { name: 'Clasificación de campeones por victorias' });
    await expect(list.getByRole('listitem')).toHaveCount(championCount);
    await expect(list.getByRole('listitem').filter({ hasText: 'Zyra' }).getByLabel('0 victorias', { exact: true })).toBeAttached();
    await expect(list.getByRole('listitem').filter({ hasText: 'Zyra' }).getByLabel('0 % de victorias')).toBeAttached();
    await expect(list.getByRole('listitem').filter({ hasText: 'Zyra' })).toContainText('0 partidas resueltas');
    if (viewport.width > 1000) {
      const matchesTop = await page.locator('.history-matches').evaluate(element => element.getBoundingClientRect().top);
      await expect.poll(() => leaderboard.evaluate((element, top) => Math.abs(element.getBoundingClientRect().top - top), matchesTop)).toBeLessThanOrEqual(1);
      await expect.poll(() => leaderboard.evaluate(element => window.innerHeight - element.getBoundingClientRect().bottom)).toBeCloseTo(24, 0);
      const pageScroll = await page.evaluate(() => window.scrollY);
      await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(list.getByRole('listitem').last()).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
      const gamesOverflow = await page.locator('.history-games').evaluate(element => getComputedStyle(element).overflowY);
      expect(gamesOverflow).toBe('visible');
      expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
      await list.evaluate(element => { element.scrollTop = 0; });
      await page.evaluate(() => window.scrollTo(0, 200));
      await expect.poll(() => leaderboard.evaluate(element => window.innerHeight - element.getBoundingClientRect().bottom)).toBeCloseTo(24, 0);
      await expect(leaderboard).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => leaderboard.evaluate((element, top) => Math.abs(element.getBoundingClientRect().top - top), matchesTop)).toBeLessThanOrEqual(1);
    }
    await expect(leaderboard.getByText('3 partidas con ganador · 1 pendiente')).toBeVisible();
    const aatrox = list.getByRole('listitem').filter({ hasText: 'Aatrox' });
    await expect(aatrox.getByLabel('2 victorias')).toBeVisible();
    await expect(aatrox.getByLabel('67 % de victorias')).toBeVisible();
    await expect(list.getByRole('listitem').first()).toContainText('Aatrox');
    await expect(page.locator('.history-champion .portrait-image--loaded').first()).toBeVisible();
    await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.querySelectorAll<HTMLImageElement>('img[loading=eager]')).map(image => image.decode())]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('history.png'), fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: 'Cambiar orden del historial' }).click();
    await expect(page.getByRole('table').first()).toHaveAttribute('aria-label', 'Partida 1: equipos por posición');
    await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: 'Equipo Azul' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Equipo Azul' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cambiar ganador de la partida 1' })).toBeFocused();
    await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
    await dialog.getByRole('radio', { name: 'Equipo Rojo' }).check();
    await expect(dialog.getByRole('button', { name: 'Guardar ganador' })).toBeDisabled();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.evaluate(element => Promise.all(Array.from(element.querySelectorAll<HTMLImageElement>('img')).map(image => image.decode())));
    await page.screenshot({ path: testInfo.outputPath('winner-modal.png'), animations: 'disabled' });
    await dialog.getByLabel('Clave de administrador').fill('wrong-key');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('La clave de administrador no es válida.');
    await expect(dialog.getByRole('radio', { name: 'Equipo Rojo' })).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath('winner-modal-error.png'), animations: 'disabled' });
    await dialog.getByLabel('Clave de administrador').fill('browser-test-token');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(list.getByRole('listitem').first()).toContainText('Akali');
    await expect(aatrox.getByLabel('1 victoria', { exact: true })).toBeAttached();
    await expect(aatrox.getByLabel('33 % de victorias')).toBeAttached();

    await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Sin ganador' }).check();
    await expect(dialog.getByText('Clave recordada en este navegador')).toBeVisible();
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(leaderboard.getByText('2 partidas con ganador · 2 pendientes')).toBeVisible();
    await expect(aatrox.getByLabel('50 % de victorias')).toBeAttached();
    await expect(page.locator('.history-summary-card').filter({ hasText: 'Ganadores pendientes' }).locator('strong')).toHaveText('2');
  });
}

test('Historial: mantiene alineados los paneles cuando cambia la altura de la cabecera', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/#/historial');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.locator('.champion-win-list li')).toHaveCount(championCount);
  const panelOffset = () => page.evaluate(() => Math.abs(
    document.querySelector('.history-panel')!.getBoundingClientRect().top
    - document.querySelector('.champion-win-panel')!.getBoundingClientRect().top,
  ));
  await expect.poll(panelOffset).toBeLessThanOrEqual(1);
  const originalTop = await page.locator('.history-panel').evaluate(element => element.getBoundingClientRect().top);
  // Simulate late wrapping/font changes without a window resize or a Preact render.
  await page.locator('.page-heading p').evaluate(element => { element.style.maxWidth = '240px'; });
  expect(await page.locator('.history-panel').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(originalTop);
  await expect.poll(panelOffset).toBeLessThanOrEqual(1);
  await expect.poll(() => page.locator('.champion-win-panel').evaluate(element => window.innerHeight - element.getBoundingClientRect().bottom)).toBeCloseTo(24, 0);
  await page.locator('.page-heading p').evaluate(element => { element.style.removeProperty('max-width'); });
  await expect.poll(panelOffset).toBeLessThanOrEqual(1);
});

test('Historial: muestra errores, permite reintentar y mantiene la clasificación sin serie', async ({ page }) => {
  await page.goto('/#/historial');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('list', { name: 'Clasificación de campeones por victorias' }).getByRole('listitem')).toHaveCount(championCount);
  await expect(page.getByRole('region', { name: 'Campeones con más victorias' })).toHaveAttribute('aria-busy', 'false');
  await page.route('**/api/stats/champions', route => route.fulfill({ status: 503, json: { success: false, error: 'database_unavailable' } }));
  await page.getByRole('button', { name: 'Actualizar clasificación' }).click();
  await expect(page.getByText('No se pudo cargar la clasificación.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Campeones con más victorias' })).toHaveAttribute('aria-busy', 'false');
  await page.unroute('**/api/stats/champions');
  await page.getByRole('button', { name: 'Reintentar clasificación' }).click();
  await expect(page.getByRole('list', { name: 'Clasificación de campeones por victorias' }).getByRole('listitem')).toHaveCount(championCount);

  await page.getByRole('combobox', { name: 'Seleccionar serie' }).selectOption('no-such-series');
  await expect(page.getByRole('heading', { name: 'No hay datos de esta serie' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Clasificación de campeones por victorias' }).getByRole('listitem')).toHaveCount(championCount);

  await page.route('**/api/stats/champions', route => route.fulfill({ json: { success: true, champions: [], completedGames: 0, pendingGames: 4 } }));
  await page.getByRole('button', { name: 'Actualizar clasificación' }).click();
  const emptyList = page.getByRole('list', { name: 'Clasificación de campeones por victorias' });
  await expect(emptyList.getByRole('listitem')).toHaveCount(championCount);
  await expect(emptyList.getByLabel('0 victorias', { exact: true })).toHaveCount(championCount);
  await expect(emptyList.getByLabel('0 % de victorias')).toHaveCount(championCount);
  await expect(page.getByText('0 partidas con ganador · 4 pendientes')).toBeVisible();
  await page.unroute('**/api/stats/champions');
  await page.getByRole('button', { name: 'Actualizar clasificación' }).click();
  await expect(page.getByRole('list', { name: 'Clasificación de campeones por victorias' }).getByRole('listitem')).toHaveCount(championCount);
});
