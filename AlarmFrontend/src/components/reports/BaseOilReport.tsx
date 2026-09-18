import React, { useState } from 'react';
import { reportConfigs } from '../../features/lib/reportConfigs';
import ReportViewerComponent from '../ReportViewerComponent ';

const BaseOilReport = () => {
  const [loading, setLoading] = useState(true);

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-700 uppercase mb-3">
        {reportConfigs.baseOil.title}
      </h1>

      <div className="relative h-[83vh] rounded-lg border bg-white overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-600 border-t-transparent" />
              <span className="text-sm text-gray-600">Loading report...</span>
            </div>
          </div>
        )}
        <ReportViewerComponent
          reportPath={reportConfigs.baseOil.reportPath}
          onLoad={() => setLoading(false)}
        />
      </div>
    </>
  );
};

export default BaseOilReport;
