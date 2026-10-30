import { spawn } from 'node:child_process'
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]
for (const event of ['SIGINT', 'SIGTERM'])
  process.on(event, () => {
    children.forEach((child) => child.kill('SIGTERM'))
    process.exit()
  })
children.forEach((child) =>
  child.on('exit', (code) => {
    if (code) children.forEach((c) => c.kill('SIGTERM'))
  }),
)
