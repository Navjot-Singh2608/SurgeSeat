import { realApi } from './real';
import { mockApi } from './mock';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// Pages import `api` and never know which implementation they got.
// Flip VITE_USE_MOCK to switch between the in-browser mock and the real backend.
export const api = USE_MOCK ? mockApi : realApi;

export { ApiError } from './errors';
export { setSessionExpiredHandler } from './client';
