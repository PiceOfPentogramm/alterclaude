import type { Command } from '../../commands.js'

const searchstart = {
  type: 'local-jsx',
  name: 'searchstart',
  aliases: ['search-start'],
  description: 'Start the SearXNG web search container',
  immediate: true,
  load: () => import('./searchstart.js'),
} satisfies Command

export default searchstart