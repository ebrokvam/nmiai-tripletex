export type TripletexListResponse<T> = {
  fullResultSize?: number;
  values: T[];
};

export type TripletexValueResponse<T> = {
  value: T;
};

export type TripletexEmployee = {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type TripletexCustomer = {
  id: number;
  name?: string;
  email?: string;
  isCustomer?: boolean;
};

export type TripletexOrder = {
  id: number;
};

export type TripletexInvoice = {
  id: number;
};
