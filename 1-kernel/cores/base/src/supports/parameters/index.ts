import {DefinedSystemParameter} from "../../foundations";


export const kernelCoreBaseParameters = {
    testTimeout: new DefinedSystemParameter(
        '测试参数',
        "system.test.timeout",
        1000
    )
};