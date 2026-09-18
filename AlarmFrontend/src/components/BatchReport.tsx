import React, {
  JSX,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import SelectDropdown from '../features/ui/SelectDropdown';

type AreaOption = {
  value: string;
  label: string;
};

function getAppConfig() {
  const w = window as any;
  return w.APP_CONFIG ?? w.aap_cofig ?? {};
}

export default function BatchReport(): JSX.Element {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [areaValue, setAreaValue] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<AreaOption | null>(null);

  const [buttonLoading, setButtonLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const config = useMemo(() => getAppConfig(), []);
  const reportBaseUrl = config?.PIGGING_REPORT_URL ?? '';
  const reportAreaParamName = config?.PIGGING_REPORT_AREA_PARAM ?? 'Area';

  const areaOptions: AreaOption[] = useMemo(
    () => [
      { value: 'Unloading A', label: 'Unloading A' },
      { value: 'Unloading B', label: 'Unloading B' },
      { value: 'RM WO Plant B', label: 'RM WO Plant B' },
      { value: 'RM TO Plant A', label: 'RM TO Plant A' },
      { value: 'TO Header A Warehouse', label: 'TO Header A Warehouse' },
      { value: 'TO Header B Warehouse', label: 'TO Header B Warehouse' },
      { value: 'WO Header A Warehouse', label: 'WO Header A Warehouse' },
      { value: 'WO Header B Loading Area', label: 'WO Header B Loading Area' },
    ],
    []
  );

  useEffect(() => {
    if (!selectedOption && areaOptions.length) {
      const first = areaOptions[0];
      setSelectedOption(first);
      setAreaValue(first.value);
    }

    if (selectedOption && !areaValue) {
      setAreaValue(selectedOption.value);
    }
  }, [areaOptions, selectedOption, areaValue]);

  const formatDateForParam = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  };

  const buildSsrsUrl = (startIso: string, endIso: string, area?: string) => {
    const sdate = encodeURIComponent(formatDateForParam(startIso) || '');
    const edate = encodeURIComponent(formatDateForParam(endIso) || '');
    const a = encodeURIComponent(area ?? '');

    const separator = reportBaseUrl.includes('?') ? '&' : '?';

    const params = [
      `rs:Command=Render`,
      `rs:Embed=true`,
      `Sdate=${sdate}`,
      `Edate=${edate}`,
      // `${reportAreaParamName}=${a}`,
      `rc:Parameters=false`,
      `rc:Toolbar=false`,
    ].join('&');

    return `${reportBaseUrl}${separator}${params}`;
  };

  const onIframeLoad = () => {
    console.log('Iframe loaded', iframeRef.current);
    setViewerLoading(false);
  };

  const handleSelectChange = (opt: any) => {
    if (opt?.target && typeof opt.target.value === 'string') {
      const v = opt.target.value;
      const found = areaOptions.find((a) => a.value === v) ?? null;
      setSelectedOption(found);
      setAreaValue(v);
      return;
    }

    if (opt == null) {
      setSelectedOption(null);
      setAreaValue('');
      return;
    }

    if (typeof opt === 'object' && typeof opt.value === 'string') {
      const selected = opt as AreaOption;
      setSelectedOption(selected);
      setAreaValue(selected.value);
      return;
    }

    if (typeof opt === 'string') {
      const found = areaOptions.find((a) => a.value === opt) ?? null;
      setSelectedOption(found);
      setAreaValue(opt);
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!fromDate || !toDate) {
      Swal.fire(
        'Validation',
        'Please select both From and To dates',
        'warning'
      );
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      Swal.fire('Validation', 'From date cannot be after To date', 'warning');
      return;
    }

    if (!areaValue) {
      Swal.fire('Validation', 'Please select an Area', 'warning');
      return;
    }

    if (!reportBaseUrl) {
      Swal.fire(
        'Configuration',
        'Report URL is not configured. Check APP_CONFIG / aap_cofig and FIGGING_REPORT_WithoutURL.',
        'info'
      );
      return;
    }

    setButtonLoading(true);
    setViewerLoading(true);

    try {
      const url = buildSsrsUrl(fromDate, toDate, areaValue);
      console.log('Attempting to load SSRS URL in iframe:', url);

      // Force iframe remount/load even if same URL is selected again
      setIframeSrc(null);
      setTimeout(() => {
        setIframeSrc(url);
      }, 0);
    } catch (err) {
      console.error('Failed to build/load report URL', err);
      setViewerLoading(false);
      Swal.fire('Error', 'Failed to load report', 'error');
    } finally {
      setButtonLoading(false);
    }
  };

  const openInNewTab = () => {
    if (!fromDate || !toDate || !areaValue) {
      Swal.fire(
        'Validation',
        'Please select From, To and Area before opening new tab',
        'warning'
      );
      return;
    }

    if (!reportBaseUrl) {
      Swal.fire(
        'Configuration',
        'Report URL is not configured. Check APP_CONFIG / aap_cofig and FIGGING_REPORT_WithoutURL.',
        'info'
      );
      return;
    }

    const url = buildSsrsUrl(fromDate, toDate, areaValue);
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700 uppercase">
          Pigging Report
        </h1>

        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← Back
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 rounded-lg shadow-lg gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            From Date
          </label>
          <input
            type="date"
            name="fromDate"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            To Date
          </label>
          <input
            type="date"
            name="toDate"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Area
          </label>
          <SelectDropdown
            label=""
            options={areaOptions}
            value={selectedOption}
            defaultValue={selectedOption ?? areaOptions[0]}
            onChange={handleSelectChange}
            tabIndex={2}
            isDisabled={false}
            placeholder="Choose area"
            menuPlacement="bottom"
          />
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={buttonLoading}
            className="inline-flex items-center gap-2 px-4 mt-1 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700 disabled:opacity-60"
          >
            <span>{buttonLoading ? 'Loading...' : 'View in Report'}</span>
          </button>

          <button
            type="button"
            onClick={openInNewTab}
            className="ml-2 inline-flex items-center gap-2 px-4 mt-1 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
          >
            Open in new tab
          </button>
        </div>
      </form>

      <div className="mt-5">
        {iframeSrc ? (
          <div>
            <h2 className="text-md text-gray-600 mb-2">Report Viewer</h2>

            <div className="shadow-xl rounded bg-slate-100 relative overflow-hidden">
              {viewerLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
                    <div className="text-sm text-gray-600">
                      Report Loading...
                    </div>
                  </div>
                </div>
              )}

              <iframe
                key={iframeSrc}
                ref={iframeRef}
                title="Pigging SSRS Report"
                src={iframeSrc}
                className="w-full h-[65vh]"
                onLoad={onIframeLoad}
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No report loaded yet.</div>
        )}
      </div>
    </>
  );
}
