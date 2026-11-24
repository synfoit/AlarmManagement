import * as signalR from '@microsoft/signalr';

import type {
  AlarmConnectionState,
  AlarmEvent,
  AlarmSignalRSnapshot,
  AlarmSummary,
} from '../interfaces/alarmModels';

type Listener = () => void;

const ALARMS_EVENT = 'AlarmsUpdated';
const SUMMARY_EVENT = 'SummaryUpdated';
const COLLECTOR_EVENT = 'CollectorUpdated';

/* Set to false once everything works */
const DEBUG_SIGNALR = true;

const RETRY_DELAYS = [0, 2000, 5000, 10000, 30000];

/* Never gives up: after the last delay it keeps retrying every 30s */
const reconnectPolicy: signalR.IRetryPolicy = {
  nextRetryDelayInMilliseconds: (ctx) =>
    RETRY_DELAYS[Math.min(ctx.previousRetryCount, RETRY_DELAYS.length - 1)],
};

export interface AlarmCollectorFilter {
  collectorId: number | null;
  collectorName: string;
}

interface ActiveSubscription {
  collectorId: number;
  collectorName: string;
}

/* ------------------------------------------------------------------ */
/* Logger: makes "event name not registered" problems visible          */
/* ------------------------------------------------------------------ */

const signalRLogger: signalR.ILogger = {
  log(level, message) {
    if (message.includes('No client method with the name')) {
      console.error(
        '[AlarmSignalRService] SERVER SENT AN EVENT THE CLIENT DOES NOT LISTEN TO ->',
        message
      );
      return;
    }

    if (level >= signalR.LogLevel.Error) {
      console.error('[SignalR]', message);
    } else if (level >= signalR.LogLevel.Warning) {
      console.warn('[SignalR]', message);
    } else if (DEBUG_SIGNALR && level >= signalR.LogLevel.Information) {
      console.info('[SignalR]', message);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getSignalRHubUrl(): string {
  const apiBaseUrl =
    typeof window !== 'undefined' ? window.APP_CONFIG?.API_BASE_URL : undefined;

  if (!apiBaseUrl) {
    throw new Error(
      'API_BASE_URL is not available. Please make sure config.json is loaded.'
    );
  }

  const serverBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');

  return `${serverBaseUrl}/hubs/alarms`;
}

function toSubscription(
  collector: AlarmCollectorFilter
): ActiveSubscription | null {
  if (collector.collectorId === null || !collector.collectorName.trim()) {
    return null;
  }

  return {
    collectorId: collector.collectorId,
    collectorName: collector.collectorName,
  };
}

function subscriptionKey(sub: ActiveSubscription | null): string {
  return sub ? `${sub.collectorName}|${sub.collectorId}` : '';
}

/* If the server sends JSON as a string, parse it */
function parsePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;

  const text = payload.trim();

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return payload;
    }
  }

  return payload;
}

const ALARM_LIST_KEYS = ['alarms', 'Alarms', 'data', 'Data', 'items', 'rows'];
const WRAPPER_KEYS = ['data', 'Data', 'result', 'Result', 'payload', 'Payload'];

function extractAlarms(payload: unknown, depth = 0): AlarmEvent[] | null {
  const value = parsePayload(payload);

  if (Array.isArray(value)) {
    return value as AlarmEvent[];
  }

  if (typeof value === 'object' && value !== null && depth < 2) {
    const obj = value as Record<string, unknown>;

    for (const key of ALARM_LIST_KEYS) {
      const inner = parsePayload(obj[key]);

      if (Array.isArray(inner)) {
        return inner as AlarmEvent[];
      }
    }

    for (const key of WRAPPER_KEYS) {
      const inner = parsePayload(obj[key]);

      if (typeof inner === 'object' && inner !== null) {
        const found = extractAlarms(inner, depth + 1);

        if (found !== null) return found;
      }
    }
  }

  return null;
}

