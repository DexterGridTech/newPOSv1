import {InstanceMode} from "@impos2/kernel-core-interconnection";


export interface PaymentFunction {
    key: string;
    displayName: string;
    displayIndex: number;
    definition: PaymentFunctionDefinition;
    instanceMode:InstanceMode[]
}

export interface PaymentFunctionDefinition{
    key: string;
    name: string;
}