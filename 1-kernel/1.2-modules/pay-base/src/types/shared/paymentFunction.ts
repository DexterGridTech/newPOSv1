import {InstanceMode} from "@impos2/kernel-core-interconnection";


export interface PaymentFunction {
    key: string;
    displayName: string;
    displayIndex: number;
    definition: PaymentFunctionDefinition;
    //指定是MASTER或SLAVE可以使用该支付
    instanceMode: InstanceMode[]
}
//支付方法定义
export interface PaymentFunctionDefinition {
    key: string
    name: string
    paymentAmountType:PaymentAmountType
    paymentActionType:PaymentActionType
    taskDefinitionKey:string
    //指定是MASTER或SLAVE来执行task
    taskInstanceMode?:InstanceMode
    //是否可后台运行
    backstageSupported:boolean
}
//支付金额类型
export enum PaymentAmountType {
    //动态金额，不需要提前确认金额
    DYNAMIC = 'DYNAMIC',
    //静态金额，需要提前确认金额
    FIXED = 'FIXED',
}
//支付动作类型
export enum PaymentActionType {
    //付款码
    SCAN_B2C='SCAN_B2C',
    //万象付
    SCAN_C2B='SCAN_C2B',
    //刷卡
    SWIPE_CARD='SWIPE_CARD',
    //碰一碰
    TOUCH='TOUCH',
    //权益选择
    SELECT='SELECT',
    //记账
    NONE='NONE',
}