export interface MainOrderBase {
    mainOrderCode: string
    subOrders: SubOrderBase[]
    payments: PaymentBase[]
    paymentRequests: PaymentRequestBase[]
    paymentShares: PaymentShare[]
    amount: number
    mainOrderStatus: MainOrderBaseStatus
    createdAt: number
    endedAt: number
    extra: Record<string, any>
}

export interface SubOrderBase {
    mainOrderCode: string
    subOrderCode: string
    productOrders: ProductOrderBase[]
    amount: number
    extra: Record<string, any>
}

export interface ProductOrderBase {
    mainOrderCode: string
    subOrderCode: string
    productOrderCode: string
    productCode: string
    productName: string
    price: number
    quantity: number
    amount: number
    extra: Record<string, any>
}

export interface PaymentBase {
    mainOrderCode: string
    paymentCode: string;
    paymentRequestCode?: string;
    subPayments: PaymentBase[];
    amount: number;
    extra: Record<string, any>
}

export interface PaymentShare {
    mainOrderCode: string
    productOrderCode: string;
    paymentCode: string;
    amount: number;
    extra: Record<string, any>
}

export interface PaymentRequestBase {
    mainOrderCode: string
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

export enum PaymentRequestBaseStatus {
    CREATED = "CREATED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    ERROR = "ERROR"
}

