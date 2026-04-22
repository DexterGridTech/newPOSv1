"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = exports.createTranslator = exports.constants = void 0;
// Two basic actions available with v6.0.0:
var constants_1 = require("./constants");
Object.defineProperty(exports, "constants", { enumerable: true, get: function () { return __importDefault(constants_1).default; } });
var convertor_1 = require("./convertor");
Object.defineProperty(exports, "createTranslator", { enumerable: true, get: function () { return convertor_1.createTranslator; } });
var quickTranslate_1 = require("./quickTranslate");
Object.defineProperty(exports, "generate", { enumerable: true, get: function () { return quickTranslate_1.generate; } });
