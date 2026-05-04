import axios from 'axios';

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
