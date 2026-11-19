import { isIP } from 'node:net';

export const fields = {
  name: [3, 48], creator: [2, 48], description: [10, 160],
};

export function validate(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: 'Send a JSON object.' };
  }
  const errors = {};
  const allowed = [...Object.keys(fields), 'ip', 'port'];
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors[key] = 'Unknown field. Check the spelling.';
  }
  if (partial && !Object.keys(body).length) errors.body = 'Include at least one field to update.';
  for (const [key, [min, max]] of Object.entries(fields)) {
    if (partial && !(key in body)) continue;
    const value = body[key];
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      errors[key] = `Use ${min}–${max} characters.`;
    } else if (/[\x00-\x1f\x7f<>]/.test(value)) {
      errors[key] = 'Use a single line of plain text, without HTML.';
    }
  }
  if (!partial || 'ip' in body) {
    // IPv4 only keeps the networking lesson and URL formatting simple.
    if (typeof body.ip !== 'string' || isIP(body.ip) !== 4) {
      errors.ip = 'Use an IPv4 address like 192.168.1.42, without http:// or a port.';
    } else {
      const [a, b] = body.ip.split('.').map(Number);
      if (a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254)) {
        errors.ip = 'Use your reachable Wi-Fi IPv4 address, not loopback, link-local, or multicast.';
      }
    }
  }
  if (!partial || 'port' in body) {
    if (!Number.isInteger(body.port) || body.port < 1024 || body.port > 65535) {
      errors.port = 'Use a JSON number between 1024 and 65535, like 3001.';
    }
  }
  return errors;
}

export function clean(body) {
  return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}
