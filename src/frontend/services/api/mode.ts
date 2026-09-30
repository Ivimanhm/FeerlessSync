export const mockMode = import.meta.env.DEV && import.meta.env.VITE_MOCK_DATA === 'true' && !import.meta.env.VITE_API_BASE_URL?.trim();
