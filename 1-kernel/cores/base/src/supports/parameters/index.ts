import {DefinedSystemParameter} from "../../foundations";


export const kernelCoreBaseParameters = {
    requestCleanOutTime: new DefinedSystemParameter(
        '请求清理时间',
        "system.request.clean.out.time",
        360000
    )
};