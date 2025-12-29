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

export interface User {
  id?: string;
  uuid?: string;
  name: string;
  email: string;
  addresses?: ProjectAddress;
  language: string;
}
