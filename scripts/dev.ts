import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const port = process.env.PORT || '3100'
const env = {
  ...process.env,
  CENSITAS_DATA_DIR: resolve(process.env.CENSITAS_DATA_DIR || '.data'),
  // Your own sites.json once you have one, the example until then.
  CENSITAS_SITES: resolve(
    process.env.CENSITAS_SITES || (existsSync('sites.json') ? 'sites.json' : 'sites.example.json'),
  ),
  CENSITAS_USER: process.env.CENSITAS_USER || 'owner',
  CENSITAS_PASSWORD: process.env.CENSITAS_PASSWORD || 'development only',
}
console.info(`censitas development: http://localhost:${port}`)
console.info(`Sites: ${env.CENSITAS_SITES}`)
console.info(
  `Dashboard sign-in: ${process.env.CENSITAS_PASSWORD ? 'configured in environment' : 'owner / development only'}`,
)
const child = spawn('pnpm', ['exec', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', port], {
  env,
  stdio: 'inherit',
})
const stop = () => child.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (code) => process.exit(code ?? 0))
