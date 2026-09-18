import React, { JSX, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
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

const RmCodeWiseReport = (): JSX.Element => {
  const reportApi = useMemo(() => createCrudApi('Report'), []);
  const reportConfig = useMemo(() => reportConfigs.rmCodeWise, []);

  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());
  const [productCodes, setProductCodes] = useState<CodeOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<CodeOption | null>(null);

  // Applied values — jena pramane report actually render thay chhe
  const [appliedFromDate, setAppliedFromDate] = useState(getYesterday());
  const [appliedToDate, setAppliedToDate] = useState(getToday());
  const [appliedOption, setAppliedOption] = useState<CodeOption | null>(null);

  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectionChanged, setSelectionChanged] = useState(false);

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
      Swal.fire('Error', 'Failed to load RM codes', 'error');
    } finally {
      setDropdownLoading(false);
    }
  };

  useEffect(() => {
    fetchProductCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kai bhi field (date/RM code) badlai to Generate button batavo
  useEffect(() => {
    const changed =
      fromDate !== appliedFromDate ||
      toDate !== appliedToDate ||
      selectedOption?.value !== appliedOption?.value;
    setSelectionChanged(changed && !!selectedOption);
  }, [
    fromDate,
    toDate,
    selectedOption,
    appliedFromDate,
    appliedToDate,
    appliedOption,
  ]);

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
    if (!selectedOption?.value) {
      Swal.fire('Validation', 'Please select RM Code.', 'warning');
      return false;
    }
    return true;
  };

  const handleGenerate = () => {
    if (!validateForm()) return;
    setViewerLoading(true);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setAppliedOption(selectedOption);
    setSelectionChanged(false);
  };

  const handleClear = () => {
    setFromDate(getYesterday());
    setToDate(getToday());
    setSelectedOption(null);
    setAppliedFromDate(getYesterday());
    setAppliedToDate(getToday());
    setAppliedOption(null);
    setSelectionChanged(false);
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase mb-3">
        {reportConfig.title}
      </h1>

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

          <div className="w-full md:w-[220px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              RM Code
            </label>
            <SelectDropdown
              label=""
              options={productCodes}
              value={selectedOption}
              onChange={(opt: any) => {
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
                  const found =
                    productCodes.find((a) => a.value === opt) ?? null;
                  setSelectedOption(found);
                }
              }}
              tabIndex={2}
              isDisabled={dropdownLoading}
              placeholder={
                dropdownLoading ? 'Loading RM Codes...' : 'Choose RM Code'
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

      {appliedOption && (
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
              Condition: appliedOption.value,
              FilterBy: 'RMWise',
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default RmCodeWiseReport;
