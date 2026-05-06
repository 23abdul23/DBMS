const axios = require('axios');
const expoConfig = require('../app.config.js');

const extra = expoConfig?.expo?.extra || {};
const configuredBaseUrl = process.env.API_BASE_URL || extra.API_BASE_URL;
const fallbackHost = process.env.API_HOST || extra.API_HOST || 'localhost';
const fallbackPort = process.env.API_PORT || extra.PORT || 3000;
const apiBaseUrl =
  configuredBaseUrl || `http://${fallbackHost}:${fallbackPort}/api`;

const client = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  validateStatus: () => true,
});

async function run() {
  console.log(`Testing API base URL: ${apiBaseUrl}`);

  let failed = false;

  try {
    const healthResponse = await client.get('/health');
    console.log(`GET /health -> ${healthResponse.status}`);
    console.log(JSON.stringify(healthResponse.data, null, 2));

    if (healthResponse.status !== 200) {
      failed = true;
      console.error('Health check did not return 200.');
    }
  } catch (error) {
    failed = true;
    console.error('GET /health failed before the server returned a response.');
    console.error(error.message);
  }

  try {
    const registerResponse = await client.post('/auth/register', {});
    console.log(`POST /auth/register {} -> ${registerResponse.status}`);
    console.log(JSON.stringify(registerResponse.data, null, 2));

    if (registerResponse.status >= 500) {
      failed = true;
      console.error(
        'Registration route returned a server error for an invalid payload.'
      );
      console.error(
        'Expected a 400 validation response if the route and database path are healthy.'
      );
    } else if (registerResponse.status !== 400) {
      failed = true;
      console.error('Registration route returned an unexpected status.');
      console.error('Expected 400 for an empty payload.');
    }
  } catch (error) {
    failed = true;
    console.error(
      'POST /auth/register failed before the server returned a response.'
    );
    console.error(error.message);
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('API smoke test passed.');
}

run();
