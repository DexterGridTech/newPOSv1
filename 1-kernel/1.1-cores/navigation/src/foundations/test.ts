


abstract class Task {
    // 单次调用：Promise
    abstract exec<T>(args: any): Promise<T>

    // 多次事件：订阅
    abstract on(args: any, callback: (data: any) => void):any

    // 自动完成、手动取消
    abstract complete(callback: (data: any) => void) :any
}

enum TaskType {
    externalCall,//外部调用
    http,//http请求
    command,//命令
    parentTask,//父任务
}
interface TaskDefinition{
    key:string,
    name: string,//任务名称
    taskType: TaskType

}