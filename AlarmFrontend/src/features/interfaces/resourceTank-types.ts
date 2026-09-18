// src/features/interfaces/resourceTank-type.ts
export interface ResourceTank {
  id: number;
  rowId: number;
  tankNo: number;
  tankDescription: string | null;
  createdAt: string;
  isActive: boolean;
}
