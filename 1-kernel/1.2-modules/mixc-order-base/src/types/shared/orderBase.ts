export interface MainOrderBase {
    mainOrderCode: string
    subOrders: SubOrderBase[]
    payments: PaymentBase[]
    paymentWithdraws: PaymentWithdraw[]
    paymentRequests: PaymentRequestBase[]
    paymentShares: PaymentShare[]
    amount: number
    mainOrderStatus: MainOrderBaseStatus
    createdAt: number
    endedAt: number
    extra: Record<string, any>
}

export interface PaymentWithdraw {
    paymentCode: string
    paymentWithdrawStatus:PaymentWithdrawStatus
    extra: Record<string, any>
}

export interface SubOrderBase {
    subOrderCode: string
    productOrders: ProductOrderBase[]
    amount: number
    extra: Record<string, any>
}

export interface ProductOrderBase {
    productOrderCode: string
    productCode: string
    productName: string
    price: number
    quantity: number
    amount: number
}

export interface PaymentBase {
    paymentCode: string;
    paymentRequestCode?: string;
    subPayments: PaymentBase[];
    amount: number;
    extra: Record<string, any>
}

export interface PaymentShare {
    productOrderCode: string;
    paymentCode: string;
    amount: number;
    extra: Record<string, any>
}

export interface PaymentRequestBase {
    paymentRequestCode: string;
    amount: number;
    paymentRequestStatus: PaymentRequestBaseStatus
    extra: Record<string, any>
}

export enum MainOrderBaseStatus {
    CREATED = "CREATED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export enum PaymentBaseStatus {
    CREATED = "CREATED",
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

export enum PaymentRequestBaseStatus {
    CREATED = "CREATED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    ERROR = "ERROR"
}

export enum PaymentWithdrawStatus {
    CREATED = "CREATED",
    COMPLETED = "COMPLETED",
    ERROR = "ERROR"
}

