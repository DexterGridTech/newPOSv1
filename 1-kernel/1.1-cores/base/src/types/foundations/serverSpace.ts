import {ApiServerAddress} from "@impos2/kernel-core-base";

export interface ServerSpace {
    selectedSpace: string;
    spaces: {
        name: string,
        serverAddresses: ApiServerAddress[]
    }[] ;
}