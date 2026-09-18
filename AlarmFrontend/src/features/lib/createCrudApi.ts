// src/lib/createCrudApi.ts
import axios from 'axios';

const getAuthToken = () => localStorage.getItem('authToken');

export function createCrudApi(resource: string) {
  const baseUrl = `${window.APP_CONFIG?.API_BASE_URL ?? ''}${resource}`;

  const authHeaders = () => ({
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    get: <T>(path = '') => axios.get<T>(`${baseUrl}/${path}`, authHeaders()),
    post: <T>(path: string, data: any) =>
      axios.post<T>(`${baseUrl}/${path}`, data, authHeaders()),
    put: <T>(path: string, data: any) =>
      axios.put<T>(`${baseUrl}/${path}`, data, authHeaders()),
    delete: <T>(path: string) =>
      axios.post<T>(`${baseUrl}/${path}`, authHeaders()),
  };
}
