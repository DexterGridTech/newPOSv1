"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSubset = exports.REGEX = void 0;
exports.validateUUID = validateUUID;
const translate_1 = require("./translate");
// Adapted from UUID validate.ts
// https://github.com/uuidjs/uuid/blob/main/src/regex.ts
// https://github.com/uuidjs/uuid/blob/main/src/validate.ts
exports.REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
function validateUUID(uuid) {
    return typeof uuid === 'string' && exports.REGEX.test(uuid);
}
const isSubset = (sourceSet, testSet) => {
    // TODO - replace with Set.isSuperset once widely available
    const aSet = new Set(sourceSet);
    return testSet
        .split('')
        .every((letter) => aSet.has(letter));
};
exports.isSubset = isSubset;
/**
 * Confirm if string is a valid id. Checks length and alphabet.
 * If the second parameter is true it will translate to standard UUID
 *  and check the result for UUID validity.
 *  HOF takes a config and returns the validate function.
 */
const validate = (config) => (shortId, rigorous = false) => {
    if (!shortId || typeof shortId !== 'string')
        return false;
    const isCorrectLength = config.consistentLength
        ? shortId.length === config.maxLength
        : shortId.length <= config.maxLength;
    const isAlphabetSubset = (0, exports.isSubset)(config.alphabet, shortId);
    return isCorrectLength
        && isAlphabetSubset
        // Only validate if subset isconfirmed or any-base will throw error
        && (rigorous
            ? validateUUID((0, translate_1.restoreUUID)(config, shortId))
            : true);
};
exports.default = validate;
