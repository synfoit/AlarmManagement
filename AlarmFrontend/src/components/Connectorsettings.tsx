// src/pages/ConnectorSettings.tsx
import React, { JSX, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings, X } from 'lucide-react';
import { createCrudApi } from '../features/lib/createCrudApi';
import SelectDropdown from '../features/ui/SelectDropdown';

/* -------------------------------------------------------------------------- */
/* Theme classes                                                              */
/* -------------------------------------------------------------------------- */
const INPUT_CLS =
  'h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200';
const LABEL_CLS = 'text-xs text-slate-500';
const BTN_SECONDARY =
  'h-8 rounded border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
const BTN_PRIMARY =
  'h-8 rounded bg-sky-600 px-3 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
type NumberOption = {
  value: number;
  label: string;
};

/* -------------------------------------------------------------------------- */
/* Static InputType options — ids start from 0                                */
/* -------------------------------------------------------------------------- */
const INPUT_TYPES = [
  { id: 0, label: 'Table Monitor', key: 'SqlPoll' },
  { id: 1, label: 'SQL CDC', key: 'SqlCdc' },
  { id: 2, label: 'OPC A&E', key: 'Opc' },
  { id: 3, label: 'MQTT', key: 'Mqtt' },
  { id: 4, label: 'REST', key: 'Rest' },
  { id: 5, label: 'File', key: 'File' },
] as const;

const INPUT_TYPE_OPTIONS: NumberOption[] = INPUT_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
}));

/* Collector Number options: 1 to 5 */
const COLLECTOR_NO_OPTIONS: NumberOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: n,
  label: String(n),
}));

const OPC_INPUT_TYPE = 2;
const OPC_URL_PREFIX = 'opcae://';

// Main tab(s) per InputType. OPC gets its own tab, others use Table Monitor.
const MAIN_TABS_BY_INPUT_TYPE: Record<number, string[]> = {
  0: ['Table Monitor'],
  1: ['Table Monitor'],
  2: ['OPC'],
  3: ['Table Monitor'],
  4: ['Table Monitor'],
  5: ['Table Monitor'],
};

const SUB_TABS = [
  'SQL Server Details',
  'SQL Select Statement',
  'Field Setup',
  'Settings',
  'Overrides',
] as const;
type SubTab = (typeof SUB_TABS)[number];

/* -------------------------------------------------------------------------- */
/* API DTO shapes                                                             */
/* -------------------------------------------------------------------------- */

// Shape stored *inside* connectionJson for a Table Monitor (SQL) source.
interface TableMonitorConnectionJson {
  DatabaseName: string;
  Server: string;
  TableName: string;
  SourceKeyColumn: string;
  UserName: string;
  Password: string;
  SeverName: string;
  IsWindowsAuthentication: boolean;
}

