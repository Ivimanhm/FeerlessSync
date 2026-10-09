import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 2560, height: 1370 }, { width: 1672, height: 941 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`portada y acceso a campeones a ${viewport.width}×${viewport.height}px`, async ({ page }, testInfo) => {
    const apiRequests: string[] = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeVisible();
    await expect(page.locator('.welcome-champions strong')).toHaveText(['Sett', 'Viego', 'Akali', 'Aphelios', 'Thresh']);
    await expect(page.locator('.welcome-features > li')).toHaveCount(3);
    await expect(page.getByRole('button')).toHaveCount(7);
    await expect(page.getByRole('link', { name: 'Descargar app' })).toHaveAttribute('href', 'https://github.com/Ivimanhm/PersoBuilder/releases');
    await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.decode())]));
    expect(await page.locator('.fearless-home').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const initialUrl = page.url();
    for (const button of await page.getByRole('button').filter({ hasNotText: /Comenzar ahora|cómo funciona/i }).all()) await button.click();
    expect(page.url()).toBe(initialUrl);
    expect(page.context().pages()).toHaveLength(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(apiRequests).toEqual([]);
    await page.locator('.fearless-home').evaluate(element => { element.scrollTop = 0; });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    await page.getByRole('button', { name: 'Comenzar ahora' }).click();
    await expect(page).toHaveURL(/#\/campeones$/);
    await expect(page.getByRole('region', { name: 'Campeones disponibles' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Campeones disponibles' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('region', { name: 'Campeones disponibles' })).toBeVisible();
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`explica Fearless en un modal a ${viewport.width}×${viewport.height}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Cómo funciona', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Cómo funciona' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Pasos de una serie Fearless' }).getByRole('listitem')).toHaveCount(4);
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText([
      'Empieza la serie', 'Se registran los campeones usados',
      'Se bloquean para la siguiente partida', 'Continúa hasta cerrar la serie',
    ]);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Cerrar cómo funciona' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Entendido' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cerrar cómo funciona' })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('how-it-works.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/$/);
    const watch = page.getByRole('button', { name: 'Ver cómo funciona' });
    await watch.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Entendido' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(watch).toBeFocused();
    await trigger.click();
    await dialog.getByRole('button', { name: 'Cerrar cómo funciona' }).click();
    await expect(dialog).toHaveCount(0);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);
  });
}

test('abre las releases en una nueva pestaña', async ({ page, context }) => {
  await context.route('https://github.com/Ivimanhm/PersoBuilder/releases', route => route.fulfill({ contentType: 'text/html', body: '<title>Releases</title>' }));
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Descargar app' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://github.com/Ivimanhm/PersoBuilder/releases');
  await expect(page.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeVisible();
  await popup.close();
});

test('consulta los equipos completos y guarda el ganador desde Historial', async ({ page, request }, testInfo) => {
  await page.goto('/#/historial');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('table', { name: 'Partida 1: equipos por posición' }).getByRole('row')).toHaveCount(6);
  const topRow = page.getByRole('table', { name: 'Partida 1: equipos por posición' }).getByRole('row', { name: /TOP/ });
  await expect(topRow).toContainText('Aatrox');
  await expect(topRow).toContainText('Darius');
  await expect(page.getByText('Ganador: Equipo Azul')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campeones utilizados' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('history.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Equipo Rojo' }).check();
  await dialog.getByLabel('Clave de administrador').fill('browser-test-token');
  await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Ganador: Equipo Rojo')).toBeVisible();
  const gameResponse = await request.get('http://127.0.0.1:8789/api/series/fearless-001/games/1');
  expect(gameResponse.status()).toBe(200);
  expect(await gameResponse.json()).toMatchObject({ winner: 'red' });
});

test('muestra serie no encontrada y permite volver a consultar', async ({ page }) => {
  await page.goto('/#/historial');
  await expect(page.getByRole('table')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cambiar serie' }).click();
  await page.getByRole('textbox', { name: 'ID de serie' }).fill('missing');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No hay datos de esta serie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Borrar partidas', exact: true })).toHaveCount(0);
});

test('borra las partidas con la confirmación de Sites y conserva la serie', async ({ page, request }) => {
  await page.goto('/#/historial');
  await expect(page.getByRole('table')).toHaveCount(2);
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
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Esperando la primera partida' })).toBeVisible();
  const seriesResponse = await request.get('http://127.0.0.1:8789/api/series/fearless-001');
  expect(seriesResponse.status()).toBe(200);
  expect(await seriesResponse.json()).toMatchObject({ seriesId: 'fearless-001', games: [], usedChampions: [] });
});
