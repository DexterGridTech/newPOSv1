export interface FulfillmentPolicy {
    materialization: 'none' | 'giftPool' | 'giftLine' | 'exchangeLine' | 'serviceLine' | 'postOrderCertificate'
    selectionMode?: 'auto' | 'clerkChoose' | 'customerChoose'
    stockMode?: 'reserveOnOrder' | 'deductOnOrder' | 'deductOnFulfillment'
    returnMode?: 'withMainProduct' | 'independent' | 'notReturnable'
}
