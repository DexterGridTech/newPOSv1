/**
 * CORS中间件
 */

import cors from 'cors';
import { CONFIG } from '../config';

/**
 * CORS配置
 */
export const corsMiddleware = cors({
  origin: CONFIG.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
});
