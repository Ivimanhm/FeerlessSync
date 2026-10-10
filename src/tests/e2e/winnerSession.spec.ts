import { expect, test } from '@playwright/test';

const api = 'http://127.0.0.1:8789/api';

for (const viewport of [{ width: 1500, height: 900 }, { width: 390, height: 844 }]) {
  test(`recuerda y olvida la clave de ganador a ${viewport.width}px`, async ({ page, request, context }, testInfo) => {
    const seriesId = `session-${crypto.randomUUID()}`;
    expect((await request.post(`${api}/series`, { data: { seriesId } })).ok()).toBe(true);
    expect((await request.post(`${api}/series/${seriesId}/games`, { data: {
      gameNumber: 1, blueTeam: [266, 32, 103, 523, 12], redTeam: [122, 131, 84, 22, 201],
    } })).ok()).toBe(true);
    await page.route('**/api/series?*', route => route.fulfill({ json: { success: true, series: [{ seriesId }], total: 1 } }));
    await page.setViewportSize(viewport);
    await page.goto('/#/historial');
    await page.getByRole('button', { name: 'Seleccionar ganador de la partida 1' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Equipo Azul', exact: true }).check();
    await dialog.getByLabel('Clave de administrador').fill('wrong-key');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('La clave de administrador no es válida.');
    expect((await context.cookies()).some(cookie => cookie.name === 'fearless_winner_session')).toBe(false);

    await dialog.getByLabel('Clave de administrador').fill('browser-test-token');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog).toHaveCount(0);
    const cookie = (await context.cookies()).find(cookie => cookie.name === 'fearless_winner_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api' });
    expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 24 * 60 * 60);
    expect(cookie!.value).not.toContain('browser-test-token');

    await page.reload();
    await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
    await expect(dialog.getByText('Clave recordada en este navegador')).toBeVisible();
    await expect(dialog.getByLabel('Clave de administrador')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('remembered-winner.png') });
    await dialog.getByRole('radio', { name: 'Equipo Rojo', exact: true }).check();
    const update = page.waitForRequest(req => req.url().endsWith('/winner') && req.method() === 'PUT');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    expect((await update).headers()['authorization']).toBeUndefined();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Ganador: Equipo Rojo')).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar ganador de la partida 1' }).click();
    await expect(dialog.getByText('Clave recordada en este navegador')).toBeVisible();
    await context.clearCookies();
    await dialog.getByRole('radio', { name: 'Sin ganador' }).check();
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog.getByRole('alert')).toContainText('La sesión ha caducado');
    await dialog.getByLabel('Clave de administrador').fill('browser-test-token');
    await dialog.getByRole('button', { name: 'Guardar ganador' }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Seleccionar ganador de la partida 1' }).click();
    await expect(dialog.getByText('Clave recordada en este navegador')).toBeVisible();
    await dialog.getByRole('button', { name: 'Olvidar clave' }).click();
    await expect(dialog.getByLabel('Clave de administrador')).toBeVisible();
    expect((await context.cookies()).some(cookie => cookie.name === 'fearless_winner_session')).toBe(false);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'Seleccionar ganador de la partida 1' }).click();
    await expect(dialog.getByLabel('Clave de administrador')).toBeVisible();
    await expect(dialog.getByText('Clave recordada en este navegador')).toHaveCount(0);
  });
}
