// src/features/users/types.ts
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  password?: string; // optional on fetch/list
  phone: string;
  username: string;
  role: string;
}
