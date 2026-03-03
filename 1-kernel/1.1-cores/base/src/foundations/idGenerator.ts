const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const shortId = (len = 8) => {
    let result = '';
    for (let i = 0; i < len; i++) result += CHARS[Math.floor(Math.random() * CHARS.length)];
    return result;
}
