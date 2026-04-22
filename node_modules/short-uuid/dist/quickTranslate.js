"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const convertor_1 = require("./convertor");
let quickTranslate;
const generate = () => {
    if (quickTranslate === undefined) {
        quickTranslate = (0, convertor_1.createTranslator)();
    }
    return quickTranslate.generate();
};
exports.generate = generate;
