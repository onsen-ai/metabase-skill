import { createInterface } from 'readline';
import { loadConfig, saveConfig, apiRequest } from '../client.mjs';

const rl = createInterface({ input: process.stdin, output: process.stderr });

function prompt(question, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` [${defaultVal}]` : '';
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
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

  const keyEnvVar = await prompt('Env var name for API key (e.g. METABASE_API_KEY)');
  if (!keyEnvVar) {
    process.stderr.write('  Error: Env var name is required.\n');
    process.exit(1);
  }

  const apiKey = process.env[keyEnvVar];
  if (!apiKey) {
    process.stderr.write(`\n  Error: ${keyEnvVar} is not set in your environment.\n`);
    process.stderr.write(`  Set it first: export ${keyEnvVar}="your-api-key"\n`);
    process.exit(1);
  }

  process.stderr.write('\n  Testing connection...\n');
  try {
    const instance = { url: url.replace(/\/+$/, ''), apiKey };
    const { data } = await apiRequest(instance, 'GET', '/api/user/current');
    process.stderr.write(`  Connected as: ${data.common_name || data.email} (${data.email})\n`);

    const { data: dbs } = await apiRequest(instance, 'GET', '/api/database');
    const dbList = (dbs.data || dbs).map(d => d.name);
    process.stderr.write(`  Databases: ${dbList.join(', ')}\n`);
  } catch (err) {
    process.stderr.write(`  Connection failed: ${err.message}\n`);
    process.exit(1);
  }

  config.instances[name] = { url: url.replace(/\/+$/, ''), keyEnvVar };
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
  process.stderr.write('\n  Setup complete!\n\n');

  rl.close();
}
