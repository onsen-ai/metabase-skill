import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';

const CONFIG_DIR = join(homedir(), '.metabase-skill');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    if (!config || typeof config !== 'object') return null;
    return config;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  return CONFIG_FILE;
}

export function resolveInstance(config, instanceName) {
  if (!config?.instances) {
    process.stderr.write('Error: No config found. Run: node scripts/metabase.mjs setup\n');
    process.exit(1);
  }
  const name = instanceName || config.default;
  const inst = config.instances[name];
  if (!inst) {
    process.stderr.write(`Error: Instance "${name}" not found. Available: ${Object.keys(config.instances).join(', ')}\n`);
    process.exit(1);
  }
  let apiKey;
  if (inst.apiKey) {
    apiKey = inst.apiKey;
  } else if (inst.keyEnvVar) {
    apiKey = process.env[inst.keyEnvVar];
    if (!apiKey) {
      process.stderr.write(`Error: Env var ${inst.keyEnvVar} is not set.\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write(`Error: Instance "${name}" has no apiKey or keyEnvVar configured. Re-run setup.\n`);
    process.exit(1);
  }
  return { url: inst.url, apiKey, name };
}

export function apiRequest(instance, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, instance.url);
    const isHttps = url.protocol === 'https:';
    const reqFn = isHttps ? httpsRequest : httpRequest;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'X-API-Key': instance.apiKey,
        'Accept': 'application/json',
        'User-Agent': 'metabase-skill/1.0',
      },
    };

    if (body !== null) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = reqFn(options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        const status = res.statusCode;

        if (status === 204) {
          resolve({ status, data: null });
          return;
        }

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          if (status >= 400) {
            reject(new ApiError(status, raw.trim() || `HTTP ${status}`));
          } else {
            resolve({ status, data: raw });
          }
          return;
        }

        if (status >= 400) {
          const msg = data.message || data.errors
            ? JSON.stringify(data.errors || data.message)
            : `HTTP ${status}`;
          reject(new ApiError(status, msg, data));
        } else {
          resolve({ status, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timed out after 120s'));
    });

    if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export function parseGlobalArgs(args) {
  let instance = null;
  const filtered = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instance' && i + 1 < args.length) {
      instance = args[++i];
    } else {
      filtered.push(args[i]);
    }
  }
  return { instance, args: filtered };
}

export function writeJsonFile(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  const sizeKB = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0);
  return `Saved to ${filePath} (${sizeKB} KB)`;
}

export function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    process.stderr.write(`Error: File not found: ${filePath}\n`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Error: Invalid JSON in ${filePath}: ${err.message}\n`);
    process.exit(1);
  }
}
