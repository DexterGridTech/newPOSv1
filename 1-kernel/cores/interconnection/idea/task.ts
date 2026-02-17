// todo:这是一个测试文件，用来测试和验证我的的想法


//  在1-kernel/cores/interconnection/src/types/state/instanceInfo.ts中，workspace有两个值：main、branch，代表两个同时存在互补干扰的工作区
//  我希望有一整套的slice、action、reducer、command框架是基于workspace运行的。也就是我只需要定义一次slice、action、reducer，就可以自动生成两套数据。
//  以下是我希望实现的效果，仅示意

//  定义 stateKey
//  createModuleWorkspaceStateKeys需要你帮我设计
import {Actor, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {
    InstanceInfoState, kernelCoreInterconnectionCommands, kernelCoreInterconnectionState,
    MasterInterconnectionState, SlaveInterconnectionState, WorkSpace
} from "../src";
import {dispatchAction} from "@impos2/kernel-base";
import {PayloadAction} from "@reduxjs/toolkit";
import {KernelCoreInterconnectionState} from "../src/types/moduleState";

export const XXXState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'stateKey1',
        'stateKey2',
        'stateKey3'
    ] as const
);



export interface StateKey1State {
    prop1:string
    prop2:number
    prop3:any
}

//  createModuleWorkspaceStateType需要你帮我设计,用于扩展RootState
export type XXXStates = createModuleWorkspaceStateType (
    {
        [XXXState.stateKey1]: StateKey1State,
        [XXXState.stateKey2]: StateKey2State,
        [XXXState.stateKey3]: StateKey3State
    }
)
//  这里实际生成的是
XXXStates={
    "stateKey1.main":StateKey1State,
    "stateKey1.branch":StateKey1State,
    "stateKey2.main":StateKey2State,
    "stateKey2.branch":StateKey2State,
    "stateKey3.main":StateKey3State,
    "stateKey4.branch":StateKey3State,
}

declare module '@impos2/kernel-core-base' {
    // 使用声明合并扩展 RootState 接口
    export interface RootState extends XXXStates {
    }
}



const initialState:StateKey1State = {
    prop1:'test',
    prop2:1,
    prop3:{}
}

//  createWorkspaceSlice需要你帮我设计
const slice= createWorkspaceSlice(
    XXXState.stateKey1,
    initialState,
    {
        testAction:(state,action:PayloadAction<string>)=>{
            state.prop1=action.payload
        }
    }
)
export const actions= slice.actions


//  WorkSpaceModuleSliceConfig需要你帮我设计
export const xxxConfig: WorkSpaceModuleSliceConfig<StateKey1State> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: true,
    stateSyncToSlave: false
}

//  dispatchWorkSpaceAction需要你帮我设计
export class XXXActor extends Actor {
    XXX = Actor.defineCommandHandler(XXXCommands.xxx,
        async (command): Promise<string> => {
            dispatchWorkSpaceAction(actions.testAction("hello"),command)
            return Promise.resolve({});
        })
}

//  command的extra中存有workspace的信息，如果是branch,则调用stateKey1.branch.testAction，如果是main，则调用stateKey1.main.testAction
