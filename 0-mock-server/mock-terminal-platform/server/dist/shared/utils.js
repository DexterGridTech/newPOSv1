export const now = () => Date.now();
export const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
export const parseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
export const serializeJson = (value) => JSON.stringify(value ?? {});
