// ProjectAddress: Address with street and postal code (for projects and users)
export interface ProjectAddress {
  street?: string;
  postal_code?: string;
}

// ObjectAddress: Partial address without street/house number (for objects)
export interface ObjectAddress {
  house_number: string;
  level?: string | null;
  door_number?: string | null;
  postal_code?: string;
}

export type UserRole = 'admin' | 'member';

export interface User {
  id?: string;
  uuid?: string;
  name: string;
  email: string;
  addresses?: ProjectAddress;
  language?: string;
  /** admin = full company admin; member = standard team user */
  role?: UserRole;
  /** True only for the single platform-wide superuser. */
  is_superuser?: boolean;
}

export interface TeamUser {
  _id: { $oid: string };
  name: string;
  email: string;
  language?: string;
  role: UserRole;
  is_owner: boolean;
}

export interface CreateTeamUserPayload {
  name: string;
  email: string;
  password: string;
  language?: string;
  role: UserRole;
}
