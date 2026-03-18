export type activeRows = {
  id: number;
  userId: string;
  product: string;
  startAt: Date;
  expireAt: Date;
  isActive: boolean;
}

export type PaymentRecord = {
  userId: number,
  product: string,
  amount: number,
  screenshotPath?: string
}

export type PaymentRecordPromise = {
  id: number;
  userId: string;
  product: string;
  amount: number;
  currency: string;
  createAt: Date;
  screenshotPath: string;
};

export type SubscribeRecordPromise = {
  id: number;
  userId: string;
  product: string;
  startAt: Date;
  expireAt: Date;
  isActive: boolean;
}[];