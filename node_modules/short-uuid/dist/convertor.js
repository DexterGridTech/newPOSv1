"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTranslator = void 0;
const any_base_1 = __importDefault(require("any-base"));
const config_1 = __importDefault(require("./config"));
const utilities_1 = require("./utilities");
const validate_1 = __importDefault(require("./validate"));
const translate_1 = require("./translate");
const createTranslatorFromOptions = (options = {}) => {
    const setup = {
        ...config_1.default,
        ...options,
    };
    // Check for duplicate characters in the alphabet.
    if ((0, utilities_1.checkForDuplicates)(setup.alphabet)) {
        throw new Error('Alphabet contains duplicate characters.');
    }
    const config = {
        ...setup,
        maxLength: (0, utilities_1.calculateMaxLength)(setup.alphabet.length),
        // TODO Allow a padding character from options?
        paddingCharacter: setup.alphabet[0],
        hexFromAlphabet: (0, any_base_1.default)(setup.alphabet, any_base_1.default.HEX),
        hexToAlphabet: (0, any_base_1.default)(any_base_1.default.HEX, setup.alphabet),
    };
    const translator = {
        alphabet: config.alphabet,
        fromUUID: (uuid) => (0, translate_1.shortenUUID)(config, uuid),
        generate: () => (0, translate_1.shortenUUID)(config, config.uuid()),
        maxLength: config.maxLength,
        toUUID: (shortUuid) => (0, translate_1.restoreUUID)(config, shortUuid),
        uuid: config.uuid,
        validate: (0, validate_1.default)(config),
    };
    Object.freeze(translator);
    return translator;
};
const createTranslatorFromAlphabet = (alphabet, options = {}) => {
    return createTranslatorFromOptions({
        ...options,
        alphabet,
    });
};
const createTranslator = (arg, options) => {
    return typeof arg === 'string'
        ? createTranslatorFromAlphabet(arg, options)
        : createTranslatorFromOptions(arg);
};
exports.createTranslator = createTranslator;
