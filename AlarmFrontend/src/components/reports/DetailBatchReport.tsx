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

const DetailBatchReport = (): JSX.Element => {
  const blenderApi = useMemo(() => createCrudApi('BlenderConfiguration'), []);
  const reportConfig = useMemo(() => reportConfigs.detailBatchReport, []);

  const [blenders, setBlenders] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [batchNames, setBatchNames] = useState<Option[]>([]);

  const [selectedBlender, setSelectedBlender] = useState<Option | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Option | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState<Option | null>(
    null
  );

  // Applied values — jena pramane report actually render thay chhe
  const [appliedBlender, setAppliedBlender] = useState<Option | null>(null);
  const [appliedProduct, setAppliedProduct] = useState<Option | null>(null);
  const [appliedBatchName, setAppliedBatchName] = useState<Option | null>(null);

  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
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
      setBlenders([]);
      Swal.fire('Error', 'Failed to load Blender Names', 'error');
    } finally {
      setDropdownLoading(false);
    }
  };

  const fetchProducts = async (blenderName: string) => {
    try {
      setProductLoading(true);
      setProducts([]);
      setSelectedProduct(null);
      const res = await blenderApi.get<any>(
        `GetProductListByBlender?blenderName=${encodeURIComponent(blenderName)}`
      );
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setProducts(options);
    } catch (err) {
      console.error(err);
      setProducts([]);
      Swal.fire('Error', 'Failed to load Product Names', 'error');
    } finally {
      setProductLoading(false);
    }
  };

  const fetchBatchNames = async (blenderName: string, productName: string) => {
    try {
      setBatchLoading(true);
      setBatchNames([]);
      setSelectedBatchName(null);
      const res = await blenderApi.get<any>(
        `GetBatchListByBlenderProduct?blenderName=${encodeURIComponent(
          blenderName
        )}&productName=${encodeURIComponent(productName)}`
      );
      const options = Array.isArray(res?.data)
        ? res.data.map((x: string) => ({ value: x, label: x }))
        : [];
      setBatchNames(options);
    } catch (err) {
      console.error(err);
      setBatchNames([]);
      Swal.fire('Error', 'Failed to load Batch Names', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    fetchBlenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kai bhi dropdown badlai to Generate button batavo
  useEffect(() => {
    const changed =
      selectedBlender?.value !== appliedBlender?.value ||
      selectedProduct?.value !== appliedProduct?.value ||
      selectedBatchName?.value !== appliedBatchName?.value;
    setSelectionChanged(
      changed && !!selectedBlender && !!selectedProduct && !!selectedBatchName
    );
  }, [
    selectedBlender,
    selectedProduct,
    selectedBatchName,
    appliedBlender,
    appliedProduct,
    appliedBatchName,
  ]);

  const validateForm = () => {
    if (!selectedBlender?.value) {
      Swal.fire('Validation', 'Please select Blender Name', 'warning');
      return false;
    }
    if (!selectedProduct?.value) {
      Swal.fire('Validation', 'Please select Product Name', 'warning');
      return false;
    }
    if (!selectedBatchName?.value) {
      Swal.fire('Validation', 'Please select Batch Name', 'warning');
      return false;
    }
    return true;
  };

  const handleGenerate = () => {
    if (!validateForm()) return;
    setViewerLoading(true);
    setAppliedBlender(selectedBlender);
    setAppliedProduct(selectedProduct);
    setAppliedBatchName(selectedBatchName);
    setSelectionChanged(false);
  };

  const handleClear = () => {
    setSelectedBlender(null);
    setSelectedProduct(null);
    setSelectedBatchName(null);
    setProducts([]);
    setBatchNames([]);
    setAppliedBlender(null);
    setAppliedProduct(null);
    setAppliedBatchName(null);
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
                  setSelectedProduct(null);
                  setSelectedBatchName(null);
                  setProducts([]);
                  setBatchNames([]);
                  return;
                }
                setSelectedBlender(opt);
                setSelectedProduct(null);
                setSelectedBatchName(null);
                setProducts([]);
                setBatchNames([]);
                fetchProducts(opt.value);
              }}
            />
          </div>

          <div className="w-full md:w-[250px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Product Name
            </label>
            <SelectDropdown
              label=""
              options={products}
              value={selectedProduct}
              isDisabled={!selectedBlender || productLoading}
              placeholder={
                productLoading
                  ? 'Loading Product Names...'
                  : 'Choose Product Name'
              }
              menuPlacement="bottom"
              onChange={(opt: any) => {
                if (!opt) {
                  setSelectedProduct(null);
                  setSelectedBatchName(null);
                  setBatchNames([]);
                  return;
                }
                setSelectedProduct(opt);
                setSelectedBatchName(null);
                setBatchNames([]);
                if (selectedBlender?.value && opt?.value) {
                  fetchBatchNames(selectedBlender.value, opt.value);
                }
              }}
            />
          </div>

          <div className="w-full md:w-[250px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Batch Name
            </label>
            <SelectDropdown
              label=""
              options={batchNames}
              value={selectedBatchName}
              isDisabled={!selectedProduct || batchLoading}
              placeholder={
                batchLoading ? 'Loading Batch Names...' : 'Choose Batch Name'
              }
              menuPlacement="bottom"
              onChange={(opt: any) => setSelectedBatchName(opt)}
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

      {appliedBlender && appliedProduct && appliedBatchName && (
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
              BlenderNo: appliedBlender.value,
              productCode: appliedProduct.value,
              BatchNo: appliedBatchName.value,
            }}
            onLoad={() => setViewerLoading(false)}
          />
        </div>
      )}
    </>
  );
};

export default DetailBatchReport;
