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

const CumulativeFamilyWiseReport = (): JSX.Element => {
  const familyApi = useMemo(() => createCrudApi('FamilyConfiguration'), []);
  const btcConfigApi = useMemo(() => createCrudApi('BCTConfiguration'), []);
  const reportConfig = useMemo(() => reportConfigs.cumulativeFamilyWise, []);

  const [families, setFamilies] = useState<Option[]>([]);
  const [batchNumbers, setBatchNumbers] = useState<Option[]>([]);

  const [selectedFamily, setSelectedFamily] = useState<Option | null>(null);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<Option | null>(
    null
  );

  // Applied values — jena pramane report actually render thay chhe
  const [appliedFamily, setAppliedFamily] = useState<Option | null>(null);
  const [appliedBatchNumber, setAppliedBatchNumber] = useState<Option | null>(
    null
  );

  const [familyLoading, setFamilyLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectionChanged, setSelectionChanged] = useState(false);

  const fetchFamilies = async () => {
    try {
      setFamilyLoading(true);
      const res = await familyApi.get<any>('GetFamilyList');
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setFamilies(options);
    } catch (err) {
      console.error(err);
      setFamilies([]);
      Swal.fire('Error', 'Failed to load Family Names', 'error');
    } finally {
      setFamilyLoading(false);
    }
  };

  const fetchBatchNumbers = async (familyName: string) => {
    try {
      setBatchLoading(true);
      setBatchNumbers([]);
      setSelectedBatchNumber(null);
      const res = await btcConfigApi.get<any>(
        `GetBatchListByFamily?familyName=${encodeURIComponent(familyName)}`
      );
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setBatchNumbers(options);
    } catch (err) {
      console.error(err);
      setBatchNumbers([]);
      Swal.fire('Error', 'Failed to load Batch Numbers', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection badlai to Generate button batavo
  useEffect(() => {
    const changed =
      selectedFamily?.value !== appliedFamily?.value ||
      selectedBatchNumber?.value !== appliedBatchNumber?.value;
    setSelectionChanged(changed && !!selectedFamily && !!selectedBatchNumber);
  }, [selectedFamily, selectedBatchNumber, appliedFamily, appliedBatchNumber]);

  const validateForm = () => {
    if (!selectedFamily?.value) {
      Swal.fire('Validation', 'Please select Family Name', 'warning');
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
    setAppliedFamily(selectedFamily);
    setAppliedBatchNumber(selectedBatchNumber);
    setSelectionChanged(false);
  };

  const handleClear = () => {
    setSelectedFamily(null);
    setSelectedBatchNumber(null);
    setBatchNumbers([]);
    setAppliedFamily(null);
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
              Family Name
            </label>
            <SelectDropdown
              label=""
              options={families}
              value={selectedFamily}
              isDisabled={familyLoading}
              placeholder={
                familyLoading ? 'Loading Family Names...' : 'Choose Family Name'
              }
              menuPlacement="bottom"
              onChange={(opt: any) => {
                if (!opt) {
                  setSelectedFamily(null);
                  setSelectedBatchNumber(null);
                  setBatchNumbers([]);
                  return;
                }
                setSelectedFamily(opt);
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
              isDisabled={!selectedFamily || batchLoading}
              placeholder={
                batchLoading
                  ? 'Loading Batch Numbers...'
                  : 'Choose Batch Number'
              }
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

      {appliedFamily && appliedBatchNumber && (
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
              SearchValue: appliedFamily.value,
              BatchNo: appliedBatchNumber.value,
              ReportBy: 'FAMILY',
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default CumulativeFamilyWiseReport;
