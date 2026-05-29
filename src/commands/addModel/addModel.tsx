import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import { Box, Text, useInput } from '../../ink.js'
import { getInitialSettings, updateSettingsForSource } from '../../utils/settings/settings.js'
import {
  fetchOpenRouterModels,
  formatModelDescription,
  type OpenRouterModelInfo,
} from './openrouterModels.js'

const VISIBLE_COUNT = 7

function AddModelScreen({
  onDone,
}: {
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const [allModels, setAllModels] = useState<OpenRouterModelInfo[] | null>(null)
  const [query, setQuery] = useState('')
  const [focusIndex, setFocusIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const filteredRef = useRef<OpenRouterModelInfo[]>([])
  const focusIndexRef = useRef(0)

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || ''

  useEffect(() => {
    let cancelled = false
    fetchOpenRouterModels(apiKey).then(models => {
      if (cancelled) return
      if (models.length === 0) {
        setError('Could not fetch model list. Check your API key and connection.')
        setAllModels([])
      } else {
        setAllModels(models.sort((a, b) => a.id.localeCompare(b.id)))
      }
    })
    return () => { cancelled = true }
  }, [apiKey])

  const filtered = useMemo(() => {
    if (!allModels) return []
    const q = query.toLowerCase().trim()
    if (!q) return allModels.slice(0, 25)
    return allModels
      .filter(m => m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)))
      .slice(0, 50)
  }, [allModels, query])

  // Keep refs in sync for useInput callback
  filteredRef.current = filtered
  focusIndexRef.current = focusIndex

  useEffect(() => {
    setFocusIndex(0)
    setScrollOffset(0)
  }, [filtered.length])

  const visible = filtered.slice(scrollOffset, scrollOffset + VISIBLE_COUNT)

  const handleSelect = useCallback(async (modelId: string) => {
    const current = getInitialSettings().customModels ?? []
    if (current.includes(modelId)) {
      onDone(`"${modelId}" is already in your custom models.`, { display: 'system' })
      return
    }
    current.push(modelId)
    await updateSettingsForSource('localSettings', { customModels: current })
    onDone(`Added "${modelId}" to custom models.`, { display: 'system' })
  }, [onDone])

  useKeybinding('confirm:no', () => onDone(undefined, { display: 'skip' }), { context: 'Settings' })

  useInput((_input, key) => {
    if (key.upArrow) {
      if (focusIndex > 0) {
        setFocusIndex(i => i - 1)
      } else if (scrollOffset > 0) {
        setScrollOffset(s => s - 1)
      }
      return
    }
    if (key.downArrow) {
      if (focusIndex < VISIBLE_COUNT - 1 && focusIndex < filteredRef.current.length - 1 - scrollOffset) {
        setFocusIndex(i => i + 1)
      } else if (scrollOffset + VISIBLE_COUNT < filteredRef.current.length) {
        setScrollOffset(s => s + 1)
      }
      return
    }
    if (key.return) {
      const idx = scrollOffset + focusIndexRef.current
      if (filteredRef.current.length > 0 && idx < filteredRef.current.length) {
        handleSelect(filteredRef.current[idx].id)
      }
      return
    }
    if (key.backspace || key.delete) {
      setQuery(prev => prev.slice(0, -1))
      return
    }
    if (_input && !key.ctrl && !key.meta) {
      setQuery(prev => prev + _input)
    }
  })

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error}</Text>
        <Text dimColor>Press Esc to cancel.</Text>
      </Box>
    )
  }

  if (allModels === null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading OpenRouter models...</Text>
      </Box>
    )
  }

  const totalCount = allModels.length

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Box>
        <Text bold>Add Model </Text>
        <Text dimColor>({totalCount} available)</Text>
      </Box>
      <Box>
        <Text>Search: </Text>
        <Text inverse>{query || 'type to filter'}</Text>
      </Box>

      {filtered.length === 0 ? (
        <Text dimColor>No models match your search.</Text>
      ) : (
        <Box flexDirection="column" gap={0}>
          {scrollOffset > 0 && (
            <Box paddingLeft={2}>
              <Text dimColor>↑ {scrollOffset} more above</Text>
            </Box>
          )}
          {visible.map((m, i) => {
            const isFocused = i === focusIndex
            const desc = formatModelDescription(m)
            const label = m.name || m.id.split('/').pop() || m.id
            return (
              <Box key={m.id} flexDirection="column">
                <Box>
                  <Text color={isFocused ? 'cyan' : undefined}>
                    {isFocused ? '▸ ' : '  '}{label}
                  </Text>
                </Box>
                {desc && (
                  <Box paddingLeft={2}>
                    <Text dimColor>{desc}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
          {scrollOffset + VISIBLE_COUNT < filtered.length && (
            <Box paddingLeft={2}>
              <Text dimColor>↓ {filtered.length - scrollOffset - VISIBLE_COUNT} more below</Text>
            </Box>
          )}
        </Box>
      )}
      <Box>
        <Text dimColor>↑↓ navigate · Enter add · type to search · Esc cancel</Text>
      </Box>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone) => {
  return <AddModelScreen onDone={onDone} />
}