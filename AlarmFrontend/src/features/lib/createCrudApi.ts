import axios from 'axios';

const getAuthToken = () => localStorage.getItem('authToken');

export function createCrudApi(resource: string) {
  const getBaseUrl = () => {
    const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL;

    if (!apiBaseUrl) {
      throw new Error(
        'API_BASE_URL is not available. Please make sure config.json is loaded.'
      );
    }

    return `${apiBaseUrl.replace(/\/+$/, '')}/${resource}`;
  };

  const getUrl = (path = '') =>
    `${getBaseUrl()}/${path.replace(/^\/+/, '')}`.replace(/\/$/, '');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    get: <T>(path = '') => axios.get<T>(getUrl(path), getConfig()),

    post: <T>(path: string, data: any) =>
      axios.post<T>(getUrl(path), data, getConfig()),

    put: <T>(path: string, data: any) =>
      axios.put<T>(getUrl(path), data, getConfig()),

    delete: <T>(path: string) => axios.delete<T>(getUrl(path), getConfig()),
  };
}
