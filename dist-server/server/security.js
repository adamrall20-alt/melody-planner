import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { getDb } from './db/database.js';
export const PORT = Number(process.env.PORT || 4310);
export const LAN_ENABLED = process.env.MELODY_LAN === '1';
export const SERVER_HOST = LAN_ENABLED ? '0.0.0.0' : '127.0.0.1';
export const SESSION_COOKIE_NAME = 'melody_session';
const TOKEN_SETTING_KEY = 'access_token';
// Strict MIME -> extension map (blocks HTML, SVG, JS, executables, etc.)
export const ALLOWED_IMAGE_MIMES = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
};
export const ALLOWED_AUDIO_MIMES = {
    'audio/webm': '.webm',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/aac': '.aac',
};
export function getSafeMediaExtension(mimeType, kind) {
    const normalized = (mimeType || '').split(';')[0].trim().toLowerCase();
    if (kind === 'voice') {
        return ALLOWED_AUDIO_MIMES[normalized] ?? null;
    }
    return ALLOWED_IMAGE_MIMES[normalized] ?? null;
}
export function isValidDateStr(val) {
    return /^\d{4}-\d{2}-\d{2}$/.test(val);
}
export function safeResolveInside(baseDir, ...segments) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(resolvedBase, ...segments);
    if (resolvedTarget === resolvedBase || !resolvedTarget.startsWith(resolvedBase + path.sep)) {
        return null;
    }
    return resolvedTarget;
}
function isPrivateIpv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255))
        return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0)
        return true;
    if (a === 169 && b === 254)
        return true;
    if (a === 192 && b === 168)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 100 && b >= 64 && b <= 127)
        return true; // CGNAT
    return false;
}
export function isSafeCalendarUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed)
        return { ok: true }; // empty string clears the setting
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        return { ok: false, reason: 'Invalid URL format' };
    }
    if (parsed.protocol !== 'https:') {
        return { ok: false, reason: 'Calendar URL must use https://' };
    }
    const host = parsed.hostname.toLowerCase();
    if (!host ||
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.endsWith('.lan')) {
        return { ok: false, reason: 'Local or internal hostnames are not allowed' };
    }
    // Block raw IP literals (IPv4 & IPv6) to prevent SSRF to internal networks
    const strippedHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
    const ipVersion = net.isIP(strippedHost);
    if (ipVersion === 6) {
        return { ok: false, reason: 'IPv6 literal URLs are not allowed' };
    }
    if (ipVersion === 4 && isPrivateIpv4(strippedHost)) {
        return { ok: false, reason: 'Private IP addresses are not allowed' };
    }
    return { ok: true };
}
export function getLanIpv4Addresses() {
    const interfaces = os.networkInterfaces();
    const addrs = [];
    for (const ifaceList of Object.values(interfaces)) {
        if (!ifaceList)
            continue;
        for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addrs.push(iface.address);
            }
        }
    }
    return addrs;
}
export function getAllowedOrigins() {
    const origins = new Set([
        `http://localhost:${PORT}`,
        `http://127.0.0.1:${PORT}`,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]);
    if (LAN_ENABLED) {
        for (const ip of getLanIpv4Addresses()) {
            origins.add(`http://${ip}:${PORT}`);
            origins.add(`http://${ip}:5173`);
        }
    }
    return origins;
}
export function getOrCreateAccessToken() {
    const db = getDb();
    const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ?')
        .get(TOKEN_SETTING_KEY);
    if (row?.value && row.value.length >= 16) {
        return row.value;
    }
    const token = crypto.randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(TOKEN_SETTING_KEY, token);
    return token;
}
export function rotateAccessToken() {
    const db = getDb();
    const token = crypto.randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(TOKEN_SETTING_KEY, token);
    return token;
}
export function deriveSessionValue(token) {
    return crypto.createHmac('sha256', token).update('melody-session-v1').digest('base64url');
}
function timingSafeEqualStr(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
export function verifyAccessToken(candidate) {
    if (!candidate || typeof candidate !== 'string')
        return false;
    const expected = getOrCreateAccessToken();
    return timingSafeEqualStr(candidate.trim(), expected);
}
function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader)
        return out;
    for (const part of cookieHeader.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1)
            continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) {
            try {
                out[key] = decodeURIComponent(val);
            }
            catch {
                out[key] = val;
            }
        }
    }
    return out;
}
function isLoopbackIp(ip) {
    if (!ip)
        return false;
    const clean = ip.trim();
    return clean === '127.0.0.1' || clean === '::1' || clean === '::ffff:127.0.0.1';
}
export function getClientIp(req) {
    const socketIp = req.socket.remoteAddress || '';
    if (isLoopbackIp(socketIp)) {
        const xff = req.headers['x-forwarded-for'];
        if (typeof xff === 'string' && xff.trim()) {
            return xff.split(',')[0].trim();
        }
    }
    return socketIp;
}
/**
 * Returns true ONLY if the request genuinely originates from this machine's loopback
 * interface (not proxied from a LAN device and not using a non-localhost Host header).
 */
