import {DefinedSystemParameter} from "../../foundations";


export const kernelCoreBaseParameters:Record<string, DefinedSystemParameter<any>> = {
    testTimeout: new DefinedSystemParameter(
        '测试参数',
        "system.test.timeout",
        1000
    )
};