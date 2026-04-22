"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortenUUID = exports.restoreUUID = void 0;
/**
 * Translate back to hex and into UUID format with dashes
 * Pad with zeros if necessary to accommodate unusual IDs
 */
const restoreUUID = (config, shortId) => config.hexFromAlphabet(shortId)
    .padStart(32, '0')
    .match(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/)
    ?.slice(1)
    .join('-');
exports.restoreUUID = restoreUUID;
const shortenUUID = (config, longId) => {
    const translated = config.hexToAlphabet(longId.toLowerCase().replace(/-/g, ''));
    if (!config.consistentLength)
        return translated;
    return translated.padStart(config.maxLength, config.paddingCharacter);
};
exports.shortenUUID = shortenUUID;
