import React, { JSX, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import SelectDropdown from '../../features/ui/SelectDropdown';
import { reportConfigs } from '../../features/lib/reportConfigs';
import ReportViewerComponent from '../ReportViewerComponent ';

type AreaOption = {
  value: string;
  label: string;
};

const areaOptions: AreaOption[] = [
  { value: 'Unloading A', label: 'Unloading A' },
  { value: 'Unloading B', label: 'Unloading B' },
  { value: 'RM WO Plant B', label: 'RM WO Plant B' },
  { value: 'RM TO Plant A', label: 'RM TO Plant A' },
  { value: 'TO Header A Warehouse', label: 'TO Header A Warehouse' },
  { value: 'TO Header B Warehouse', label: 'TO Header B Warehouse' },
  { value: 'WO Header A Warehouse', label: 'WO Header A Warehouse' },
  { value: 'WO Header B Loading Area', label: 'WO Header B Loading Area' },
];

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

const PiggingReport = (): JSX.Element => {
  const navigate = useNavigate();
  const reportConfig = useMemo(() => reportConfigs.pigging, []);

  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());
  const [selectedOption, setSelectedOption] = useState<AreaOption | null>(
    areaOptions[0]
  );

  // Applied values — jena pramane report actually render thay chhe
  const [appliedFromDate, setAppliedFromDate] = useState(getYesterday());
  const [appliedToDate, setAppliedToDate] = useState(getToday());
  const [appliedOption, setAppliedOption] = useState<AreaOption | null>(
    areaOptions[0]
  );

  const [viewerLoading, setViewerLoading] = useState(true);
  const [selectionChanged, setSelectionChanged] = useState(false);

  // Kai bhi field badlai to Generate button batavo
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

  const handleSelectChange = (opt: any) => {
    if (opt?.target && typeof opt.target.value === 'string') {
      const v = opt.target.value;
      const found = areaOptions.find((a) => a.value === v) ?? null;
      setSelectedOption(found);
      return;
    }
    if (opt == null) {
      setSelectedOption(null);
      return;
    }
    if (typeof opt === 'object' && typeof opt.value === 'string') {
      setSelectedOption(opt as AreaOption);
      return;
    }
    if (typeof opt === 'string') {
      const found = areaOptions.find((a) => a.value === opt) ?? null;
      setSelectedOption(found);
    }
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
    if (!selectedOption?.value) {
      Swal.fire('Validation', 'Please select Area.', 'warning');
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
    setSelectedOption(areaOptions[0]);
    setAppliedFromDate(getYesterday());
    setAppliedToDate(getToday());
    setAppliedOption(areaOptions[0]);
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
              Select Area
            </label>
            <SelectDropdown
              label=""
              options={areaOptions}
              value={selectedOption}
              onChange={handleSelectChange}
              tabIndex={2}
              isDisabled={false}
              placeholder="Choose Area"
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
              Todate: formatDateTime(appliedToDate, true),
              SelectedArea: appliedOption.value,
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default PiggingReport;
