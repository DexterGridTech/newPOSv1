"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rfcBase32 = exports.uuid25Base36 = exports.flickrBase58 = exports.cookieBase90 = void 0;
// cookieBase90 is my own creation
exports.cookieBase90 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&'()*+-./:<=>?@[]^_`{|}~";
// flickrBase58 from https://www.flickr.com/groups/api/discuss/72157616713786392/
exports.flickrBase58 = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
// uuid25Base36 from https://www.npmjs.com/package/uuid25
exports.uuid25Base36 = '0123456789abcdefghijklmnopqrstuvwxyz';
// base32 from https://datatracker.ietf.org/doc/html/rfc4648#section-6
exports.rfcBase32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
exports.default = {
    cookieBase90: exports.cookieBase90,
    flickrBase58: exports.flickrBase58,
    rfcBase32: exports.rfcBase32,
    uuid25Base36: exports.uuid25Base36,
};
