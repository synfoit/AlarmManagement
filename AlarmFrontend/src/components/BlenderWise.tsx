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
import { createCrudApi } from '../features/lib/createCrudApi';

type CodeOption = {
  value: string;
  label: string;
};

function getAppConfig() {
  const w = window as any;
  return w.APP_CONFIG ?? w.aap_cofig ?? {};
}

const BlenderWiseReport = (): JSX.Element => {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [productCodes, setProductCodes] = useState<CodeOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<CodeOption | null>(null);

  const [loading, setLoading] = useState(false);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const reportApi = useMemo(() => createCrudApi('Report'), []);

  const config = useMemo(() => getAppConfig(), []);
  const reportBaseUrl = config?.PIGGING_REPORT_URL ?? '';
  const reportAreaParamName = config?.PIGGING_REPORT_AREA_PARAM ?? 'Area';

  const fetchProductCodes = async () => {
    setDropdownLoading(true);
    try {
      const res = await reportApi.get<any>('GetRMCode');
      const data = res?.data;

      const mapCodes = (arr: any[]) =>
        arr
          .map((p: any) => {
            const v = String(p ?? '').trim();
            return v ? { label: v, value: v } : null;
          })
          .filter(Boolean) as CodeOption[];

      if (Array.isArray(data)) {
        setProductCodes(mapCodes(data));
      } else if (Array.isArray(data?.productCodes)) {
        setProductCodes(mapCodes(data.productCodes));
      } else {
        setProductCodes([]);
      }
    } catch (err) {
      console.error('Failed to load product codes:', err);
      setProductCodes([]);
      Swal.fire('Error', 'Failed to load product codes', 'error');
    } finally {
      setDropdownLoading(false);
    }
  };

  useEffect(() => {
    fetchProductCodes();
  }, [reportApi]);

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

  const handleSelectChange = (opt: any) => {
    if (opt?.target && typeof opt.target.value === 'string') {
      const v = opt.target.value;
      const found = productCodes.find((a) => a.value === v) ?? null;
      setSelectedOption(found);
      return;
    }

    if (opt == null) {
      setSelectedOption(null);
      return;
    }

    if (typeof opt === 'object' && typeof opt.value === 'string') {
      setSelectedOption(opt as CodeOption);
      return;
    }

    if (typeof opt === 'string') {
      const found = productCodes.find((a) => a.value === opt) ?? null;
      setSelectedOption(found);
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

    if (!selectedOption?.value) {
      Swal.fire('Validation', 'Please select an RM Code', 'warning');
      return;
    }

    if (!reportBaseUrl) {
      Swal.fire(
        'Configuration',
        'reportBaseUrl is not configured. Set window.APP_CONFIG.FIGGING_REPORT_WithoutURL',
        'info'
      );
      return;
    }

    setLoading(true);
    setViewerLoading(true);

    try {
      const url = buildSsrsUrl(fromDate, toDate, selectedOption.value);
      console.log('Attempting to load SSRS URL in iframe:', url);

      setIframeSrc(null);
      setTimeout(() => {
        setIframeSrc(url);
      }, 0);
    } catch (err) {
      console.error('Failed to build/load report URL', err);
      setViewerLoading(false);
      Swal.fire('Error', 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openInNewTab = () => {
    if (!fromDate || !toDate || !selectedOption?.value) {
      Swal.fire(
        'Validation',
        'Please select From, To and RM Code before opening new tab',
        'warning'
      );
      return;
    }

    if (!reportBaseUrl) {
      Swal.fire(
        'Configuration',
        'reportBaseUrl is not configured. Set window.APP_CONFIG.FIGGING_REPORT_WithoutURL',
        'info'
      );
      return;
    }

    const url = buildSsrsUrl(fromDate, toDate, selectedOption.value);
    window.open(url, '_blank');
  };

  const onIframeLoad = () => {
    console.log('Iframe loaded', iframeRef.current);
    setViewerLoading(false);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-700 uppercase">
          Blender Wise Consumption Report
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
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Select RM Code
          </label>
          <SelectDropdown
            label=""
            options={productCodes}
            value={selectedOption}
            onChange={handleSelectChange}
            tabIndex={2}
            isDisabled={dropdownLoading}
            placeholder={
              dropdownLoading ? 'Loading RM Codes...' : 'Choose RM Code'
            }
            menuPlacement="bottom"
          />
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={loading || dropdownLoading}
            className="inline-flex items-center gap-2 px-4 mt-1 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700 disabled:opacity-60"
          >
            <span>{loading ? 'Loading...' : 'View in Report'}</span>
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
};

export default BlenderWiseReport;
