import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IS_MOCK = (import.meta as any).env?.VITE_MOCK === 'true';

export const bclClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

bclClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.detail ?? error.message ?? 'Unknown error';
    return Promise.reject(new Error(msg));
  }
);
