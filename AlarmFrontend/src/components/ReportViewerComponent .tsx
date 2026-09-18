import React from 'react';
import config from '../../public/config.json';
interface ReportViewerProps {
  reportPath: string;
  params?: Record<string, string | number>;
  onLoad?: () => void;
}
const ReportViewerComponent: React.FC<ReportViewerProps> = ({
  reportPath,
  params,
  onLoad,
}) => {
  const encodedPath = encodeURIComponent(reportPath)
    .replace(/%2F/g, '%2f')
    .replace(/%20/g, '+');
  let url =
    `${config.REPORT_BASE_URL}?${encodedPath}` +
    `&rs:Command=Render` +
    `&rs:Embed=true`;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url += `&${key}=${encodeURIComponent(String(value))}`;
    });
  }
  console.log('Report URL:', url);
  return (
    <iframe
      src={url}
      title="SSRS Report"
      style={{
        border: 'none',
        width: '100%',
        height: '100%',
        display: 'block',
      }}
      onLoad={onLoad}
    />
  );
};
export default ReportViewerComponent;
