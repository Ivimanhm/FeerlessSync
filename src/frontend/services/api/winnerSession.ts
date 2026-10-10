import { createFearlessApiClient } from './client';
import { mockMode } from './mode';

const mockCookieName = 'fearless_demo_winner_session';

function client() {
  return createFearlessApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || window.location.origin });
}

/** The demo remembers a flag only, never the entered key. Real sessions are HttpOnly cookies from the API. */
export function rememberMockWinnerSession(): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${mockCookieName}=1; Path=/; Max-Age=2592000; SameSite=Strict${secure}`;
}

export async function getWinnerSession(): Promise<boolean> {
  if (mockMode) return document.cookie.split(';').some(cookie => cookie.trim() === `${mockCookieName}=1`);
  const result = await client().getWinnerSession();
  return !!result && typeof result === 'object' && 'active' in result && result.active === true;
}

export async function forgetWinnerSession(): Promise<void> {
  if (mockMode) {
    document.cookie = `${mockCookieName}=; Path=/; Max-Age=0; SameSite=Strict`;
    return;
  }
  await client().forgetWinnerSession();
}
