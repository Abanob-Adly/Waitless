import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ── Request interceptor — attach access token ─────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("waitless_access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — refresh on 401 ────────────────────────────────────

let refreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (refreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (!newToken) return reject(err);
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      refreshing = true;
      try {
        const refreshToken = localStorage.getItem("waitless_refresh_token");
        if (!refreshToken) throw new Error("no refresh token");

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        // Refresh endpoint returns { accessToken, refreshToken } directly (no data wrapper)
        const newAccess: string = data.accessToken;
        const newRefresh: string = data.refreshToken;

        localStorage.setItem("waitless_access_token", newAccess);
        localStorage.setItem("waitless_refresh_token", newRefresh);

        refreshQueue.forEach((cb) => cb(newAccess));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        refreshQueue.forEach((cb) => cb(null));
        refreshQueue = [];
        localStorage.removeItem("waitless_access_token");
        localStorage.removeItem("waitless_refresh_token");
        localStorage.removeItem("waitless_user");
        window.dispatchEvent(new Event("auth:logout"));
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(err);
  },
);
