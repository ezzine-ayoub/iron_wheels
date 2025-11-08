export enum Role {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}

export enum CountryType {
  SWEDEN = 'SWEDEN',
  NLOGI = 'NLOGI',
  NORWAY = 'NORWAY',
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  password: string;
  passwordChanged?: boolean;
  role: Role;
  driverNo?: string;
  phone?: string;
  personalNo?: string;
  employed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  id: string;
  assigneeId: string;
  description: string;
  sleepSweden: number;
  sleepNorway: number;
  startCountry: string;
  deliveryCountry: string;
  startDatetime?: Date;
  endDatetime?: Date;
  isReceived: boolean;
  isFinished: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignee?: User;
}

export interface AllowanceRate {
  id: string;
  country: CountryType;
  allowanceSweden?: number;
  allowanceNorway?: number;
  allowanceNLogi?: number;
}
