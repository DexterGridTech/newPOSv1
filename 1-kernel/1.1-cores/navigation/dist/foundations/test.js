"use strict";
class Task {
}
var TaskType;
(function (TaskType) {
    TaskType[TaskType["externalCall"] = 0] = "externalCall";
    TaskType[TaskType["http"] = 1] = "http";
    TaskType[TaskType["command"] = 2] = "command";
    TaskType[TaskType["parentTask"] = 3] = "parentTask";
})(TaskType || (TaskType = {}));
