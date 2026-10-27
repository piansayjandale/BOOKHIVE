import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect the local IPv4 address, prioritizing Windows Mobile Hotspot and physical Wi-Fi/Ethernet adapters
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = '127.0.0.1';
  
  // 0. TOP PRIORITY: Windows Mobile Hotspot adapter (Windows default subnet: 192.168.137.X)
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.137.')) {
          console.log(`\x1b[32m[System] Detected active Windows Mobile Hotspot (${name}): ${net.address}\x1b[0m`);
          return net.address;
        }
      }
    }
  }

  let bestIp = null;
  const nameKeys = Object.keys(interfaces);
  
  // First pass: look for a physical Wi-Fi/WLAN or Ethernet adapter
  for (const name of nameKeys) {
    const isVirtual = name.toLowerCase().includes('vbox') || 
                      name.toLowerCase().includes('vmware') || 
                      name.toLowerCase().includes('vethernet') || 
                      name.toLowerCase().includes('docker') || 
                      name.toLowerCase().includes('loopback');
                      
    if (isVirtual) continue;
    
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        // Skip unassigned APIPA addresses (169.254.x.x)
        if (net.address.startsWith('169.254.')) continue;

        if (name.toLowerCase().includes('wi-fi') || 
            name.toLowerCase().includes('wlan') || 
            name.toLowerCase().includes('wireless') || 
            name.toLowerCase().includes('ethernet') || 
            name.toLowerCase().includes('local area connection')) {
          return net.address;
        }
        if (!bestIp) {
          bestIp = net.address;
        }
      }
    }
  }
  
  if (bestIp) return bestIp;
  
  // Second pass: fallback to any non-internal IPv4 (excluding 169.254.x.x)
  for (const name of nameKeys) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  
  return fallbackIp;
}

const localIp = getLocalIp();
console.log(`\x1b[33m[System] Detected local IPv4 address: ${localIp}\x1b[0m`);

// Write local IP config to the Student app to support tunnel fallback
const configPath = path.join(__dirname, 'Student', 'data', 'backendConfig.json');
try {
  fs.writeFileSync(configPath, JSON.stringify({ localIp }, null, 2));
  console.log(`\x1b[33m[System] Wrote IP configuration to ${configPath}\x1b[0m`);
} catch (err) {
  console.error(`\x1b[31m[System] Failed to write backendConfig.json: ${err.message}\x1b[0m`);
}

// Background monitor to automatically update backendConfig.json when network changes
setInterval(() => {
  const currentIp = getLocalIp();
  try {
    const existing = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
    if (existing.localIp !== currentIp) {
      fs.writeFileSync(configPath, JSON.stringify({ localIp: currentIp }, null, 2));
      console.log(`\x1b[33m[System] Network adapter IP updated to: ${currentIp}\x1b[0m`);
    }
  } catch {}
}, 10000);

const useTunnel = process.argv.includes('--tunnel');
const useLan = process.argv.includes('--lan');
const useWeb = process.argv.includes('--web');
const isHotspot = localIp.startsWith('192.168.137.');
const useOffline = process.argv.includes('--offline') || isHotspot;

const mobileMode = useWeb
  ? 'Web'
  : (useTunnel
      ? 'Tunnel (--tunnel)'
      : (useOffline ? `LAN Offline${isHotspot ? ' (Windows Hotspot)' : ' (--offline)'}` : 'LAN (Default)'));

console.log(`\x1b[36m[System] Student Mobile mode: ${mobileMode}\x1b[0m`);
if (isHotspot) {
  console.log(`\x1b[32m[System] Windows Mobile Hotspot detected (${localIp})! Connect your phone to your PC's Hotspot Wi-Fi.\x1b[0m`);
  console.log(`\x1b[32m[System] Running in 100% offline mode: zero routers and zero internet required.\x1b[0m`);
}
console.log(`\x1b[36m[System] Multi-device Tip: To scan on multiple iOS devices simultaneously, make sure the devices and PC share the same Expo account (run 'npm run expo:login' if needed).\x1b[0m`);
console.log(`\x1b[33m[System] Note: If your phone fails to load or gives "Failed to download remote update", make sure both devices are on the same Wi-Fi, or run 'npm run dev:tunnel'.\x1b[0m`);

console.log(`\x1b[32m[System] Web System (Librarian & Admin) URL: http://localhost:3000 or http://${localIp}:3000\x1b[0m`);

const services = [
  {
    name: 'Backend',
    dir: path.join(__dirname, 'Backend'),
    command: 'npm',
    args: ['run', 'dev'],
    color: '\x1b[32m' // Green
  },
  {
    name: 'Librarian & Admin Web',
    dir: path.join(__dirname, 'Librarian Admin', 'Librarian and Admin'),
    command: 'npm',
    args: ['run', 'frontend:dev'],
    color: '\x1b[36m', // Cyan
    env: { 
      NODE_OPTIONS: '--max-old-space-size=2048',
      ALLOWED_DEV_ORIGINS: `localhost:3000,127.0.0.1:3000,${localIp}:3000,${localIp}:5000,localhost:5000`
    }
  },
  {
    name: 'Student Mobile',
    dir: path.join(__dirname, 'Student'),
    command: 'npm',
    args: useWeb
      ? ['run', 'web']
      : (useTunnel
          ? ['run', 'start:tunnel']
          : (useOffline ? ['run', 'start:offline'] : ['run', 'start:lan'])),
    color: '\x1b[35m' // Magenta
  }
];

const Reset = '\x1b[0m';
const children = [];

services.forEach((service) => {
  console.log(`${service.color}[${service.name}] Starting in ${service.dir}...${Reset}`);
  
  const isStudentMobile = service.name === 'Student Mobile';
  const child = spawn(service.command, service.args, {
    cwd: service.dir,
    stdio: isStudentMobile ? 'inherit' : ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: { 
      ...process.env, 
      ...(useTunnel ? {} : { REACT_NATIVE_PACKAGER_HOSTNAME: localIp }), 
      ...service.env 
    }
  });

  children.push(child);

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          console.log(`${service.color}[${service.name}]${Reset} ${line}`);
        }
      });
    });
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          console.error(`${service.color}[${service.name}]${Reset} \x1b[31m${line}\x1b[0m`);
        }
      });
    });
  }

  child.on('close', (code) => {
    console.log(`${service.color}[${service.name}] Exited with code ${code}${Reset}`);
  });
});

const cleanup = () => {
  console.log('\nShutting down all BookHive services...');
  children.forEach((child) => {
    if (child && !child.killed) {
      try {
        if (process.platform === 'win32') {
          // On Windows, child.kill() might not kill the process tree spawned under shell: true.
          // Using taskkill ensures all child processes of the command are terminated.
          spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
        } else {
          child.kill('SIGTERM');
        }
      } catch (err) {
        console.error(`Failed to kill process: ${err.message}`);
      }
    }
  });
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
