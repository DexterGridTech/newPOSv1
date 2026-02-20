
import { Storage } from 'redux-persist';
export interface IStorageAdapter {

    setItem<T>(nameSpace:string,key:string,value:T):Promise<void>
    getItem<T>(nameSpace:string,key:string):Promise<T|null>
    removeItem(nameSpace:string,key:string):Promise<void>

    getStorage():Storage
}