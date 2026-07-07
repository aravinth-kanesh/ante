// Stored in localStorage for simplicity. A future hardening step would move this
// to an httpOnly cookie to reduce exposure to XSS.
const KEY = "token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);
