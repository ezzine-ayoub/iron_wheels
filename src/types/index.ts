export enum Role {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}

export enum CountryType {
  SWEDEN = 'SWEDEN',
  NLOGI = 'NLOGI',
  NORWAY = 'NORWAY',
}

export enum JobStatus {
  CREATED = 'CREATED',
  RECEIVED = 'RECEIVED',
  STARTED = 'STARTED',
  FINISHED = 'FINISHED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
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

// SleepTracking entry type
export interface SleepTrackingEntry {
  index: number;
  city: string;
  country: 'sweden' | 'norway' | null;
  sleepAt: string | null;
  sleepCount: number;
  isNew: boolean;
  disabled: boolean | null;
}

export interface Job {
  id: string;
  sequence?: number;
  assigneeId: string;
  customerId?: string | null;
  description: string;
  status: JobStatus | string;
  sleepSweden: number;
  sleepNorway: number;
  sleepTracking?: SleepTrackingEntry[] | null;
  startCountry: string;
  deliveryCountry: string;
  trailerNo?: string | null;
  trackNo?: string | null;
  tripPath?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  isReceived: boolean;
  isFinished: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  assignee?: User;
}

export interface AllowanceRate {
  id: string;
  country: CountryType;
  allowanceSweden?: number;
  allowanceNorway?: number;
  allowanceNLogi?: number;
}
