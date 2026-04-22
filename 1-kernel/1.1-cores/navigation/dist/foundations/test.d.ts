declare abstract class Task {
    abstract exec<T>(args: any): Promise<T>;
    abstract on(args: any, callback: (data: any) => void): any;
    abstract complete(callback: (data: any) => void): any;
}
declare enum TaskType {
    externalCall = 0,//外部调用
    http = 1,//http请求
    command = 2,//命令
    parentTask = 3
}
interface TaskDefinition {
    key: string;
    name: string;
    taskType: TaskType;
}
//# sourceMappingURL=test.d.ts.map