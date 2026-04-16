import { createInterface } from 'readline';
import { loadConfig, saveConfig, apiRequest } from '../client.mjs';

const rl = createInterface({ input: process.stdin, output: process.stderr });

rl._writeToOutput = function _writeToOutput(stringToWrite) {
  if (rl.stdoutMuted) {
    rl.output.write('*');
  } else {
    rl.output.write(stringToWrite);
  }
};

function prompt(question, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` [${defaultVal}]` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function promptSecret(question) {
  return new Promise((resolve) => {
    rl.question(`  ${question}: `, (answer) => {
      rl.stdoutMuted = false;
      process.stderr.write('\n');
      resolve(answer.trim());
    });
    rl.stdoutMuted = true;
  });
}

export async function run() {
  process.stderr.write('\n  Metabase Skill Setup\n  ====================\n\n');

  const config = loadConfig() || { default: null, instances: {} };
  const existing = Object.keys(config.instances);
  if (existing.length > 0) {
    process.stderr.write(`  Existing instances: ${existing.join(', ')}\n\n`);
  }

  const name = await prompt('Instance name (e.g. production, staging)');
  if (!name) {
    process.stderr.write('  Error: Instance name is required.\n');
    process.exit(1);
  }

  const url = await prompt('Metabase base URL (e.g. https://metabase.example.com)');
  if (!url) {
    process.stderr.write('  Error: URL is required.\n');
    process.exit(1);
  }

  process.stderr.write('\n  Auth mode:\n');
  process.stderr.write('    env    — store the name of an env var holding the API key (recommended)\n');
  process.stderr.write('    direct — store the API key directly in config.json\n');
  const mode = (await prompt('Mode (env/direct)', 'env')).toLowerCase();
  if (mode !== 'env' && mode !== 'direct') {
    process.stderr.write('  Error: Mode must be "env" or "direct".\n');
    process.exit(1);
  }

  let apiKey;
  const instanceRecord = { url: url.replace(/\/+$/, '') };

  if (mode === 'env') {
    const keyEnvVar = await prompt('Env var name for API key (e.g. METABASE_API_KEY)');
    if (!keyEnvVar) {
      process.stderr.write('  Error: Env var name is required.\n');
      process.exit(1);
    }
    apiKey = process.env[keyEnvVar];
    if (!apiKey) {
      process.stderr.write(`\n  Error: ${keyEnvVar} is not set in your environment.\n`);
      process.stderr.write(`  Set it first: export ${keyEnvVar}="your-api-key"\n`);
      process.exit(1);
    }
    instanceRecord.keyEnvVar = keyEnvVar;
  } else {
    apiKey = await promptSecret('API key (input hidden)');
    if (!apiKey) {
      process.stderr.write('  Error: API key is required.\n');
      process.exit(1);
    }
    instanceRecord.apiKey = apiKey;
  }

  process.stderr.write('\n  Testing connection...\n');
  try {
    const instance = { url: instanceRecord.url, apiKey };
    const { data } = await apiRequest(instance, 'GET', '/api/user/current');
    process.stderr.write(`  Connected as: ${data.common_name || data.email} (${data.email})\n`);

    const { data: dbs } = await apiRequest(instance, 'GET', '/api/database');
    const dbList = (dbs.data || dbs).map(d => d.name);
    process.stderr.write(`  Databases: ${dbList.join(', ')}\n`);
  } catch (err) {
    process.stderr.write(`  Connection failed: ${err.message}\n`);
    process.exit(1);
  }

  config.instances[name] = instanceRecord;
  if (!config.default || existing.length === 0) {
    config.default = name;
  }

  const isDefault = config.default === name;
  if (!isDefault && existing.length > 0) {
    const setDefault = await prompt(`Set "${name}" as default? (y/n)`, 'n');
    if (setDefault.toLowerCase() === 'y') {
      config.default = name;
    }
  }

  const configPath = saveConfig(config);
  process.stderr.write(`\n  Saved to ${configPath}\n`);
  process.stderr.write(`  Default instance: ${config.default}\n`);
  if (mode === 'direct') {
    process.stderr.write(`  Note: API key is stored in ${configPath} (chmod 0600). Rotate the key if this file is ever exposed.\n`);
  }
  process.stderr.write('\n  Setup complete!\n\n');

  rl.close();
}
