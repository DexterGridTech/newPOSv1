import {ApiServerAddress} from "../shared/http";

export interface ServerSpace {
    selectedSpace: string;
    spaces: {
        name: string,
        serverAddresses: ApiServerAddress[]
    }[] ;
}
