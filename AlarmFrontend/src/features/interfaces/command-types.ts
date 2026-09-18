// src/features/types/command-types.ts
export type Command = {
  id: number;
  rowId: number;
  cmndNo: number;
  cmndName: string;
  cmndUnitSP1?: string | null;
  cmndUnitSP2?: string | null;
  createdAt: string;
  isActive: boolean;
};
