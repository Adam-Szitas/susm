export interface Address {
  street: string;
  city: string;
  country: string;
}

export interface User {
  id?: string;
  uuid?: string;
  name: string;
  email: string;
  addresses: Address;
  language: string;
}
