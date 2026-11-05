import * as dotenv from 'dotenv';
import * as dns from 'node:dns';
import * as net from 'node:net';

// Prevent Node.js Happy Eyeballs (autoSelectFamily) from timing out on
// dual-stack hosts like Backblaze B2 when local IPv6 routing is unavailable.
dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

dotenv.config({
  path: process.env.ENV_PATH ?? '.env.local',
  quiet: true,
});
