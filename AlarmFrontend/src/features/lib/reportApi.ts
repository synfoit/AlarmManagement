function getAppConfig() {
  const w = window as any;
  return w.APP_CONFIG ?? w.aap_cofig ?? {};
}

export function getReportBaseUrl(): string {
  const config = getAppConfig();

  return config?.API_BASE_URL;
}

export function buildReportUrl(
  endpoint: string,
  queryParams: Record<string, string | number | boolean | undefined>
) {
  const baseUrl = getReportBaseUrl().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const params = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.append(key, String(value));
    }
  });

  const queryString = params.toString();
  return `${baseUrl}${cleanEndpoint}${queryString ? `?${queryString}` : ''}`;
}

export async function fetchReportBlob(
  endpoint: string,
  queryParams: Record<string, string | number | boolean | undefined>,
  token?: string | null
): Promise<Response> {
  const url = buildReportUrl(endpoint, queryParams);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    let message = 'Report generate issue..';
    try {
      const text = await response.text();
      if (text?.trim()) message = text.trim();
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export function getFilenameFromDisposition(
  response: Response,
  fallbackName: string
) {
  const disposition = response.headers.get('content-disposition');
  if (!disposition) return fallbackName;

  const utf8Match = disposition.match(/filename\*\=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (simpleMatch?.[1]) return simpleMatch[1];

  return fallbackName;
}
