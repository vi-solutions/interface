export interface QboConnection {
  id: string;
  realmId: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight QBO Customer for picker UI */
export interface QboCustomer {
  id: string;
  displayName: string;
}
