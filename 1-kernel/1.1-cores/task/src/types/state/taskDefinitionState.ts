import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {TaskDefinition} from "../foundations";

export interface TaskDefinitionState extends Record<string, ValueWithUpdatedAt<TaskDefinition>>{

}