function extractSummary(payload: unknown): AlarmSummary | null {
  const value = parsePayload(payload);

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    const inner = parsePayload(obj.summary ?? obj.Summary);

    if (typeof inner === 'object' && inner !== null) {
      return inner as AlarmSummary;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

class AlarmSignalRService {
  private hubConnection?: signalR.HubConnection;

  private alarms: AlarmEvent[] = [];

  private summary: AlarmSummary | null = null;

  private connectionState: AlarmConnectionState = 'Disconnected';

  private lastUpdatedAt: string | null = null;

  private desired: ActiveSubscription | null = null;

  private subscribed: ActiveSubscription | null = null;

  private syncChain: Promise<void> = Promise.resolve();

  private readonly listeners = new Set<Listener>();

  private reconnectTimer?: ReturnType<typeof setTimeout>;

  private syncRetryTimer?: ReturnType<typeof setTimeout>;

  private manualDisconnect = false;

  private snapshot: AlarmSignalRSnapshot = {
    alarms: [],
    summary: null,
    connectionState: 'Disconnected',
    lastUpdatedAt: null,
  };

  /* ============================================================ */
  /* Subscribe (React store) */
  /* ============================================================ */

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  /* ============================================================ */
  /* React external-store snapshot */
  /* ============================================================ */

  getSnapshot = (): AlarmSignalRSnapshot => {
    return this.snapshot;
  };

  getServerSnapshot = (): AlarmSignalRSnapshot => {
    return this.snapshot;
  };

  /* ============================================================ */
  /* Notify React */
  /* ============================================================ */

  private notify() {
    this.snapshot = {
      alarms: this.alarms,
      summary: this.summary,
      connectionState: this.connectionState,
      lastUpdatedAt: this.lastUpdatedAt,
    };

    this.listeners.forEach((listener) => listener());
  }

  /* ============================================================ */
  /* Connection state */
  /* ============================================================ */

  private setConnectionState(state: AlarmConnectionState) {
    this.connectionState = state;
    this.notify();
  }

  /* ============================================================ */
  /* Auto reconnect (when automatic reconnect gives up / start fails) */
  /* ============================================================ */

  private scheduleReconnect(delay = 5000) {
    if (this.manualDisconnect || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private scheduleSyncRetry(delay = 3000) {
    if (this.syncRetryTimer) return;

    this.syncRetryTimer = setTimeout(() => {
      this.syncRetryTimer = undefined;
      this.queueSync();
    }, delay);
  }

  /* ============================================================ */
  /* Incoming data (one place for all events)                      */
  /* ============================================================ */

  private handleIncoming(eventName: string, args: unknown[]) {
    if (DEBUG_SIGNALR) {
      console.log(
        `[AlarmSignalRService-sunita] <- ${eventName}`,
        new Date().toLocaleTimeString(),
        args
      );
    }

    let alarms: AlarmEvent[] | null = null;
    let summary: AlarmSummary | null = null;

    /* the server may send several arguments, check all of them */
    for (const arg of args) {
      if (alarms === null) alarms = extractAlarms(arg);
      if (summary === null) summary = extractSummary(arg);
    }

    /* SummaryUpdated may send the summary object directly */
    if (eventName === SUMMARY_EVENT && summary === null) {
      const direct = parsePayload(args[0]);

      if (
        typeof direct === 'object' &&
        direct !== null &&
        !Array.isArray(direct)
      ) {
        summary = direct as AlarmSummary;
      }
    }

    if (alarms === null && summary === null) {
      if (DEBUG_SIGNALR) {
        console.warn(
          `[AlarmSignalRService] ${eventName}: payload shape not recognised, ignored`,
          args
        );
      }
      return;
    }

    if (alarms !== null) {
      this.alarms = alarms;
    }

    if (summary !== null) {
      this.summary = summary;
    }

    this.lastUpdatedAt = new Date().toISOString();

    this.notify();
  }

  /* ============================================================ */
  /* Resync (tab visible / internet back) -> latest data */
  /* ============================================================ */

  resync() {
    if (!this.desired || this.manualDisconnect) return;

    this.syncChain = this.syncChain
      .then(async () => {
        const connection = this.hubConnection;

        if (
          !connection ||
          connection.state === signalR.HubConnectionState.Disconnected
        ) {
          void this.connect();
          return;
        }

        if (connection.state !== signalR.HubConnectionState.Connected) return;

        const wanted = this.desired;

        if (!wanted) return;

        /* Re-subscribe: server sends the snapshot again */
        await connection.invoke(
          'Subscribe',
          wanted.collectorName,
          wanted.collectorId
        );

        this.subscribed = wanted;
      })
      .catch((error) => {
        console.error('[AlarmSignalRService] resync failed:', error);
      });
  }

  /* ============================================================ */
  /* Hub Subscribe / Unsubscribe sync */
  /* ============================================================ */

  private queueSync() {
    this.syncChain = this.syncChain
      .then(() => this.syncSubscription())
      .catch((error) => {
        console.error('[AlarmSignalRService] sync failed:', error);
      });
  }

  private async syncSubscription(): Promise<void> {
    const connection = this.hubConnection;

    if (
      !connection ||
      connection.state !== signalR.HubConnectionState.Connected
    ) {
      return;
    }

    const wantedKey = subscriptionKey(this.desired);
    const currentKey = subscriptionKey(this.subscribed);

    if (wantedKey === currentKey) {
      return;
    }

    /* Jooni collector ma thi unsubscribe */
    if (this.subscribed) {
      const previous = this.subscribed;

      this.subscribed = null;

      try {
        await connection.invoke(
          'Unsubscribe',
          previous.collectorName,
          previous.collectorId
        );
      } catch (error) {
        console.error('[AlarmSignalRService] Unsubscribe failed:', error);
      }
    }

    this.alarms = [];
    this.summary = null;
    this.lastUpdatedAt = null;
    this.notify();

    /* Navi collector ma subscribe */
    if (this.desired) {
      const next = this.desired;

      try {
        await connection.invoke(
          'Subscribe',
          next.collectorName,
          next.collectorId
        );

        this.subscribed = next;
      } catch (error) {
        console.error('[AlarmSignalRService] Subscribe failed:', error);

        /* retry */
        this.scheduleSyncRetry();
      }
    }
  }

  /* ============================================================ */
  /* Connect */
  /* ============================================================ */

  /*
   * connect()                 -> last selected collector vapre (Connect button)
   * connect({ id, name })     -> collector set kare; connection hoy to
   *                              fakt subscription badle
   */
  async connect(collector?: AlarmCollectorFilter): Promise<void> {
    this.manualDisconnect = false;

    this.clearReconnectTimer();

    if (collector) {
      this.desired = toSubscription(collector);
    }

    if (this.hubConnection) {
      const state = this.hubConnection.state;

      if (state === signalR.HubConnectionState.Connected) {
        this.queueSync();
        return;
      }

      if (
        state === signalR.HubConnectionState.Connecting ||
        state === signalR.HubConnectionState.Reconnecting
      ) {
        /* Connected thase tyare sync thase */
        return;
      }
    }

    const hubUrl = getSignalRHubUrl();

    this.setConnectionState('Connecting');

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: true,
        /* remove this line once the server accepts access_token for WebSockets */
        transport: signalR.HttpTransportType.LongPolling,
        accessTokenFactory: () => localStorage.getItem('authToken') ?? '',
      })
      .withAutomaticReconnect(reconnectPolicy)
      .configureLogging(signalRLogger)
      .build();

    connection.keepAliveIntervalInMilliseconds = 15000;
    connection.serverTimeoutInMilliseconds = 45000;

    this.hubConnection = connection;

    this.subscribed = null;

    const isCurrent = () => this.hubConnection === connection;

    connection.on(COLLECTOR_EVENT, (...args: unknown[]) => {
      if (!isCurrent()) return;

      this.handleIncoming(COLLECTOR_EVENT, args);
    });

    connection.on(ALARMS_EVENT, (...args: unknown[]) => {
      if (!isCurrent()) return;

      this.handleIncoming(ALARMS_EVENT, args);
    });

    connection.on(SUMMARY_EVENT, (...args: unknown[]) => {
      if (!isCurrent()) return;

      this.handleIncoming(SUMMARY_EVENT, args);
    });

    connection.onreconnecting(() => {
      if (!isCurrent()) return;

      this.subscribed = null;

      this.setConnectionState('Reconnecting');
    });

    connection.onreconnected(() => {
      if (!isCurrent()) return;

      this.setConnectionState('Connected');

      this.queueSync();
    });

    connection.onclose(() => {
      if (!isCurrent()) return;

      this.subscribed = null;

      this.setConnectionState('Disconnected');

      this.scheduleReconnect();
    });

    try {
      await connection.start();

      if (!isCurrent()) {
        await connection.stop();
        return;
      }

      this.setConnectionState('Connected');

      this.queueSync();
    } catch (error) {
      console.error('[AlarmSignalRService] connection failed:', error);

      if (isCurrent()) {
        this.setConnectionState('Disconnected');

        this.scheduleReconnect();
      }
    }
  }

  /* ============================================================ */
  /* Disconnect */
  /* ============================================================ */

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;

    this.clearReconnectTimer();

    if (this.syncRetryTimer) {
      clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = undefined;
    }

    const connection = this.hubConnection;

    this.hubConnection = undefined;
    this.subscribed = null;

    if (connection) {
      try {
        await connection.stop();
      } catch (error) {
        console.error('[AlarmSignalRService] disconnect failed:', error);
      }
    }

    this.setConnectionState('Disconnected');
  }
}

export const alarmSignalRService = new AlarmSignalRService();

/* ============================================================ */
/* Tab visible / internet back -> get latest data */
/* ============================================================ */

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      alarmSignalRService.resync();
    }
  });

  window.addEventListener('online', () => alarmSignalRService.resync());
}
