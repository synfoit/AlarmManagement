import React, { JSX, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import SelectDropdown from '../../features/ui/SelectDropdown';
import { createCrudApi } from '../../features/lib/createCrudApi';
import { reportConfigs } from '../../features/lib/reportConfigs';
import ReportViewerComponent from '../ReportViewerComponent ';

type Option = {
  value: string;
  label: string;
};

const CumulativeBlenderWiseReport = (): JSX.Element => {
  const blenderApi = useMemo(() => createCrudApi('BlenderConfiguration'), []);
  const reportConfig = useMemo(() => reportConfigs.cumulativeBlenderWise, []);

  const [blenders, setBlenders] = useState<Option[]>([]);
  const [batchNumbers, setBatchNumbers] = useState<Option[]>([]);

  const [selectedBlender, setSelectedBlender] = useState<Option | null>(null);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<Option | null>(
    null
  );

  // Applied values — jena pramane report actually render thay chhe
  const [appliedBlender, setAppliedBlender] = useState<Option | null>(null);
  const [appliedBatchNumber, setAppliedBatchNumber] = useState<Option | null>(
    null
  );

  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectionChanged, setSelectionChanged] = useState(false);

  const fetchBlenders = async () => {
    try {
      setDropdownLoading(true);
      const res = await blenderApi.get<any>('GetBlenderName');
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setBlenders(options);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to load Blender Names', 'error');
    } finally {
      setDropdownLoading(false);
    }
  };

  const fetchBatchNumbers = async (blenderName: string) => {
    try {
      const res = await blenderApi.get<any>(
        `GetBatchNumbersByBlender?blenderName=${encodeURIComponent(
          blenderName
        )}`
      );
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setBatchNumbers(options);
    } catch (err) {
      console.error(err);
      setBatchNumbers([]);
      Swal.fire('Error', 'Failed to load Batch Numbers', 'error');
    }
  };

  useEffect(() => {
    fetchBlenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection badlai to Generate button batavo
  useEffect(() => {
    const changed =
      selectedBlender?.value !== appliedBlender?.value ||
      selectedBatchNumber?.value !== appliedBatchNumber?.value;
    setSelectionChanged(changed && !!selectedBlender && !!selectedBatchNumber);
  }, [
    selectedBlender,
    selectedBatchNumber,
    appliedBlender,
    appliedBatchNumber,
  ]);

  const validateForm = () => {
    if (!selectedBlender?.value) {
      Swal.fire('Validation', 'Please select Blender Name', 'warning');
      return false;
    }
    if (!selectedBatchNumber?.value) {
      Swal.fire('Validation', 'Please select Batch Number', 'warning');
      return false;
    }
    return true;
  };

  const handleGenerate = () => {
    if (!validateForm()) return;
    setViewerLoading(true);
    setAppliedBlender(selectedBlender);
    setAppliedBatchNumber(selectedBatchNumber);
    setSelectionChanged(false);
  };

  const handleClear = () => {
    setSelectedBlender(null);
    setSelectedBatchNumber(null);
    setBatchNumbers([]);
    setAppliedBlender(null);
    setAppliedBatchNumber(null);
    setSelectionChanged(false);
  };

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase mb-3">
        {reportConfig.title}
      </h1>

      <div className="bg-white p-5 rounded-lg shadow-lg mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full md:w-[250px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Blender Name
            </label>
            <SelectDropdown
              label=""
              options={blenders}
              value={selectedBlender}
              isDisabled={dropdownLoading}
              placeholder={
                dropdownLoading
                  ? 'Loading Blender Names...'
                  : 'Choose Blender Name'
              }
              menuPlacement="bottom"
              onChange={(opt: any) => {
                if (!opt) {
                  setSelectedBlender(null);
                  setSelectedBatchNumber(null);
                  setBatchNumbers([]);
                  return;
                }
                setSelectedBlender(opt);
                setSelectedBatchNumber(null);
                fetchBatchNumbers(opt.value);
              }}
            />
          </div>

          <div className="w-full md:w-[250px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Batch Number
            </label>
            <SelectDropdown
              label=""
              options={batchNumbers}
              value={selectedBatchNumber}
              isDisabled={!selectedBlender}
              placeholder="Choose Batch Number"
              menuPlacement="bottom"
              onChange={(opt: any) => setSelectedBatchNumber(opt)}
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

      {appliedBlender && appliedBatchNumber && (
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
              SearchValue: appliedBlender.value,
              BatchNo: appliedBatchNumber.value,
              ReportBy: 'BLENDER',
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default CumulativeBlenderWiseReport;
