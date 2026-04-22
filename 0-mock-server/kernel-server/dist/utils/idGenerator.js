import { generate, createTranslator } from 'short-uuid';
export function generateId() {
    return generate();
}
export function generateToken() {
    return createTranslator('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz').generate();
}
export function generateActiveCode() {
    return generate().slice(0, 12).toUpperCase();
}
export function generateDeactiveCode() {
    return generate().slice(0, 12).toUpperCase();
}
//# sourceMappingURL=idGenerator.js.map