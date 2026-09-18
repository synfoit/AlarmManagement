// src/features/types/family-types.ts
export type Family = {
  id: number;
  rowId: number;
  familyName: string;
  viewName?: string | null;
  isActive: boolean;
  createdAt?: string;
};
