import type { Command } from '../../commands.js'

const removeModel = {
  type: 'local-jsx',
  name: 'removemodel',
  aliases: ['remove-model', 'rmmodel'],
  description: 'Remove a custom model from the model picker',
  load: () => import('./removeModel.js'),
} satisfies Command

export default removeModel