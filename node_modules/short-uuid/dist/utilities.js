"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForDuplicates = exports.calculateMaxLength = void 0;
/**
 * Calculate length for the shortened ID
 * @param {number} alphabetLength
 * @returns {number}
 */
const calculateMaxLength = (alphabetLength) => (Math.ceil(128 / Math.log2(alphabetLength)));
exports.calculateMaxLength = calculateMaxLength;
const checkForDuplicates = (alphabet) => {
    const alphabetSet = new Set(alphabet);
    return alphabet.length !== alphabetSet.size;
};
exports.checkForDuplicates = checkForDuplicates;
