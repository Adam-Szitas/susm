export interface Address {
  street?: string;
  house_number?: string;
  level?: string | null;
  door_number?: string | null;
}

export interface User {
  id?: string;
  uuid?: string;
  name: string;
  email: string;
  addresses: Address;
  language: string;
}
