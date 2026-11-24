// src/features/lib/criticalAlarmSignalRService.ts

import * as signalR from '@microsoft/signalr';

import type { CriticalConnectionState } from './criticalAlarmModels';

/*
 * Hub URL live dashboard ni jem config.json (window.APP_CONFIG.API_BASE_URL)
 * mathi aave chhe: "https://<ip>:<port>/api"  ->  "https://<ip>:<port><HUB_PATH>"
 *
 * HUB_PATH = backend Program.cs ma  app.MapHub<NotificationHub>("<aa string>")  ma je lakhyu chhe te.
 */
const HUB_PATH = '/notificationHub';
const HUB_EVENT = 'CriticalAlarm';

/* Set to false once everything works */
const DEBUG_SIGNALR = true;

const RETRY_DELAYS = [0, 2000, 5000, 10000, 30000];
const START_RETRY_DELAY_MS = 5000;

/* Never gives up: after the last delay it keeps retrying every 30s */
const reconnectPolicy: signalR.IRetryPolicy = {
  nextRetryDelayInMilliseconds: (ctx) =>
    RETRY_DELAYS[Math.min(ctx.previousRetryCount, RETRY_DELAYS.length - 1)],
};

/*
 * Backend NotificationHub:
 *   public Task JoinTable(string tableName) =>
 *       Groups.AddToGroupAsync(Context.ConnectionId, $"table-{tableName}");
 *   public Task LeaveTable(string tableName) => ...RemoveFromGroupAsync...
 *
 * tableName = "<collectorName>_<collectorId>"  ->  "ConnectorRockwellDB_11"
 */
const SUBSCRIBE_METHOD = 'JoinTable';
const UNSUBSCRIBE_METHOD = 'LeaveTable';
const STORAGE_KEY = 'criticalCollectorKeys';

/** "ConnectorRockwellDB" + 11 -> "ConnectorRockwellDB_11" */
export function buildCollectorKey(
  collectorName: string,
  collectorId: number
): string {
  console.log('buildCollectorKey', collectorName, collectorId);
  return `${collectorName.trim()}_${collectorId}`;
}

interface Handlers {
  onAlarm: (payload: unknown) => void;
  onStateChange: (state: CriticalConnectionState) => void;
}

/* ------------------------------------------------------------------ */
/* Logger */
/* ------------------------------------------------------------------ */

const signalRLogger: signalR.ILogger = {
  log(level, message) {
    if (message.includes('No client method with the name')) {
      console.error(
        '[CriticalAlarmSignalR] SERVER SENT AN EVENT THE CLIENT DOES NOT LISTEN TO ->',
        message
      );
      return;
    }

    if (level >= signalR.LogLevel.Error) {
      console.error('[SignalR:critical]', message);
    } else if (level >= signalR.LogLevel.Warning) {
      console.warn('[SignalR:critical]', message);
    } else if (DEBUG_SIGNALR && level >= signalR.LogLevel.Information) {
      console.info('[SignalR:critical]', message);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function getHubUrl(): string {
  const apiBaseUrl =
    typeof window !== 'undefined' ? window.APP_CONFIG?.API_BASE_URL : undefined;

  if (!apiBaseUrl) {
    throw new Error(
      'API_BASE_URL is not available. Please make sure config.json is loaded.'
    );
  }

  const serverBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');

  return `${serverBaseUrl}${HUB_PATH}`;
}

/* ------------------------------------------------------------------ */
/* Service state */
/* ------------------------------------------------------------------ */

let connection: signalR.HubConnection | null = null;
let handlers: Handlers | null = null;
let shouldRun = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopping: Promise<void> | null = null;

/* Subscribed collectors (refresh pachhi pan yaad rakhva localStorage ma) */
function loadSavedKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string')
      : [];
  } catch {
    return [];
  }
}

const subscriptions = new Set<string>(loadSavedKeys());

function persistKeys() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...subscriptions]));
  } catch {
    /* storage unavailable - ignore */
  }
}

function setState(state: CriticalConnectionState) {
  handlers?.onStateChange(state);
}

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/* Ek table (collector) na group ma join (repeat safe) */
async function joinTable(key: string): Promise<void> {
  const conn = connection;

  if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;

  try {
    await conn.invoke(SUBSCRIBE_METHOD, key);

    if (DEBUG_SIGNALR) {
      console.info(`[CriticalAlarmSignalR] subscribed -> ${key}`);
    }
  } catch (error) {
    console.error(
      `[CriticalAlarmSignalR] ${SUBSCRIBE_METHOD} failed (${key}):`,
      error
    );
  }
}

/* Connected / reconnected thay tyare badha collectors fari join karo */
async function syncSubscriptions(): Promise<void> {
  for (const key of [...subscriptions]) {
    await joinTable(key);
  }
}

