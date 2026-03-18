export interface MainOrderBase {
    mainOrderCode: string
    subOrders: SubOrderBase[]
    payments: PaymentBase[]
    paymentWithdraws: PaymentWithdraw[]
    paymentShares: PaymentShare[]
    amount: number
    mainOrderStatus: MainOrderBaseStatus
    createdAt: number
    endedAt: number
    extra: Record<string, any>
}

export interface PaymentWithdraw {
    paymentWithdrawCode: string
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
    saleTypeCode: string
    productName: string
    displayName: string
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

export enum PaymentWithdrawStatus {
    CREATED = "CREATED",
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    ERROR = "ERROR"
}