// GET /collector-configs/{id}
interface CollectorConfigDto {
  collectorId: number;
  collectorName: string;
  collectorNo?: number;
  sourceType: number;
  connectionJson: string;
  pollIntervalSeconds: number;
  batchSize: number;
  isActive: boolean;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

// POST /collector-configs and PUT /collector-configs/{id}
interface CollectorConfigRequest {
  collectorName: string;
  collectorNo: number;
  sourceType: number;
  connectionJson: string;
  pollIntervalSeconds: number;
  batchSize: number;
  isActive: boolean;
}

// GET /collector-configs/{id}/select-statement
interface SelectStatementDto {
  selectStatement: string;
}

interface SqlServerDetails {
  server: string;
  database: string;
  table: string;
  userName: string;
  password: string;
  timeoutSecs: number;
  authenticatedUser: boolean; // true => Windows Authentication
  sourceKeyColumn: string;
}

interface OpcDetails {
  host: string;
  progId: string;
}

interface ConnectorStatus {
  lastDatabasePoll: string;
  lastMessageRetrieved: string;
  lastRecordIdProcessed: string;
  connectionState: 'Connected' | 'Disconnected' | 'Unknown';
}

const emptySqlDetails: SqlServerDetails = {
  server: '',
  database: '',
  table: '',
  userName: '',
  password: '',
  timeoutSecs: 30,
  authenticatedUser: false,
  sourceKeyColumn: '',
};

const emptyOpcDetails: OpcDetails = {
  host: '',
  progId: '',
};

const emptyStatus: ConnectorStatus = {
  lastDatabasePoll: '-',
  lastMessageRetrieved: '-',
  lastRecordIdProcessed: '-',
  connectionState: 'Unknown',
};

/* opcae://{Host}/{ProgId}  ->  { host, progId } */
const parseOpcUrl = (value: string): OpcDetails | null => {
  const match = value.trim().match(/^opcae:\/\/([^/]+)\/(.*)$/i);
  if (!match) return null;
  return { host: match[1], progId: match[2] };
};

/* POST/PUT response ma thi id kadhva mate (alag alag shape handle kare) */
const extractCollectorId = (payload: any): number | null => {
  const candidates = [
    payload?.collectorId,
    payload?.id,
    payload?.data?.collectorId,
    payload?.data?.id,
    typeof payload === 'number' ? payload : undefined,
    typeof payload?.data === 'number' ? payload.data : undefined,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};

export default function ConnectorSettings(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const Api = React.useMemo(() => createCrudApi('collector-configs'), []);

  const [collectorNo, setCollectorNo] = useState<number>(1);
  const [connectorDescription, setConnectorDescription] = useState('');
  const [inputType, setInputType] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState(true);

  const [activeMainTab, setActiveMainTab] = useState<string>('Table Monitor');
  const [activeSubTab, setActiveSubTab] =
    useState<SubTab>('SQL Server Details');

  const [sqlDetails, setSqlDetails] =
    useState<SqlServerDetails>(emptySqlDetails);
  const [opcDetails, setOpcDetails] = useState<OpcDetails>(emptyOpcDetails);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState<number>(10);
  const [batchSize, setBatchSize] = useState<number>(5000);
  const [status, setStatus] = useState<ConnectorStatus>(emptyStatus);

  const [selectStatement, setSelectStatement] = useState<string>('');

  const [collectorId, setCollectorId] = useState<number | null>(
    isEdit ? Number(id) : null
  );
  // Details must be saved before the other SQL sub-tabs unlock
  const [detailsSaved, setDetailsSaved] = useState<boolean>(isEdit);

  // true when a connection field is edited after the last save/load
  const [connectionDirty, setConnectionDirty] = useState(false);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const isOpc = inputType === OPC_INPUT_TYPE;
  const mainTabs = MAIN_TABS_BY_INPUT_TYPE[inputType] ?? ['Table Monitor'];

  const selectedInputType = useMemo<NumberOption | null>(
    () => INPUT_TYPE_OPTIONS.find((o) => o.value === inputType) ?? null,
    [inputType]
  );

  const selectedCollectorNo = useMemo<NumberOption | null>(
    () => COLLECTOR_NO_OPTIONS.find((o) => o.value === collectorNo) ?? null,
    [collectorNo]
  );

  /* ---------------------------------------------------------------------- */
  /* Close window                                                           */
  /* ---------------------------------------------------------------------- */
  const closeWindow = () => navigate(-1);

  // ESC closes the settings window (like a desktop dialog)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navigate]);

  /* ---------------------------------------------------------------------- */
  /* Select statement                                                       */
  /* GET /collector-configs/{id}/select-statement                           */
  /* ---------------------------------------------------------------------- */
  const fetchSelectStatement = async (targetId: number): Promise<boolean> => {
    try {
      const res = await Api.get(`${targetId}/select-statement`);
      const data = (res?.data ?? {}) as Partial<SelectStatementDto>;
      setSelectStatement(String(data.selectStatement ?? ''));
      return true;
    } catch (err) {
      console.error('Failed to load select statement:', err);
      return false;
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Load existing connector config in edit mode                           */
  /* GET /collector-configs/{id}                                           */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await Api.get(`${id}`);
        const data = (res?.data ?? {}) as CollectorConfigDto;
        if (cancelled) return;

        const loadedType = Number(data.sourceType ?? 0);

        // collectorNo can come as camelCase or PascalCase
        const loadedNo = Number(
          data.collectorNo ?? (data as any).CollectorNo ?? 1
        );
        setCollectorNo(
          COLLECTOR_NO_OPTIONS.some((o) => o.value === loadedNo) ? loadedNo : 1
        );

        setConnectorDescription(String(data.collectorName ?? ''));
        setInputType(loadedType);
        setActiveMainTab(
          (MAIN_TABS_BY_INPUT_TYPE[loadedType] ?? ['Table Monitor'])[0]
        );
        setIsEnabled(Boolean(data.isActive ?? true));
        setPollIntervalSeconds(Number(data.pollIntervalSeconds ?? 10));
        setBatchSize(Number(data.batchSize ?? 5000));

        const rawConnection = String(data.connectionJson ?? '');

        if (loadedType === OPC_INPUT_TYPE) {
          // OPC -> plain string  opcae://{Host}/{ProgId}
          const parsed = parseOpcUrl(rawConnection);
          setOpcDetails(parsed ?? emptyOpcDetails);
        } else {
          // SQL -> JSON string
          let cj: Partial<TableMonitorConnectionJson> = {};
          try {
            cj = rawConnection ? JSON.parse(rawConnection) : {};
          } catch (parseErr) {
            console.error('Failed to parse connectionJson:', parseErr);
          }

          const loadedUser = String(cj.UserName ?? '');
          const loadedPassword = String(cj.Password ?? '');

          setSqlDetails({
            server: String(cj.Server ?? cj.SeverName ?? ''),
            database: String(cj.DatabaseName ?? ''),
            table: String(cj.TableName ?? ''),
            userName: loadedUser,
            password: loadedPassword,
            timeoutSecs: 30,
            // Use the saved flag; for old records without it, infer from
            // empty username & password
            authenticatedUser:
              typeof cj.IsWindowsAuthentication === 'boolean'
                ? cj.IsWindowsAuthentication
                : !loadedUser && !loadedPassword,
            sourceKeyColumn: String(
              cj.SourceKeyColumn ?? (cj as any).sourceKeyColumn ?? ''
            ),
          });
        }

        const loadedId = Number(data.collectorId ?? id);
        setCollectorId(loadedId);
        setDetailsSaved(true);
        setConnectionDirty(false);

        // Pre-load the select statement so the tab is ready (non-OPC only)
        if (loadedType !== OPC_INPUT_TYPE) {
          await fetchSelectStatement(loadedId);
        }
      } catch (err) {
        console.error('Failed to load connector configuration:', err);
        Swal.fire('Error', 'Failed to load connector configuration', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, Api]);

  const handleSqlFieldChange =
    (field: keyof SqlServerDetails) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value, type, checked } = e.target;
      // timeout does not affect the connection; everything else (incl.
      // Windows Authentication) does
      if (field !== 'timeoutSecs') {
        setConnectionDirty(true);
      }
      setSqlDetails((prev) => ({
        ...prev,
        [field]:
          type === 'checkbox'
            ? checked
            : field === 'timeoutSecs'
              ? Number(value === '' ? 0 : Number(value))
              : value,
      }));
    };

  const handleOpcFieldChange =
    (field: keyof OpcDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setConnectionDirty(true);
      setOpcDetails((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleInputTypeChange = (option: NumberOption | null) => {
    if (!option) return;
    setConnectionDirty(true);
    setInputType(option.value);
    setActiveMainTab(
      (MAIN_TABS_BY_INPUT_TYPE[option.value] ?? ['Table Monitor'])[0]
    );
    setActiveSubTab('SQL Server Details');
  };

  const handleCollectorNoChange = (option: NumberOption | null) => {
    if (!option) return;
    setCollectorNo(option.value);
  };

  /* ---------------------------------------------------------------------- */
  /* connectionJson builder                                                 */
  /*  - OPC : opcae://{Host}/{ProgId}                                       */
  /*  - SQL : JSON string (user/password empty for Windows Authentication)  */
  /* ---------------------------------------------------------------------- */
  const buildConnectionJsonString = (): string => {
    if (isOpc) {
      return `${OPC_URL_PREFIX}${opcDetails.host.trim()}/${opcDetails.progId.trim()}`;
    }

    const useWindowsAuth = sqlDetails.authenticatedUser;

    const connectionJson: TableMonitorConnectionJson = {
      DatabaseName: sqlDetails.database,
      Server: sqlDetails.server,
      TableName: sqlDetails.table,
      SourceKeyColumn: sqlDetails.sourceKeyColumn,
      UserName: useWindowsAuth ? '' : sqlDetails.userName,
      Password: useWindowsAuth ? '' : sqlDetails.password,
      SeverName: sqlDetails.server,
      IsWindowsAuthentication: useWindowsAuth,
    };
    return JSON.stringify(connectionJson);
  };

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* POST /collector-configs (create) or PUT /collector-configs/{id} (edit) */
  /* then GET /collector-configs/{id}/select-statement                      */
  /* ---------------------------------------------------------------------- */
  const handleSave = async () => {
    if (!collectorNo) {
      Swal.fire('Validation', 'Collector Number is required', 'warning');
      return;
    }

    if (!connectorDescription.trim()) {
      Swal.fire('Validation', 'Connector Description is required', 'warning');
      return;
    }

    if (isOpc) {
      if (!opcDetails.host.trim() || !opcDetails.progId.trim()) {
        Swal.fire('Validation', 'Host and Prog ID are required', 'warning');
        return;
      }
    } else if (
      !sqlDetails.server ||
      !sqlDetails.database ||
      !sqlDetails.table
    ) {
      Swal.fire(
        'Validation',
        'MS SQL Server, Database and Table are required',
        'warning'
      );
      return;
    }

    setLoading(true);
    try {
      const payload: CollectorConfigRequest = {
        collectorName: connectorDescription.trim(),
        collectorNo: Number(collectorNo),
        sourceType: Number(inputType),
        connectionJson: buildConnectionJsonString(),
        pollIntervalSeconds: Number(pollIntervalSeconds) || 0,
        batchSize: Number(batchSize) || 0,
        isActive: isEnabled,
      };

      const wasUpdate = Boolean(collectorId);

      const res = collectorId
        ? await Api.put(`${collectorId}`, payload)
        : await Api.post('', payload);

      let savedId: number | null = extractCollectorId(res?.data) ?? collectorId;

      // Response ma id na male to list mathi name thi shodhi lo (fallback)
      if (!savedId) {
        try {
          const listRes = await Api.get<any>('data?includeInactive=false');
          const raw = listRes?.data;
          const list: Array<{ collectorId: number; collectorName: string }> =
            Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
          const name = connectorDescription.trim().toLowerCase();
          const matches = list.filter(
            (c) => (c.collectorName || '').trim().toLowerCase() === name
          );
          if (matches.length) {
            savedId = Math.max(...matches.map((c) => Number(c.collectorId)));
          }
        } catch (lookupErr) {
          console.error('Failed to resolve collectorId:', lookupErr);
        }
      }

      if (savedId) setCollectorId(savedId);

      setDetailsSaved(true);
      setConnectionDirty(false);

      // Load select statement after add/edit save (SQL sources only)
      let statementLoaded = false;
      if (savedId && !isOpc) {
        statementLoaded = await fetchSelectStatement(savedId);
      }

      await Swal.fire(
        'Success',
        wasUpdate ? 'Configuration updated' : 'Configuration saved',
        'success'
      );

      if (statementLoaded) {
        setActiveSubTab('SQL Select Statement');
      }
    } catch (err) {
      console.error('Save failed:', err);
      Swal.fire('Error', 'Failed to save connector configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Save select statement -> archive                                       */
  /* GET /collector-configs/{id}/archive-data-sql                           */
  /*     ?collectorName=...&selectquery=...                                 */
  /* ---------------------------------------------------------------------- */
  const handleSaveSelectStatement = async () => {
    const targetId = collectorId ?? (id ? Number(id) : null);

    if (!targetId) {
      Swal.fire('Validation', 'Please save the details first', 'warning');
      return;
    }
    if (!selectStatement.trim()) {
      Swal.fire('Validation', 'SQL Select Statement is required', 'warning');
      return;
    }

    setArchiving(true);
    try {
      const query =
        `id=${targetId}&` +
        `collectorName=${encodeURIComponent(connectorDescription.trim())}` +
        `&selectquery=${encodeURIComponent(selectStatement.trim())}`;

      const res = await Api.get(`archive-data-sql?${query}`);
      const message =
        (res?.data as { message?: string })?.message ??
        'Archive operation completed.';

      Swal.fire('Success', message, 'success');
    } catch (err: any) {
      console.error('Archive failed:', err);
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to save select statement';
      Swal.fire('Error', message, 'error');
    } finally {
      setArchiving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Test Connection -> /collector-configs/{id}/test-connection             */
  /* ---------------------------------------------------------------------- */
  const handleTestConnection = async () => {
    if (!collectorId) {
      Swal.fire('Validation', 'Please save the details first', 'warning');
      return;
    }
    setTesting(true);
    try {
      const res = await Api.get(`${collectorId}/test-connection`);
      const message =
        (res?.data as { message?: string })?.message ?? 'Connection successful';
      setStatus((prev) => ({ ...prev, connectionState: 'Connected' }));
      Swal.fire('Success', message, 'success');
    } catch (err) {
      console.error('Test connection failed:', err);
      setStatus((prev) => ({ ...prev, connectionState: 'Disconnected' }));
      Swal.fire('Error', 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Delete -> DELETE /collector-configs/{id}                               */
  /* ---------------------------------------------------------------------- */
  const handleDelete = async () => {
    if (!collectorId) return;
    const confirm = await Swal.fire({
      title: 'Delete connector?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
    });
    if (!confirm.isConfirmed) return;

    setDeleting(true);
    try {
      await Api.delete(`${collectorId}`);
      Swal.fire('Deleted', 'Connector configuration deleted', 'success');
      navigate(-1);
    } catch (err) {
      console.error('Delete failed:', err);
      Swal.fire('Error', 'Failed to delete connector configuration', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const isSubTabLocked = (tab: SubTab) =>
    tab !== 'SQL Server Details' && !detailsSaved;

  // Test works on the *saved* config, so it needs a saved id and no unsaved edits
  const canTest = Boolean(collectorId) && !connectionDirty;
  const testHint = !collectorId
    ? 'Save the details first to enable Test'
    : connectionDirty
      ? 'Save your changes to test the updated connection'
      : '';

  const statusBarClass =
    status.connectionState === 'Connected'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status.connectionState === 'Disconnected'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-50 text-slate-500 border-slate-200';

  return (
    /* ------------------------------------------------------------------ */
    /* BACKDROP                                                           */
    /* ------------------------------------------------------------------ */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      {/* ---------------------------------------------------------------- */}
      {/* SETTINGS WINDOW                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connector Settings"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-visible rounded-md border border-slate-300 bg-white shadow-2xl"
      >
        {/* ------------------------------------------------------------ */}
        {/* TITLE BAR                                                    */}
        {/* ------------------------------------------------------------ */}
        <div className="flex h-10 shrink-0 items-center justify-between rounded-t-md border-b border-slate-300 bg-slate-100 pl-3 select-none">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-sky-600" />

            <span className="text-xs font-semibold text-slate-700">
              Connector Settings
            </span>
          </div>

          <div className="flex h-full items-center">
            {/* {isEdit && collectorId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="mr-3 text-xs font-medium text-red-600 transition hover:text-red-800 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}

            <label className="mr-3 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 accent-sky-600"
              />
              Enabled
            </label> */}

            <button
              type="button"
              onClick={closeWindow}
              title="Close"
              className="flex h-full w-11 items-center justify-center rounded-tr-md text-slate-500 transition hover:bg-red-600 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* BODY (scrollable)                                            */}
        {/* ------------------------------------------------------------ */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-b-md bg-slate-50 p-4">
          {/* Top form */}
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <label className={LABEL_CLS}>Collector Number</label>

                <SelectDropdown
                  label=""
                  options={COLLECTOR_NO_OPTIONS}
                  value={selectedCollectorNo}
                  onChange={(option) =>
                    handleCollectorNoChange(option as NumberOption | null)
                  }
                />
              </div>

              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <label className={LABEL_CLS}>Connector Description</label>

                <input
                  type="text"
                  name="connectorDescription"
                  value={connectorDescription}
                  onChange={(e) => setConnectorDescription(e.target.value)}
                  placeholder="Connector 1"
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                <label className={LABEL_CLS}>Input Type</label>

                <SelectDropdown
                  label=""
                  options={INPUT_TYPE_OPTIONS}
                  value={selectedInputType}
                  onChange={(option) =>
                    handleInputTypeChange(option as NumberOption | null)
                  }
                />
              </div>
            </div>
          </div>

          {/* Main tab */}
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-8 w-fit overflow-hidden rounded border border-slate-300">
              {mainTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveMainTab(tab)}
                  className={`h-full border-r border-slate-300 px-3 text-xs font-medium transition last:border-r-0 ${
                    activeMainTab === tab
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {isOpc && activeMainTab === 'OPC' && (
              <OpcContent
                opcDetails={opcDetails}
                onOpcFieldChange={handleOpcFieldChange}
                onSave={handleSave}
                onCancel={closeWindow}
                onTestConnection={handleTestConnection}
                canTest={canTest}
                testHint={testHint}
                status={status}
                statusBarClass={statusBarClass}
                loading={loading}
                testing={testing}
              />
            )}

            {!isOpc && activeMainTab === 'Table Monitor' && (
              <TableMonitorContent
                activeSubTab={activeSubTab}
                setActiveSubTab={setActiveSubTab}
                isSubTabLocked={isSubTabLocked}
                sqlDetails={sqlDetails}
                onSqlFieldChange={handleSqlFieldChange}
                pollIntervalSeconds={pollIntervalSeconds}
                setPollIntervalSeconds={setPollIntervalSeconds}
                batchSize={batchSize}
                setBatchSize={setBatchSize}
                selectStatement={selectStatement}
                setSelectStatement={setSelectStatement}
                onSaveSelectStatement={handleSaveSelectStatement}
                onSaveSqlDetails={handleSave}
                onCancel={closeWindow}
                onTestConnection={handleTestConnection}
                canTest={canTest}
                testHint={testHint}
                status={status}
                statusBarClass={statusBarClass}
                loading={loading}
                testing={testing}
                archiving={archiving}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared form actions: Test (left) | Cancel + Save & Add (right)             */
/* -------------------------------------------------------------------------- */
interface FormActionsProps {
  onTest: () => void;
  onCancel: () => void;
  onSave: () => void;
  canTest: boolean;
  testHint: string;
  testing: boolean;
  loading: boolean;
}

function FormActions({
  onTest,
  onCancel,
  onSave,
  canTest,
  testHint,
  testing,
  loading,
}: FormActionsProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: Test (only after save) */}
      <div className="flex items-center gap-2">
        <span title={!canTest ? testHint : 'Test the saved connection'}>
          <button
            type="button"
            onClick={onTest}
            disabled={!canTest || testing}
            className={BTN_PRIMARY}
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </span>
        {!canTest && (
          <span className="text-[11px] italic text-slate-400">{testHint}</span>
        )}
      </div>

      {/* Right: Cancel + Save & Add */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} className={BTN_SECONDARY}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className={BTN_PRIMARY}
        >
          {loading ? 'Saving...' : 'Save & Add'}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OPC content — only Host + Prog ID                                          */
/* -------------------------------------------------------------------------- */
interface OpcContentProps {
  opcDetails: OpcDetails;
  onOpcFieldChange: (
    field: keyof OpcDetails
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  onTestConnection: () => void;
  canTest: boolean;
  testHint: string;
  status: ConnectorStatus;
  statusBarClass: string;
  loading: boolean;
  testing: boolean;
}

function OpcContent({
  opcDetails,
  onOpcFieldChange,
  onSave,
  onCancel,
  onTestConnection,
  canTest,
  testHint,
  status,
  statusBarClass,
  loading,
  testing,
}: OpcContentProps): JSX.Element {
  const preview =
    opcDetails.host.trim() || opcDetails.progId.trim()
      ? `${OPC_URL_PREFIX}${opcDetails.host.trim()}/${opcDetails.progId.trim()}`
      : '';

  return (
    <div className="space-y-4">
      <fieldset className="rounded-md border border-slate-200 px-4 pb-4 pt-2">
        <legend className="px-1 text-xs font-medium text-slate-500">
          OPC Details
        </legend>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <LabeledField label="Host">
            <input
              type="text"
              name="host"
              value={opcDetails.host}
              onChange={onOpcFieldChange('host')}
              placeholder="e.g. 192.168.1.10"
              className={INPUT_CLS}
            />
          </LabeledField>

          <LabeledField label="Prog ID">
            <input
              type="text"
              name="progId"
              value={opcDetails.progId}
              onChange={onOpcFieldChange('progId')}
              placeholder="e.g. Matrikon.OPC.Simulation.1"
              className={INPUT_CLS}
            />
          </LabeledField>
        </div>

        {preview && (
          <div className="mt-3 text-[10px] text-slate-400">
            Connection: <span className="text-slate-500">{preview}</span>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">Status</span>
        <div
          className={`flex-1 rounded border py-1.5 text-center text-xs font-medium ${statusBarClass}`}
        >
          {status.connectionState}
        </div>
      </div>

      <FormActions
        onTest={onTestConnection}
        onCancel={onCancel}
        onSave={onSave}
        canTest={canTest}
        testHint={testHint}
        testing={testing}
        loading={loading}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table Monitor content — 5 sub-tabs, first one drives the rest              */
/* -------------------------------------------------------------------------- */
interface TableMonitorContentProps {
  activeSubTab: SubTab;
  setActiveSubTab: (tab: SubTab) => void;
  isSubTabLocked: (tab: SubTab) => boolean;
  sqlDetails: SqlServerDetails;
  onSqlFieldChange: (
    field: keyof SqlServerDetails
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  pollIntervalSeconds: number;
  setPollIntervalSeconds: (n: number) => void;
  batchSize: number;
  setBatchSize: (n: number) => void;
  selectStatement: string;
  setSelectStatement: (value: string) => void;
  onSaveSelectStatement: () => void;
  onSaveSqlDetails: () => void;
  onCancel: () => void;
  onTestConnection: () => void;
  canTest: boolean;
  testHint: string;
  status: ConnectorStatus;
  statusBarClass: string;
  loading: boolean;
  testing: boolean;
  archiving: boolean;
}

function TableMonitorContent({
  activeSubTab,
  setActiveSubTab,
  isSubTabLocked,
  sqlDetails,
  onSqlFieldChange,
  pollIntervalSeconds,
  setPollIntervalSeconds,
  batchSize,
  setBatchSize,
  selectStatement,
  setSelectStatement,
  onSaveSelectStatement,
  onSaveSqlDetails,
  onCancel,
  onTestConnection,
  canTest,
  testHint,
  status,
  statusBarClass,
  loading,
  testing,
  archiving,
}: TableMonitorContentProps): JSX.Element {
  return (
    <div>
      <div className="mb-4 flex flex-wrap border-b border-slate-200">
        {SUB_TABS.map((tab) => {
          const locked = isSubTabLocked(tab);
          const active = activeSubTab === tab;
          return (
            <button
              key={tab}
              type="button"
              disabled={locked}
              onClick={() => !locked && setActiveSubTab(tab)}
              title={locked ? 'Save SQL Server Details first' : undefined}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition ${
                active
                  ? 'border-sky-600 font-medium text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              } ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'SQL Server Details' && (
        <div className="space-y-4">
          <fieldset className="rounded-md border border-slate-200 px-4 pb-4 pt-2">
            <legend className="px-1 text-xs font-medium text-slate-500">
              SQL Server Details
            </legend>

            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <LabeledField label="MS SQL Server">
                <input
                  type="text"
                  name="server"
                  value={sqlDetails.server}
                  onChange={onSqlFieldChange('server')}
                  placeholder="e.g. SSL-PRD\SQLEXPRESS"
                  className={INPUT_CLS}
                />
              </LabeledField>

              {/* Hidden when Windows Authentication is ticked */}
              {!sqlDetails.authenticatedUser && (
                <>
                  <LabeledField label="User Name">
                    <input
                      type="text"
                      name="userName"
                      value={sqlDetails.userName}
                      onChange={onSqlFieldChange('userName')}
                      placeholder="sa"
                      className={INPUT_CLS}
                    />
                  </LabeledField>

                  <LabeledField label="Password">
                    <input
                      type="password"
                      name="password"
                      value={sqlDetails.password}
                      onChange={onSqlFieldChange('password')}
                      className={INPUT_CLS}
                    />
                  </LabeledField>
                </>
              )}

              <LabeledField label="Database">
                <input
                  type="text"
                  name="database"
                  value={sqlDetails.database}
                  onChange={onSqlFieldChange('database')}
                  placeholder="e.g. Alarms_History_T1"
                  className={INPUT_CLS}
                />
              </LabeledField>

              <LabeledField label="Timeout (Secs)">
                <input
                  type="number"
                  min={0}
                  name="timeoutSecs"
                  value={sqlDetails.timeoutSecs}
                  onChange={onSqlFieldChange('timeoutSecs')}
                  className={`${INPUT_CLS} !w-24`}
                />
              </LabeledField>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={sqlDetails.authenticatedUser}
                    onChange={onSqlFieldChange('authenticatedUser')}
                    className="h-4 w-4 accent-sky-600"
                  />
                  Windows Authentication
                </label>
              </div>

              <LabeledField label="Table">
                <input
                  type="text"
                  name="table"
                  value={sqlDetails.table}
                  onChange={onSqlFieldChange('table')}
                  placeholder="e.g. PVEvent"
                  className={INPUT_CLS}
                />
              </LabeledField>

              <LabeledField label="Source Key Column">
                <input
                  type="text"
                  name="sourceKeyColumn"
                  value={sqlDetails.sourceKeyColumn}
                  onChange={onSqlFieldChange('sourceKeyColumn')}
                  placeholder="e.g. EventId"
                  className={INPUT_CLS}
                />
              </LabeledField>
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-slate-200 px-4 pb-4 pt-2">
            <legend className="px-1 text-xs font-medium text-slate-500">
              Status
            </legend>

            <div className="space-y-1 text-xs text-slate-600">
              <div>Last Database Poll : {status.lastDatabasePoll}</div>
              <div>Last Message Retrieved : {status.lastMessageRetrieved}</div>
              <div>
                Last Record ID Processed : {status.lastRecordIdProcessed}
              </div>
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Status</span>

            <div
              className={`flex-1 rounded border py-1.5 text-center text-xs font-medium ${statusBarClass}`}
            >
              {status.connectionState}
            </div>
          </div>

          <FormActions
            onTest={onTestConnection}
            onCancel={onCancel}
            onSave={onSaveSqlDetails}
            canTest={canTest}
            testHint={testHint}
            testing={testing}
            loading={loading}
          />
        </div>
      )}

      {activeSubTab === 'SQL Select Statement' && (
        <div className="space-y-3">
          <fieldset className="rounded-md border border-slate-200 px-4 pb-4 pt-2">
            <legend className="px-1 text-xs font-medium text-slate-500">
              SQL Select Statement
            </legend>

            <textarea
              value={selectStatement}
              onChange={(e) => setSelectStatement(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder="SELECT ... FROM ..."
              className="w-full resize-y rounded border border-slate-300 bg-white p-2 font-mono text-xs text-slate-700 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
            />
          </fieldset>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveSelectStatement}
              disabled={archiving}
              className={BTN_PRIMARY}
            >
              {archiving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'Field Setup' && (
        <PlaceholderPanel text="Field mapping setup — implement once field list source is provided." />
      )}

      {activeSubTab === 'Settings' && (
        <div className="grid grid-cols-2 gap-6">
          <LabeledField label="Poll Interval (Secs)">
            <input
              type="number"
              min={0}
              value={pollIntervalSeconds}
              onChange={(e) =>
                setPollIntervalSeconds(Number(e.target.value) || 0)
              }
              className={`${INPUT_CLS} !w-32`}
            />
          </LabeledField>

          <LabeledField label="Batch Size">
            <input
              type="number"
              min={0}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 0)}
              className={`${INPUT_CLS} !w-32`}
            />
          </LabeledField>
        </div>
      )}

      {activeSubTab === 'Overrides' && (
        <PlaceholderPanel text="Field overrides configuration — implement here." />
      )}
    </div>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <label className={LABEL_CLS}>{label}</label>
      {children}
    </div>
  );
}

function PlaceholderPanel({ text }: { text: string }): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-slate-300 py-10 text-center text-xs italic text-slate-400">
      {text}
    </div>
  );
}
