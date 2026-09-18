// src/pages/ConnectorSettings.tsx
import React, { JSX, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { createCrudApi } from '../features/lib/createCrudApi';
import TextInput from '../features/ui/TextInput';

/* -------------------------------------------------------------------------- */
/* Static InputType options — ids start from 0 as requested                   */
/* -------------------------------------------------------------------------- */
const INPUT_TYPES = [
  { id: 0, label: 'SQL Poll', key: 'SqlPoll' },
  { id: 1, label: 'SQL CDC', key: 'SqlCdc' },
  { id: 2, label: 'OPC', key: 'Opc' },
  { id: 3, label: 'MQTT', key: 'Mqtt' },
  { id: 4, label: 'REST', key: 'Rest' },
  { id: 5, label: 'File', key: 'File' },
] as const;

// Currently only "Table Monitor" content is implemented (per requirement).
// When other input types get their own content later, add an entry here
// keyed by the InputType id and swap <TableMonitorContent /> accordingly.
const MAIN_TABS_BY_INPUT_TYPE: Record<number, string[]> = {
  0: ['Table Monitor'],
  1: ['Table Monitor'],
  2: ['Table Monitor'],
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
/* API DTO shapes — matches the actual backend contract                       */
/* -------------------------------------------------------------------------- */

// The shape stored *inside* connectionJson for a Table Monitor (SQL) source.
// Other input types (Opc/Mqtt/Rest/File) will have their own connectionJson
// shape later — parse/stringify accordingly when those are implemented.
interface TableMonitorConnectionJson {
  DatabaseName: string;
  Server: string;
  TableName: string;
  sourceKeyColumn: string;
  UserName: string;
  Password: string;
  SeverName: string;
}

// Raw row as returned by GET /collector-configs and GET /collector-configs/{id}
// NOTE: connectionJson comes back as a JSON *string*, not an object.
interface CollectorConfigDto {
  collectorId: number;
  collectorName: string;
  sourceType: number;
  connectionJson: string;
  pollIntervalSeconds: number;
  batchSize: number;
  isActive: boolean;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

// Body for POST /collector-configs (create) and PUT /collector-configs/{id} (update)
interface CollectorConfigRequest {
  collectorName: string;
  sourceType: number;
  connectionJson: string;
  pollIntervalSeconds: number;
  batchSize: number;
  isActive: boolean;
}

interface SqlServerDetails {
  server: string;
  database: string;
  table: string;
  userName: string;
  password: string;
  timeoutSecs: number;
  authenticatedUser: boolean;
  sourceKeyColumn: string;
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

const emptyStatus: ConnectorStatus = {
  lastDatabasePoll: '-',
  lastMessageRetrieved: '-',
  lastRecordIdProcessed: '-',
  connectionState: 'Unknown',
};

export default function ConnectorSettings(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const Api = React.useMemo(() => createCrudApi('collector-configs'), []);

  const [connectorNumber, setConnectorNumber] = useState<number>(1);
  const [connectorDescription, setConnectorDescription] = useState('');
  const [inputType, setInputType] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState(true);

  const [presetOptions, setPresetOptions] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  const [activeMainTab, setActiveMainTab] = useState<string>('Table Monitor');
  const [activeSubTab, setActiveSubTab] =
    useState<SubTab>('SQL Server Details');

  const [sqlDetails, setSqlDetails] =
    useState<SqlServerDetails>(emptySqlDetails);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState<number>(10);
  const [batchSize, setBatchSize] = useState<number>(5000);
  const [status, setStatus] = useState<ConnectorStatus>(emptyStatus);

  const [collectorId, setCollectorId] = useState<number | null>(
    isEdit ? Number(id) : null
  );
  // The SQL Server Details tab must be saved before the other tabs unlock
  const [detailsSaved, setDetailsSaved] = useState<boolean>(isEdit);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mainTabs = MAIN_TABS_BY_INPUT_TYPE[inputType] ?? ['Table Monitor'];

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

        setConnectorDescription(String(data.collectorName ?? ''));
        setInputType(Number(data.sourceType ?? 0));
        setIsEnabled(Boolean(data.isActive ?? true));
        setPollIntervalSeconds(Number(data.pollIntervalSeconds ?? 10));
        setBatchSize(Number(data.batchSize ?? 5000));

        // connectionJson is a JSON string — parse it before use
        let cj: Partial<TableMonitorConnectionJson> = {};
        try {
          cj = data.connectionJson ? JSON.parse(data.connectionJson) : {};
        } catch (parseErr) {
          console.error('Failed to parse connectionJson:', parseErr);
        }

        setSqlDetails({
          server: String(cj.Server ?? cj.SeverName ?? ''),
          database: String(cj.DatabaseName ?? ''),
          table: String(cj.TableName ?? ''),
          userName: String(cj.UserName ?? ''),
          password: String(cj.Password ?? ''),
          timeoutSecs: 30,
          authenticatedUser: false,
          sourceKeyColumn: String(cj.sourceKeyColumn ?? ''),
        });

        setCollectorId(Number(data.collectorId ?? id));
        setDetailsSaved(true);
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

  /* ---------------------------------------------------------------------- */
  /* Presets — placeholder loader, wire to real endpoint when available     */
  /* ---------------------------------------------------------------------- */
  //   useEffect(() => {
  //     let cancelled = false;
  //     (async () => {
  //       try {
  //         const res = await Api.get('presets');
  //         const data = (res?.data ?? []) as string[] | { presets?: string[] };
  //         const arr = Array.isArray(data)
  //           ? data
  //           : Array.isArray(data?.presets)
  //             ? data.presets
  //             : [];
  //         if (cancelled) return;
  //         setPresetOptions((arr ?? []).map((p: any) => String(p)));
  //       } catch {
  //         // Presets endpoint may not exist yet — fail silently, keep UI usable
  //       }
  //     })();
  //     return () => {
  //       cancelled = true;
  //     };
  //     // eslint-disable-next-line react-hooks/exhaustive-deps
  //   }, []);

  const handleLoadPreset = () => {
    if (!selectedPreset) {
      Swal.fire('Validation', 'Please select a preset first', 'warning');
      return;
    }
    // TODO: wire actual preset -> form field mapping once preset payload shape is known
    Swal.fire('Info', `Preset "${selectedPreset}" loaded`, 'success');
  };

  const handleSqlFieldChange =
    (field: keyof SqlServerDetails) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value, type, checked } = e.target;
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

  const buildConnectionJsonString = (): string => {
    const connectionJson: TableMonitorConnectionJson = {
      DatabaseName: sqlDetails.database,
      Server: sqlDetails.server,
      TableName: sqlDetails.table,
      sourceKeyColumn: sqlDetails.sourceKeyColumn,
      UserName: sqlDetails.userName,
      Password: sqlDetails.password,
      SeverName: sqlDetails.server,
    };
    return JSON.stringify(connectionJson);
  };

  /* ---------------------------------------------------------------------- */
  /* Save SQL Server Details                                                */
  /* POST /collector-configs (create) or PUT /collector-configs/{id} (edit) */
  /* ---------------------------------------------------------------------- */
  const handleSaveSqlDetails = async () => {
    if (!connectorDescription.trim()) {
      Swal.fire('Validation', 'Connector Description is required', 'warning');
      return;
    }
    if (!sqlDetails.server || !sqlDetails.database || !sqlDetails.table) {
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
        sourceType: Number(inputType),
        connectionJson: buildConnectionJsonString(),
        pollIntervalSeconds: Number(pollIntervalSeconds) || 0,
        batchSize: Number(batchSize) || 0,
        isActive: isEnabled,
      };

      const res = collectorId
        ? await Api.put(`${collectorId}`, payload)
        : await Api.post('', payload);

      const savedData = (res?.data ?? {}) as Partial<CollectorConfigDto>;
      const savedId = Number(savedData.collectorId ?? collectorId ?? 0) || null;
      if (savedId) setCollectorId(savedId);

      setDetailsSaved(true);
      Swal.fire(
        'Success',
        collectorId ? 'Configuration updated' : 'Configuration saved',
        'success'
      );
    } catch (err) {
      console.error('Save failed:', err);
      Swal.fire('Error', 'Failed to save connector configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Test Connection -> POST /collector-configs/{id}/test-connection        */
  /* ---------------------------------------------------------------------- */
  const handleTestConnection = async () => {
    if (!collectorId) {
      Swal.fire(
        'Validation',
        'Please save the SQL Server details first',
        'warning'
      );
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

  const handleApply = async () => {
    await handleSaveSqlDetails();
  };

  const isSubTabLocked = (tab: SubTab) =>
    tab !== 'SQL Server Details' && !detailsSaved;

  const statusBarColor =
    status.connectionState === 'Connected'
      ? 'bg-green-300'
      : status.connectionState === 'Disconnected'
        ? 'bg-red-300'
        : 'bg-gray-200';

  return (
    <div className="bg-white border border-gray-300 rounded shadow-sm w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800">
          Connector Settings
        </h1>
        <div className="flex items-center gap-4">
          {isEdit && collectorId && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Enabled
          </label>
        </div>
      </div>

      {/* Top form row */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-6 py-5">
        <div className="space-y-4">
          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <label className="text-sm text-gray-700">Connector Number</label>
            <select
              value={connectorNumber}
              onChange={(e) => setConnectorNumber(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <label className="text-sm text-gray-700">
              Connector Description
            </label>
            <TextInput
              name="connectorDescription"
              value={connectorDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setConnectorDescription(e.target.value)
              }
              placeholder="Connector 1"
            />
          </div>

          <div className="grid grid-cols-[160px_1fr] items-center gap-3">
            <label className="text-sm text-gray-700">Input Type</label>
            <select
              value={inputType}
              onChange={(e) => {
                setInputType(Number(e.target.value));
                setActiveMainTab('Table Monitor');
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {INPUT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === 0 ? 'Table Monitor' : t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Presets */}
        {/* <fieldset className="border border-gray-300 rounded px-3 pt-2 pb-3">
          <legend className="text-xs text-gray-600 px-1">Presets</legend>
          <div className="flex gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- select --</option>
              {presetOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleLoadPreset}
              className="px-4 py-1 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
            >
              Load
            </button>
          </div>
        </fieldset> */}
      </div>

      {/* Main tab (currently only Table Monitor) */}
      <div className="px-6">
        <div className="flex border-b border-gray-300">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveMainTab(tab)}
              className={`px-4 py-1.5 text-sm border border-b-0 rounded-t ${
                activeMainTab === tab
                  ? 'bg-white border-gray-300 font-medium text-gray-900 -mb-px'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="border border-gray-300 rounded-b rounded-tr p-4">
          {activeMainTab === 'Table Monitor' && (
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
              onSaveSqlDetails={handleSaveSqlDetails}
              onTestConnection={handleTestConnection}
              status={status}
              statusBarColor={statusBarColor}
              loading={loading}
              testing={testing}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-6 py-4">
        <button
          type="button"
          onClick={handleApply}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() =>
            Swal.fire(
              'Help',
              'Configure the connector settings and test the connection before closing.',
              'info'
            )
          }
          className="px-4 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
        >
          Help
        </button>
      </div>
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
  onSaveSqlDetails: () => void;
  onTestConnection: () => void;
  status: ConnectorStatus;
  statusBarColor: string;
  loading: boolean;
  testing: boolean;
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
  onSaveSqlDetails,
  onTestConnection,
  status,
  statusBarColor,
  loading,
  testing,
}: TableMonitorContentProps): JSX.Element {
  return (
    <div>
      <div className="flex border-b border-gray-200 mb-4">
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
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${
                active
                  ? 'border-blue-600 text-blue-700 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              } ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'SQL Server Details' && (
        <div className="space-y-4">
          <fieldset className="border border-gray-300 rounded px-4 pt-2 pb-4">
            <legend className="text-xs text-gray-600 px-1">
              SQL Server Details
            </legend>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <LabeledField label="MS SQL Server">
                <TextInput
                  name="server"
                  value={sqlDetails.server}
                  onChange={onSqlFieldChange('server')}
                  placeholder="e.g. SSL-PRD\SQLEXPRESS"
                />
              </LabeledField>

              <LabeledField label="User Name">
                <TextInput
                  name="userName"
                  value={sqlDetails.userName}
                  onChange={onSqlFieldChange('userName')}
                  placeholder="sa"
                />
              </LabeledField>

              <LabeledField label="Password">
                <input
                  type="password"
                  name="password"
                  value={sqlDetails.password}
                  onChange={onSqlFieldChange('password')}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </LabeledField>

              <LabeledField label="Database">
                <TextInput
                  name="database"
                  value={sqlDetails.database}
                  onChange={onSqlFieldChange('database')}
                  placeholder="e.g. Alarms_History_T1"
                />
              </LabeledField>

              <LabeledField label="Timeout (Secs)">
                <input
                  type="number"
                  min={0}
                  name="timeoutSecs"
                  value={sqlDetails.timeoutSecs}
                  onChange={onSqlFieldChange('timeoutSecs')}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </LabeledField>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sqlDetails.authenticatedUser}
                    onChange={onSqlFieldChange('authenticatedUser')}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Authenticated User
                </label>
              </div>

              <LabeledField label="Table">
                <TextInput
                  name="table"
                  value={sqlDetails.table}
                  onChange={onSqlFieldChange('table')}
                  placeholder="e.g. PVEvent"
                />
              </LabeledField>

              <LabeledField label="Source Key Column">
                <TextInput
                  name="sourceKeyColumn"
                  value={sqlDetails.sourceKeyColumn}
                  onChange={onSqlFieldChange('sourceKeyColumn')}
                  placeholder="e.g. EventId"
                />
              </LabeledField>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={onTestConnection}
                  disabled={testing}
                  className="px-4 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-gray-300 rounded px-4 pt-2 pb-4">
            <legend className="text-xs text-gray-600 px-1">Status</legend>
            <div className="text-sm text-gray-700 space-y-1">
              <div>Last Database Poll : {status.lastDatabasePoll}</div>
              <div>Last Message Retrieved : {status.lastMessageRetrieved}</div>
              <div>
                Last Record ID Processed : {status.lastRecordIdProcessed}
              </div>
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Status</span>
            <div
              className={`flex-1 text-center text-sm font-medium py-1.5 rounded ${statusBarColor}`}
            >
              {status.connectionState}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSaveSqlDetails}
              disabled={loading}
              className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save & Add'}
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'SQL Select Statement' && (
        <PlaceholderPanel text="SQL Select Statement builder — implement once query editor requirements are provided." />
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
              className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </LabeledField>
          <LabeledField label="Batch Size">
            <input
              type="number"
              min={0}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 0)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
      <label className="text-sm text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function PlaceholderPanel({ text }: { text: string }): JSX.Element {
  return (
    <div className="text-sm text-gray-500 italic py-10 text-center border border-dashed border-gray-300 rounded">
      {text}
    </div>
  );
}
