# AlterClaude

Используй Claude Code с **любой моделью** — GPT, DeepSeek, Gemini, Llama, OpenRouter, локальные через Ollama — не только Claude.

Просто установи и запусти `/provider` внутри программы.

```bash
npm install -g @piceofpentogramm/alterclaude
alterclaude
```

Когда увидишь экран приветствия, напиши `/provider` и выбери провайдера. Мастер сам попросит ключ, endpoint, модель — и сохранит настройки. При следующем запуске всё будет готово.

---

## Быстрый старт

```bash
npm install -g @piceofpentogramm/alterclaude
alterclaude
# внутри напиши: /provider
# выбери OpenRouter / OpenAI / Gemini / Ollama и следуй шагам
```

После настройки просто запускай `alterclaude` — профиль подхватится автоматически.

### Вручную (без /provider)

**OpenRouter:**
```bash
export CLAUDE_CODE_USE_OPENROUTER=1
export OPENROUTER_API_KEY=sk-or-v1-ваш-ключ
alterclaude
```

**OpenAI:**
```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-ваш-ключ
alterclaude
```

**Windows PowerShell:**
```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-ваш-ключ"
alterclaude
```

---

## Зависимости

- **Node.js 20+**
- **Docker** (требуется для веб-поиска через SearXNG; если Docker не установлен, поиск будет недоступен, но всё остальное работает)
- **ripgrep** (нужен для поиска по файлам; если не установлен, AlterClaude предупредит при запуске)

---

## Что работает

Все инструменты Claude Code — Bash, файловые операции, поиск, агенты, MCP, LSP — работают с любой моделью.

- Стриминг токенов в реальном времени
- Многошаговые вызовы инструментов
- Изображения (base64/URL) для vision-моделей
- Slash-команды: `/commit`, `/review`, `/compact`, `/diff`, `/doctor`, `/provider` и другие
- Sub-агенты и система памяти

## Чего нет

- Anthropic thinking mode (не нужен для OpenAI-совместимых моделей)
- Prompt caching (Anthropic-специфичная фича)
- Beta-фичи Anthropic

---

## Как это работает

Прослойка перехватывает запросы Claude Code и переводит их в OpenAI-формат. Остальной код не знает, что говорит с другой моделью.

```
Claude Code → openaiShim.ts → OpenAI API → любая модель
```

---

## Origin

Форк [OpenClaude](https://github.com/Gitlawb/openclaude). Оригинальный Claude Code — собственность Anthropic. Не аффилирован и не одобрен Anthropic.

## License

MIT