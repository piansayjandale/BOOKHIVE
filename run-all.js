const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect the local IPv4 address, prioritizing physical adapters (Wi-Fi, Ethernet)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = '127.0.0.1';
  let bestIp = null;
  
  const nameKeys = Object.keys(interfaces);
  
  // First pass: look for a physical Wi-Fi/WLAN or Ethernet adapter
  for (const name of nameKeys) {
    const isVirtual = name.toLowerCase().includes('virtual') || 
                      name.toLowerCase().includes('vbox') || 
                      name.toLowerCase().includes('vmware') || 
                      name.toLowerCase().includes('vethernet') || 
                      name.toLowerCase().includes('docker') || 
                      name.toLowerCase().includes('loopback');
                      
    if (isVirtual) continue;
    
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
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
  
  // Second pass: fallback to any non-internal IPv4
  for (const name of nameKeys) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
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

const useTunnel = process.argv.includes('--tunnel');
const useWeb = process.argv.includes('--web');

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
    env: { NODE_OPTIONS: '--max-old-space-size=2048' }
  },
  {
    name: 'Student Mobile',
    dir: path.join(__dirname, 'Student'),
    command: 'npm',
    args: useWeb ? ['run', 'web'] : (useTunnel ? ['run', 'start:tunnel'] : ['run', 'start:lan']),
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
