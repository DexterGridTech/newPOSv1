"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("./constants");
exports.default = {
    consistentLength: true,
    alphabet: constants_1.flickrBase58,
    uuid: () => globalThis.crypto?.randomUUID(),
};
