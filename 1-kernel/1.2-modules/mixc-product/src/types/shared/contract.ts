

export interface Product {
    productCode:string
    productName:string
    displayName:string
}

export interface Contract{
    contractCode:string
    contractName:string
    productsByContract:Product[]
    validFrom:number
    validTo:number
}