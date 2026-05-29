import type { Command } from '../../commands.js'

const addModel = {
  type: 'local-jsx',
  name: 'addmodel',
  aliases: ['add-model'],
  description: 'Browse and add OpenRouter models to the model picker',
  isEnabled: () =>
    !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY),
  load: () => import('./addModel.js'),
} satisfies Command

export default addModel