import {ValueWithUpdatedAt,TaskDefinition} from "@impos2/kernel-core-base";

export interface TaskDefinitionState extends Record<string, ValueWithUpdatedAt<TaskDefinition>>{

}