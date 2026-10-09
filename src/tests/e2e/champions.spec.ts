import { expect, test } from '@playwright/test';
import catalog from '../../frontend/data/championCatalog.json' with { type: 'json' };

const usedChampions = catalog.champions.slice(-70).map(champion => champion.id);
const exampleSeries = {
  success: true,
  seriesId: 'fearless-001',
  updatedAt: '2026-10-04T19:55:00Z',
  usedChampions,
  games: Array.from({ length: 7 }, (_, index) => ({
    gameNumber: index + 1,
    blueTeam: usedChampions.slice(index * 10, index * 10 + 5),
    redTeam: usedChampions.slice(index * 10 + 5, index * 10 + 10),
    createdAt: '2026-10-04T19:55:00Z',
  })),
};

for (const viewport of [{ width: 1672, height: 941 }, { width: 1366, height: 768 }, { width: 1366, height: 620 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`Campeones: diseño y filtros a ${viewport.width}×${viewport.height}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/series/*', route => route.fulfill({ json: { ...exampleSeries, seriesId: decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!) } }));
    await page.goto('/#/campeones');
    const scroll = page.getByRole('region', { name: 'Campeones disponibles' });
    await expect(scroll.locator('.champion-card')).toHaveCount(103);
    await expect(page.locator('.stat-copy strong')).toHaveText(['7', '70', '103']);
    await expect(page.getByRole('textbox', { name: 'ID de serie' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0);
    await expect(page.locator('.champion-card .portrait-image--loaded').first()).toBeVisible();
    await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.querySelectorAll<HTMLImageElement>('.champion-card img[loading=eager]')).map(image => image.decode())]));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width >= 781) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
      const metrics = await scroll.evaluate(element => ({ height: element.clientHeight, total: element.scrollHeight }));
      expect(metrics.height).toBeGreaterThan(160);
      expect(metrics.total).toBeGreaterThan(metrics.height);
    }
    await page.screenshot({ path: testInfo.outputPath('champions.png'), fullPage: true, animations: 'disabled' });
    await expect(page.locator('.champion-card img').first()).toHaveCSS('opacity', '1');
    await scroll.scrollIntoViewIfNeeded();
    await scroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.getByRole('textbox', { name: 'Buscar campeón' }).fill('Ahri');
    await expect(scroll.locator('.champion-card')).toHaveCount(1);
    await page.getByRole('combobox', { name: 'Filtrar por posición' }).selectOption('TOP');
    await expect(scroll.getByText('No hay campeones que coincidan con la búsqueda.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Filtrar por posición' }).selectOption('MID');
    await expect(scroll.locator('.champion-card')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Buscar campeón' }).fill('');
    await page.getByRole('combobox', { name: 'Filtrar por posición' }).selectOption('Todos');
    await page.getByRole('button', { name: 'Cambiar serie' }).click();
    await page.getByRole('textbox', { name: 'ID de serie' }).fill('fearless-002');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cambiar serie' })).toContainText('fearless-002');
    await page.getByRole('button', { name: 'Cambiar serie' }).click();
    const menuButton = page.getByRole('button', { name: 'Abrir menú' });
    const menu = page.getByRole('dialog', { name: 'Menú principal' });
    await menuButton.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Cerrar menú' })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('menu.png'), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await page.mouse.click(viewport.width - 5, 100);
    await expect(menu).toHaveCount(0);
    await menuButton.click();
    await menu.getByRole('button', { name: 'Historial' }).click();
    await expect(page).toHaveURL(/#\/historial$/);
    await expect(menu).toHaveCount(0);
    await menuButton.click();
    await menu.getByRole('button', { name: 'Campeones' }).click();
    await expect(page).toHaveURL(/#\/campeones$/);
    await expect(menu).toHaveCount(0);
    await menuButton.click();
    await menu.getByRole('button', { name: 'Cerrar menú', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await page.getByRole('button', { name: 'Borrar partidas', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar serie', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
}
