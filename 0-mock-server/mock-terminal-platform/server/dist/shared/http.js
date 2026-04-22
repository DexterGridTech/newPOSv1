export const ok = (res, data) => res.json({ success: true, data });
export const created = (res, data) => res.status(201).json({ success: true, data });
export const fail = (res, message, status = 400, details) => res.status(status).json({ success: false, error: { message, details } });
