import type { Command } from '../../commands.js'

const ide = {
  type: 'local-jsx',
  name: 'ide',
  description: 'Manage IDE integrations and show status',
  argumentHint: '[open]',
  availability: ['claude-ai'],
  load: () => import('./ide.js'),
} satisfies Command

export default ide
