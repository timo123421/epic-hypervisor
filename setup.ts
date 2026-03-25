import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envPath = path.join(process.cwd(), '.env');
const examplePath = path.join(process.cwd(), '.env.example');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

function generateHex(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

async function setup() {
  console.log('--- Project Nova Setup ---');

  if (fs.existsSync(envPath)) {
    console.log('.env file already exists. Skipping generation.');
    return;
  }

  let exampleContent = '';
  if (fs.existsSync(examplePath)) {
    exampleContent = fs.readFileSync(examplePath, 'utf8');
  }

  const jwtSecret = generateSecret();
  const guacKey = generateHex(32); // 64 chars hex, or 32 bytes raw. 

  // For AES-256-CBC, we need 32 bytes. 
  // If we use a string, it should be 32 chars long.
  const guacKey32 = crypto.randomBytes(32).toString('base64').slice(0, 32);

  let envContent = `JWT_SECRET="${jwtSecret}"\nGUAC_KEY="${guacKey32}"\n`;

  // Append other defaults if example exists
  if (exampleContent) {
    const lines = exampleContent.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && !line.startsWith('JWT_SECRET') && !line.startsWith('GUAC_KEY')) {
        const [key] = line.split('=');
        if (key) {
          envContent += `${key.trim()}=""\n`;
        }
      }
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log('Successfully generated .env file with secure random tokens.');
  console.log('JWT_SECRET and GUAC_KEY have been initialized.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
