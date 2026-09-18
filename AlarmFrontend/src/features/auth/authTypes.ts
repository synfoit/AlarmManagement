export interface JwtPayload {
  exp: number; // expiration in seconds
  // Add any custom claims you want here (e.g., userId, roles)
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  expiresAt: number | null; // ms since epoch
  logoutTimerId: ReturnType<typeof setTimeout> | null;
  justLoggedOut: boolean;
}