/*
 * withAutomaticReconnect fakt ek var connect thayaa pachhi j kaam kare chhe.
 * Pehli start fail thay (server down / config.json haju load nathi thayu)
 * to aa retry fari try kare chhe.
 */
function scheduleRetry(delay = START_RETRY_DELAY_MS) {
  if (!shouldRun || retryTimer) return;

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, delay);
}

function buildConnection(hubUrl: string): signalR.HubConnection {
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      withCredentials: true,
      /* live dashboard ni jem; server access_token WebSockets ma accept kare tyare aa line kadhi nakho */
      transport: signalR.HttpTransportType.LongPolling,
      accessTokenFactory: () => localStorage.getItem('authToken') ?? '',
    })
    .withAutomaticReconnect(reconnectPolicy)
    .configureLogging(signalRLogger)
    .build();

  conn.keepAliveIntervalInMilliseconds = 15000;
  conn.serverTimeoutInMilliseconds = 45000;

  const isCurrent = () => connection === conn;

  conn.on(HUB_EVENT, (...args: unknown[]) => {
    if (!isCurrent()) return;

    if (DEBUG_SIGNALR) {
      console.log(
        `[CriticalAlarmSignalR] <- ${HUB_EVENT}`,
        new Date().toLocaleTimeString(),
        args
      );
    }

    /* Server ek arg (alarm) mokle chhe; badha args handle karo */
    args.forEach((arg) => handlers?.onAlarm(arg));
  });

  conn.onreconnecting(() => {
    if (isCurrent()) setState('Reconnecting');
  });

  conn.onreconnected(() => {
    if (!isCurrent()) return;

    setState('Connected');
    void syncSubscriptions();
  });

  conn.onclose(() => {
    if (!isCurrent()) return;

    setState('Disconnected');
    scheduleRetry();
  });

  return conn;
}

async function connect(): Promise<void> {
  if (!shouldRun) return;

  if (stopping) await stopping;
  if (!shouldRun) return;

  if (!connection) {
    try {
      connection = buildConnection(getHubUrl());
    } catch (error) {
      console.error('[CriticalAlarmSignalR] cannot build connection:', error);
      setState('Disconnected');
      scheduleRetry();
      return;
    }
  }

  const conn = connection;

  /* Connecting / Connected / Reconnecting hoy to kai karvanu nathi */
  if (conn.state !== signalR.HubConnectionState.Disconnected) return;

  clearRetry();
  setState('Connecting');

  try {
    await conn.start();

    if (connection === conn) {
      setState('Connected');
      void syncSubscriptions();
    }
  } catch (error) {
    /* stop() chaalu start vache aavi hoy to e normal chhe, ignore */
    if (!shouldRun || connection !== conn) return;

    console.error('[CriticalAlarmSignalR] connection failed:', error);
    setState('Disconnected');
    scheduleRetry();
  }
}

/* ------------------------------------------------------------------ */
/* Public API */
/* ------------------------------------------------------------------ */

export const criticalAlarmSignalRService = {
  /** Handlers register kari ne connection chalu kare. */
  start(nextHandlers: Handlers): Promise<void> {
    handlers = nextHandlers;
    shouldRun = true;
    return connect();
  },

  /** Collector subscribe (key = buildCollectorKey(name, id)). Connect thay tyare apoapo join thase. */
  subscribe(key: string): Promise<void> {
    const trimmed = key.trim();
    if (!trimmed) return Promise.resolve();

    if (!subscriptions.has(trimmed)) {
      subscriptions.add(trimmed);
      persistKeys();
    }

    return joinTable(trimmed);
  },

  async unsubscribe(key: string): Promise<void> {
    const trimmed = key.trim();

    subscriptions.delete(trimmed);
    persistKeys();

    const conn = connection;

    if (conn?.state === signalR.HubConnectionState.Connected) {
      try {
        await conn.invoke(UNSUBSCRIBE_METHOD, trimmed);
      } catch (error) {
        console.error('[CriticalAlarmSignalR] Unsubscribe failed:', error);
      }
    }
  },

  /** Manual "Connect" button mate. */
  connect(): Promise<void> {
    shouldRun = true;
    clearRetry();
    return connect();
  },

  /** Tab visible / internet back -> disconnected hoy to turant reconnect. */
  resync(): void {
    if (!shouldRun) return;

    clearRetry();
    void connect();
  },

  async stop(): Promise<void> {
    shouldRun = false;
    clearRetry();

    const conn = connection;
    connection = null;

    if (!conn) return;

    stopping = conn
      .stop()
      .catch(() => undefined)
      .finally(() => {
        stopping = null;
      });

    await stopping;
  },
};

/* ------------------------------------------------------------------ */
/* Tab visible / internet back -> reconnect immediately */
/* ------------------------------------------------------------------ */

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      criticalAlarmSignalRService.resync();
    }
  });

  window.addEventListener('online', () => criticalAlarmSignalRService.resync());
}
