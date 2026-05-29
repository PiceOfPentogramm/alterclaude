import type { Command } from '../../commands.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the Claude mobile app',
  availability: ['claude-ai'],
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile
