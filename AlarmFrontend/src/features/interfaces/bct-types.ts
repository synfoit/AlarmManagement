// src/features/types/command-types.ts
export type BctForm = {
  id: number;
  rowId?: number;
  productCode?: string;
  family?: string;
  description?: string;
  fixedBCT?: string | number;
  variableBCT?: string | number;
  createdAt?: string;
};
