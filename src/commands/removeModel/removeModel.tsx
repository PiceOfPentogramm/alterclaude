import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { Box, Text, useInput } from '../../ink.js'
import { getInitialSettings, updateSettingsForSource } from '../../utils/settings/settings.js'

function RemoveModelScreen({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const models = useMemo(() => getInitialSettings().customModels ?? [], [])
  const [focusIndex, setFocusIndex] = useState(0)
  const focusIndexRef = useRef(0)
  const modelsRef = useRef(models)
  modelsRef.current = models
  focusIndexRef.current = focusIndex

  useKeybinding('confirm:no', () => onDone(undefined, { display: 'skip' }), { context: 'Settings' })

  const handleRemove = useCallback((index: number) => {
    const current = getInitialSettings().customModels ?? []
    const removed = current[index]
    if (!removed) return
    const updated = current.filter((_, i) => i !== index)
    updateSettingsForSource('localSettings', { customModels: updated })
    onDone(`Removed "${removed}" from custom models.`, { display: 'system' })
  }, [onDone])

  useInput((_input, key) => {
    if (key.upArrow) {
      setFocusIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setFocusIndex(i => Math.min(modelsRef.current.length - 1, i + 1))
      return
    }
    if (key.return) {
      const idx = focusIndexRef.current
      if (modelsRef.current.length > 0 && idx < modelsRef.current.length) {
        handleRemove(idx)
      }
      return
    }
  })

  if (models.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>No custom models to remove.</Text>
        <Text dimColor>Use /addmodel to add one. Press Esc to cancel.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Box>
        <Text bold>Remove Custom Model</Text>
      </Box>
      <Box flexDirection="column" gap={0}>
        {models.map((model, i) => {
          const isFocused = i === focusIndex
          return (
            <Box key={model}>
              <Text color={isFocused ? 'red' : undefined}>
                {isFocused ? '▸ ' : '  '}{model}
              </Text>
            </Box>
          )
        })}
      </Box>
      <Box>
        <Text dimColor>↑↓ navigate · Enter remove · Esc cancel</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone) => {
  return <RemoveModelScreen onDone={onDone} />
}