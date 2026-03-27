
export interface PaymentRequest {
    paymentRequestCode: string;
    mainOrderCode: string;
    paymentFunctionKey:string;
    amount: number;
    paymentRequestStatus: PaymentRequestStatus
    extra: Record<string, any>
}

export enum PaymentRequestStatus {
    CREATED = "CREATED",
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    ERROR = "ERROR"
}
