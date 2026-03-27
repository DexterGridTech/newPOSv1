import {MainOrderBase, ProductOrderBase} from "@impos2/kernel-order-base";

export interface DraftProductOrder extends ProductOrderBase {
    id: string
    displayName: string
    moneyString: string  // 用户可见的元字符串，用于键盘编辑（如 "76.43"）
}