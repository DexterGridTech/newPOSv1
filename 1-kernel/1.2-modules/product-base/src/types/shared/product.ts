

export interface ProductBase {
    //商品代码
    productCode:string
    //销售商品类型，用于判断权益
    saleTypeCode:string
    //商品名称
    productName:string
    //显示名称
    displayName:string
    //是否可见
    visible:boolean
    //有效期数组
    valid?:{validFrom:number, validTo:number}[]
}