export function isLocalhostRequest(req) {
    const clientIp = getClientIp(req);
    if (!isLoopbackIp(clientIp))
        return false;
    const hostHeader = (req.headers.host || '').toLowerCase();
    const hostWithoutPort = hostHeader.replace(/:\d+$/, '');
    if (hostWithoutPort !== 'localhost' &&
        hostWithoutPort !== '127.0.0.1' &&
        hostWithoutPort !== '[::1]') {
        return false;
    }
    return true;
}
export function isAuthenticatedRequest(req, allowQueryToken = false) {
    if (isLocalhostRequest(req))
        return true;
    const token = getOrCreateAccessToken();
    // 1. Check HttpOnly session cookie
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies[SESSION_COOKIE_NAME];
    if (sessionCookie) {
        const expectedSession = deriveSessionValue(token);
        if (timingSafeEqualStr(sessionCookie, expectedSession)) {
            return true;
        }
    }
    // 2. Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const candidate = authHeader.slice(7).trim();
        if (timingSafeEqualStr(candidate, token))
            return true;
    }
    // 3. Check X-Melody-Token header
    const customHeader = req.headers['x-melody-token'];
    if (typeof customHeader === 'string' && timingSafeEqualStr(customHeader.trim(), token)) {
        return true;
    }
    // 4. Optional query token (for Apple Shortcuts webhook)
    if (allowQueryToken && typeof req.query.token === 'string') {
        if (timingSafeEqualStr(req.query.token.trim(), token))
            return true;
    }
    return false;
}
// Reject cross-origin requests from untrusted websites (blocks CSRF & localhost attacks)
export function enforceAllowedOrigin(req, res, next) {
    const origin = req.headers.origin;
    if (origin) {
        const allowed = getAllowedOrigins();
        if (!allowed.has(origin)) {
            res.status(403).json({ error: 'Origin not allowed' });
            return;
        }
    }
    next();
}
// Auth middleware for /api and /media
export function requireAuth(req, res, next) {
    // Public auth/health endpoints
    const p = req.path;
    if (req.baseUrl === '/api' &&
        (p === '/health' || p === '/auth/status' || p === '/auth/login' || p === '/auth/logout')) {
        next();
        return;
    }
    const allowQueryToken = req.baseUrl === '/api' && p === '/app-usage/mobile-event';
    if (isAuthenticatedRequest(req, allowQueryToken)) {
        next();
        return;
    }
    res.status(401).json({ error: 'Authentication required', authRequired: true });
}
// Simple in-memory rate limiter for /api/auth/login
const loginAttempts = new Map();
export function checkLoginRateLimit(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        return { allowed: true };
    }
    if (entry.count >= 10) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
}
export function recordLoginFailure(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }
    else {
        entry.count += 1;
    }
}
export function clearLoginFailures(ip) {
    loginAttempts.delete(ip);
}
