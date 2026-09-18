export type ReportConfig = {
  key: string;
  title: string;
  reportPath: string;
};

export const reportConfigs: Record<string, ReportConfig> = {
  baseOil: {
    key: 'baseOil',
    title: 'Base Oil Report',
    reportPath: '/BaseOilReport',
  },
  familyProduct: {
    key: 'familyProduct',
    title: 'Family Wise Product Report',
    reportPath: '/FamilyWiseProductList',
  },
  detailBatchReport: {
    key: 'detailBatchReport',
    title: 'Detail Batch Report',
    reportPath: '/BatchReport',
  },
  rmCodeWise: {
    key: 'rmCodeWise',
    title: 'RM Code Wise Consumption Report',
    reportPath: '/RMConsumptionReport',
  },
  tankWise: {
    key: 'tankWise',
    title: 'Tank Wise Consumption Report',
    reportPath: '/RMConsumptionReport',
  },
  blenderWiseConsumption: {
    key: 'blenderWiseConsumption',
    title: 'Blender Wise Consumption Report',
    reportPath: '/RMConsumptionReport',
  },
  pigging: {
    key: 'pigging',
    title: 'Pigging Report',
    reportPath: '/PigReport',
  },
  cumulativeFamilyWise: {
    key: 'cumulativeFamilyWise',
    title: 'Cumulative Family Wise Report',
    reportPath: '/CR',
  },
  cumulativeBlenderWise: {
    key: 'cumulativeBlenderWise',
    title: 'Cumulative Blender Wise Report',
    reportPath: '/CR',
  },
};
