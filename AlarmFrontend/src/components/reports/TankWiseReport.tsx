import React, { JSX, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import SelectDropdown from '../../features/ui/SelectDropdown';
import { createCrudApi } from '../../features/lib/createCrudApi';
import { reportConfigs } from '../../features/lib/reportConfigs';
import ReportViewerComponent from '../ReportViewerComponent ';

type CodeOption = {
  value: string;
  label: string;
};

// yyyy-mm-dd format (date input mate)
const formatDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
};

const getToday = () => formatDate(new Date());

// SSRS ne joiyto "yyyy-MM-dd HH:mm:ss" format
const formatDateTime = (dateStr: string, isEnd = false) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dt = new Date(year, month - 1, day);
  if (isEnd) {
    dt.setHours(23, 59, 59, 999);
  } else {
    dt.setHours(0, 0, 0, 0);
  }
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const TankWiseReport = (): JSX.Element => {
  const navigate = useNavigate();
  const reportApi = useMemo(() => createCrudApi('Report'), []);
  const reportConfig = useMemo(() => reportConfigs.tankWise, []);

  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());
  const [productCodes, setProductCodes] = useState<CodeOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<CodeOption[]>([]);

  // Applied values — jena pramane report actually render thay chhe
  const [appliedFromDate, setAppliedFromDate] = useState(getYesterday());
  const [appliedToDate, setAppliedToDate] = useState(getToday());
  const [appliedOptions, setAppliedOptions] = useState<CodeOption[]>([]);

  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectionChanged, setSelectionChanged] = useState(false);

  const fetchProductCodes = async () => {
    setDropdownLoading(true);
    try {
      const res = await reportApi.get<any>('GetTankList');
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
      console.error('Failed to load tank list:', err);
      setProductCodes([]);
      Swal.fire('Error', 'Failed to load Tank list', 'error');
    } finally {
      setDropdownLoading(false);
    }
  };

  useEffect(() => {
    fetchProductCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedKey = selectedOptions
    .map((o) => o.value)
    .sort()
    .join(',');
  const appliedKey = appliedOptions
    .map((o) => o.value)
    .sort()
    .join(',');

  // Kai bhi field (date/tanks) badlai to Generate button batavo
  useEffect(() => {
    const changed =
      fromDate !== appliedFromDate ||
      toDate !== appliedToDate ||
      selectedKey !== appliedKey;
    setSelectionChanged(changed && selectedOptions.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fromDate,
    toDate,
    selectedKey,
    appliedFromDate,
    appliedToDate,
    appliedKey,
  ]);

  const handleSelectChange = (opt: any) => {
    // react-select multi mode: opt aave chhe array (ya null jyare badhu clear thay)
    if (Array.isArray(opt)) {
      setSelectedOptions(opt as CodeOption[]);
      return;
    }
    if (opt == null) {
      setSelectedOptions([]);
      return;
    }
    // fallback: single value aavyu to array ma nakho
    setSelectedOptions([opt as CodeOption]);
  };

  const validateForm = () => {
    if (!fromDate || !toDate) {
      Swal.fire(
        'Validation',
        'Please select From Date and To Date.',
        'warning'
      );
      return false;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      Swal.fire(
        'Validation',
        'From Date cannot be greater than To Date.',
        'warning'
      );
      return false;
    }
    if (selectedOptions.length === 0) {
      Swal.fire('Validation', 'Please select at least one Tank.', 'warning');
      return false;
    }
    return true;
  };

  const handleGenerate = () => {
    if (!validateForm()) return;
    setViewerLoading(true);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedOptions(selectedOptions);
    setSelectionChanged(false);
  };

  const handleClear = () => {
    setFromDate(getYesterday());
    setToDate(getToday());
    setSelectedOptions([]);
    setAppliedFromDate(getYesterday());
    setAppliedToDate(getToday());
    setAppliedOptions([]);
    setSelectionChanged(false);
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-700 uppercase mb-3">
          {reportConfig.title}
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white p-5 rounded-lg shadow-lg mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-[220px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div className="w-full md:w-[220px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-600 focus:outline-none"
            />
          </div>

          <div className="w-full md:w-[280px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Select Tank(s)
            </label>
            <SelectDropdown
              label=""
              options={productCodes}
              value={selectedOptions}
              onChange={handleSelectChange}
              isMulti
              tabIndex={2}
              isDisabled={dropdownLoading}
              placeholder={
                dropdownLoading ? 'Loading Tanks...' : 'Choose Tank(s)'
              }
              menuPlacement="bottom"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {selectionChanged && (
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700"
              >
                Generate Report
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {appliedOptions.length > 0 && (
        <div className="relative h-[75vh] rounded-lg border bg-white overflow-hidden">
          {viewerLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
                <span className="text-sm text-gray-600">Loading report...</span>
              </div>
            </div>
          )}
          <ReportViewerComponent
            reportPath={reportConfig.reportPath}
            params={{
              FromDate: formatDateTime(appliedFromDate, false),
              ToDate: formatDateTime(appliedToDate, true),
              Condition: appliedOptions.map((o) => o.value).join(','),
              FilterBy: 'TankWise',
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default TankWiseReport;
