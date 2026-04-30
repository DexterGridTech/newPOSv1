export interface SelectionPolicy {
    mode: 'auto' | 'manual' | 'clerkChoose' | 'customerChoose' | 'conditional' | 'codeActivated'
    trigger?:
        | 'cartChanged'
        | 'identityLinked'
        | 'giftChosen'
        | 'paymentInstrumentSelected'
        | 'codeEntered'
    defaultSelectedQuantity?: number
    allowDeselect?: boolean
}
