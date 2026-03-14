

export interface Product {
    productCode:string
    productName:string
    displayName:string
    visible:boolean
}

export interface Contract{
    contractCode:string
    contractName:string
    productsByContract:Product[]
    validFrom:number
    validTo:number
}