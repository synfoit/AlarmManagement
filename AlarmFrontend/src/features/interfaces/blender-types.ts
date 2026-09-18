// src/features/types/blender-types.ts
export type Blender = {
  id: number;
  rowId: number;
  blenderName: string;
  viewName: string;
  tableName?: string;
  equipmentNumber?: number;
  isActive?: boolean;
  createdAt?: string;
};
