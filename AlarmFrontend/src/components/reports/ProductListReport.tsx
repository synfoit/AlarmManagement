import React, { useState, useEffect } from 'react';
import { reportConfigs } from '../../features/lib/reportConfigs';
import ReportViewerComponent from '../ReportViewerComponent ';

// yyyy-mm-dd format banavva mate helper (date input mate jaruri)
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

const ProductListReport = () => {
  const [fromDate, setFromDate] = useState(getYesterday());
  const [toDate, setToDate] = useState(getToday());

  // Ana pramane j report render thay chhe (applied values)
  const [appliedFromDate, setAppliedFromDate] = useState(getYesterday());
  const [appliedToDate, setAppliedToDate] = useState(getToday());

  const [loading, setLoading] = useState(true);
  const [dateChanged, setDateChanged] = useState(false);

  // fromDate/toDate input change thay etle "Generate Report" button batavo
  useEffect(() => {
    if (fromDate !== appliedFromDate || toDate !== appliedToDate) {
      setDateChanged(true);
    } else {
      setDateChanged(false);
    }
  }, [fromDate, toDate, appliedFromDate, appliedToDate]);

  const handleGenerate = () => {
    setLoading(true);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setDateChanged(false);
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase mb-3">
        {reportConfigs.familyProduct.title}
      </h1>

      <div className="bg-white p-4 rounded-lg shadow-lg mb-4">
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

          <button
            onClick={handleGenerate}
            className="rounded bg-sky-600 hover:bg-sky-700 px-4 py-2 text-white transition"
          >
            Generate Report
          </button>
        </div>
      </div>

      <div className="relative h-[75vh] rounded-lg border bg-white overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
              <span className="text-sm text-gray-600">Loading report...</span>
            </div>
          </div>
        )}
        <ReportViewerComponent
          reportPath={reportConfigs.familyProduct.reportPath}
          params={{
            StartDate: appliedFromDate,
            EndDate: appliedToDate,
          }}
          onLoad={() => setLoading(false)}
        />
      </div>
    </>
  );
};

export default ProductListReport;
