// LM Studio интеграция для автономного AI ассистента с полным доступом к системе
import { LMStudioClient } from '@lmstudio/sdk'
import { invoke } from '@tauri-apps/api/core'

// Интерфейс для результата действия
interface ActionResult {
  success: boolean
  output: string
  error?: string
}

// Доступные инструменты для агента
interface AvailableTool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any) => Promise<ActionResult>
}

class LMStudioService {
  private client: LMStudioClient | null = null
  private model: any = null
  private isConnected: boolean = false
  private conversationHistory: Array<{ role: string; content: string }> = []
  private availableTools: Map<string, AvailableTool> = new Map()

  constructor() {
    this.initTools()
    this.init()
  }

  // Инициализация подключения к LM Studio
  async init() {
    try {
      console.log('🔌 Подключаюсь к LM Studio...')
      this.client = new LMStudioClient()
      
      // Проверяем доступные модели
      const models = await this.client.system.listDownloadedModels()
      console.log('📦 Доступные модели:', models.map(m => m.path))

      if (models.length > 0) {
        // Загружаем первую доступную модель
        const modelPath = models[0].path
        console.log(`🚀 Загружаю модель: ${modelPath}`)
        this.model = await this.client.llm.model(modelPath)
        this.isConnected = true
        console.log('✅ LM Studio готов к работе!')
      } else {
        console.warn('⚠️ Нет загруженных моделей в LM Studio')
      }
    } catch (error) {
      console.error('❌ Ошибка подключения к LM Studio:', error)
      this.isConnected = false
    }
  }

  // Проверка готовности
  isReady(): boolean {
    return this.isConnected && this.model !== null
  }

  // Получить ответ от LLM
  async chat(userMessage: string, systemPrompt?: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LM Studio не готов. Убедитесь, что приложение запущено и модель загружена.')
    }

    try {
      const messages = []
      
      // Системный промпт
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        })
      } else {
        messages.push({
          role: 'system',
          content: `Ты - Люси, умный AI-ассистент из аниме Elfen Lied. 
Ты помогаешь пользователю управлять компьютером через голосовые команды.
Отвечай кратко, по делу, на русском языке.
Если команда связана с системой - объясни что будет сделано.`
        })
      }

      messages.push({
        role: 'user',
        content: userMessage
      })

      console.log('🤖 Отправляю запрос в LM Studio...')
      const response = await this.model.respond(messages, {
        temperature: 0.7,
        maxPredictedTokens: 150
      })

      return response.content.trim()
    } catch (error) {
      console.error('❌ Ошибка LLM:', error)
      throw error
    }
  }

  // Чат со стримингом (для будущего использования)
  async *chatStreaming(userMessage: string, systemPrompt?: string): AsyncGenerator<string> {
    if (!this.isReady()) {
      throw new Error('LM Studio не готов')
    }

    const messages = []
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    } else {
      messages.push({
        role: 'system',
        content: `Ты - Люси, AI-ассистент. Отвечай кратко на русском.`
      })
    }

    messages.push({ role: 'user', content: userMessage })

    const prediction = this.model.respond(messages, {
      temperature: 0.7,
      maxPredictedTokens: 150,
      onToken: () => {
        // Будет использоваться для стриминга
      }
    })

    for await (const chunk of prediction) {
      if (chunk.content) {
        yield chunk.content
      }
    }
  }

  // Интеллектуальная интерпретация команды
  async interpretCommand(command: string): Promise<{
    intent: string
    action: string
    parameters: Record<string, any>
    needsConfirmation: boolean
  }> {
    if (!this.isReady()) {
      // Если LM Studio не доступен, используем простую интерпретацию
      return this.fallbackInterpretation(command)
    }

    try {
      const prompt = `Проанализируй голосовую команду и определи намерение пользователя.
Команда: "${command}"

Ответь в формате JSON:
{
  "intent": "описание намерения",
  "action": "system_command|open_app|open_file|chat|unknown",
  "parameters": { "app": "название", "path": "путь" },
  "needsConfirmation": true/false
}

Примеры:
"открой блокнот" -> {"intent": "открыть приложение блокнот", "action": "open_app", "parameters": {"app": "notepad"}, "needsConfirmation": false}
"удали все файлы" -> {"intent": "удалить файлы", "action": "system_command", "parameters": {"command": "delete"}, "needsConfirmation": true}
"привет" -> {"intent": "поприветствовать", "action": "chat", "parameters": {}, "needsConfirmation": false}`

      const response = await this.chat(prompt, 'Ты - анализатор команд. Отвечай только в формате JSON.')
      
      // Парсим JSON из ответа
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      return this.fallbackInterpretation(command)
    } catch (error) {
      console.error('Ошибка интерпретации команды:', error)
      return this.fallbackInterpretation(command)
    }
  }

  // Запасная интерпретация без LLM
  private fallbackInterpretation(command: string) {
    const lower = command.toLowerCase()
    
    // Простые правила
    if (lower.includes('открой') || lower.includes('запусти')) {
      if (lower.includes('блокнот')) {
        return {
          intent: 'открыть блокнот',
          action: 'open_app',
          parameters: { app: 'notepad' },
          needsConfirmation: false
        }
      }
      if (lower.includes('калькулятор')) {
        return {
          intent: 'открыть калькулятор',
          action: 'open_app',
          parameters: { app: 'calc' },
          needsConfirmation: false
        }
      }
    }

    return {
      intent: 'обработать как обычный чат',
      action: 'chat',
      parameters: {},
      needsConfirmation: false
    }
  }

  // Инициализация инструментов (tools) для агента
  private initTools() {
    // Выполнение shell команды
    this.availableTools.set('execute_command', {
      name: 'execute_command',
      description: 'Выполнить команду в терминале (cmd, powershell). Используй для запуска программ, создания файлов, получения информации о системе.',
      parameters: {
        command: 'string - команда для выполнения',
        shell: 'string - тип shell (cmd или powershell)'
      },
      execute: async (params) => {
        try {
          const result = await invoke('execute_shell_command', {
            command: params.command,
            args: params.args || []
          })
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Открытие приложения
    this.availableTools.set('open_application', {
      name: 'open_application',
      description: 'Открыть приложение (notepad, calc, explorer, chrome, discord и т.д.)',
      parameters: {
        appName: 'string - название приложения'
      },
      execute: async (params) => {
        try {
          await invoke('open_application', { appName: params.appName })
          return { success: true, output: `Приложение ${params.appName} открыто` }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Создание файла
    this.availableTools.set('create_file', {
      name: 'create_file',
      description: 'Создать новый файл с содержимым',
      parameters: {
        path: 'string - путь к файлу',
        content: 'string - содержимое файла'
      },
      execute: async (params) => {
        try {
          await invoke('create_file', {
            path: params.path,
            content: params.content || ''
          })
          return { success: true, output: `Файл создан: ${params.path}` }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Чтение файла
    this.availableTools.set('read_file', {
      name: 'read_file',
      description: 'Прочитать содержимое файла',
      parameters: {
        path: 'string - путь к файлу'
      },
      execute: async (params) => {
        try {
          const result = await invoke('read_file', { path: params.path })
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Получение списка процессов
    this.availableTools.set('get_processes', {
      name: 'get_processes',
      description: 'Получить список запущенных процессов',
      parameters: {},
      execute: async () => {
        try {
          const result = await invoke('get_process_list')
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Получение информации о системе
    this.availableTools.set('get_system_info', {
      name: 'get_system_info',
      description: 'Получить информацию о системе (ОС, память, процессор)',
      parameters: {},
      execute: async () => {
        try {
          const result = await invoke('get_system_info')
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    // Поиск файлов
    this.availableTools.set('search_files', {
      name: 'search_files',
      description: 'Найти файлы по паттерну',
      parameters: {
        directory: 'string - директория для поиска',
        pattern: 'string - паттерн поиска (*.txt, *.jpg и т.д.)'
      },
      execute: async (params) => {
        try {
          // Используем dir для поиска
          const cmd = `dir "${params.directory}\\${params.pattern}" /s /b`
          const result = await invoke('execute_shell_command', {
            command: 'cmd',
            args: ['/c', cmd]
          })
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    console.log(`🛠️ Инициализировано ${this.availableTools.size} инструментов для агента`)
  }

  // Автономное мышление - агент сам решает какие действия предпринять
  async autonomousThink(userRequest: string, maxIterations: number = 5): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LM Studio не готов')
    }

    console.log('🧠 Начинаю автономное мышление...')
    console.log('📝 Запрос:', userRequest)

    // Очищаем историю для нового запроса
    this.conversationHistory = []

    // Системный промпт для автономного агента
    const systemPrompt = `Ты - Люси, автономный AI-агент с полным доступом к компьютеру пользователя.

ТВОИ ВОЗМОЖНОСТИ:
${Array.from(this.availableTools.entries())
  .map(([name, tool]) => `- ${name}: ${tool.description}`)
  .join('\n')}

ПРАВИЛА РАБОТЫ:
1. Анализируй запрос пользователя и определи, какие действия нужны
2. Используй инструменты для выполнения задачи
3. Можешь выполнять НЕСКОЛЬКО действий последовательно
4. Думай логически - если нужно создать файл, сначала проверь существование папки
5. Если команда опасная (удаление, изменение системы) - предупреди пользователя
6. Всегда объясняй, что ты делаешь

ФОРМАТ ОТВЕТА:
Когда нужно использовать инструмент, отвечай в формате:
TOOL: <название_инструмента>
PARAMS: <параметры в JSON>
REASON: <почему используешь этот инструмент>

Когда задача выполнена, отвечай:
DONE: <финальный ответ пользователю>

ПРИМЕР:
Запрос: "создай файл hello.txt с текстом привет"
TOOL: create_file
PARAMS: {"path": "hello.txt", "content": "привет"}
REASON: Создаю файл hello.txt с указанным содержимым

После выполнения:
DONE: ✅ Файл hello.txt создан с текстом "привет"`

    this.conversationHistory.push({
      role: 'system',
      content: systemPrompt
    })

    this.conversationHistory.push({
      role: 'user',
      content: userRequest
    })

    let iteration = 0
    let finalAnswer = ''
    const executionLog: string[] = []

    while (iteration < maxIterations) {
      iteration++
      console.log(`🔄 Итерация ${iteration}/${maxIterations}`)

      // Получаем ответ от модели
      const response = await this.model.respond(this.conversationHistory, {
        temperature: 0.7,
        maxPredictedTokens: 500
      })

      const agentResponse = response.content.trim()
      console.log('🤖 Ответ агента:', agentResponse)

      // Проверяем, завершил ли агент работу
      if (agentResponse.includes('DONE:')) {
        const doneMatch = agentResponse.match(/DONE:\s*(.+)/s)
        if (doneMatch) {
          finalAnswer = doneMatch[1].trim()
          break
        }
      }

      // Проверяем, хочет ли агент использовать инструмент
      if (agentResponse.includes('TOOL:')) {
        const toolMatch = agentResponse.match(/TOOL:\s*(\w+)/i)
        const paramsMatch = agentResponse.match(/PARAMS:\s*(\{[\s\S]*?\})/i)
        const reasonMatch = agentResponse.match(/REASON:\s*(.+)/i)

        if (toolMatch && paramsMatch) {
          const toolName = toolMatch[1]
          const tool = this.availableTools.get(toolName)

          if (tool) {
            try {
              const params = JSON.parse(paramsMatch[1])
              const reason = reasonMatch ? reasonMatch[1].trim() : 'Выполнение команды'

              console.log(`🛠️ Использую инструмент: ${toolName}`)
              console.log('📋 Параметры:', params)
              console.log('💭 Причина:', reason)

              executionLog.push(`${reason}`)

              // Выполняем инструмент
              const result = await tool.execute(params)

              if (result.success) {
                console.log('✅ Успешно:', result.output)
                executionLog.push(`✅ ${result.output}`)

                // Добавляем результат в историю
                this.conversationHistory.push({
                  role: 'assistant',
                  content: agentResponse
                })

                this.conversationHistory.push({
                  role: 'user',
                  content: `Результат выполнения ${toolName}: ${result.output}\n\nЧто дальше? Если задача выполнена, ответь DONE: <финальный ответ>`
                })
              } else {
                console.log('❌ Ошибка:', result.error)
                executionLog.push(`❌ Ошибка: ${result.error}`)

                this.conversationHistory.push({
                  role: 'assistant',
                  content: agentResponse
                })

                this.conversationHistory.push({
                  role: 'user',
                  content: `Ошибка при выполнении ${toolName}: ${result.error}\n\nПопробуй другой подход или сообщи об ошибке. Если не можешь выполнить - ответь DONE: <объяснение проблемы>`
                })
              }
            } catch (error) {
              console.error('❌ Ошибка парсинга или выполнения:', error)
              executionLog.push(`❌ Ошибка: ${error}`)

              this.conversationHistory.push({
                role: 'user',
                content: `Ошибка: ${error}. Ответь DONE: <объяснение проблемы>`
              })
            }
          } else {
            console.log('⚠️ Неизвестный инструмент:', toolName)
            this.conversationHistory.push({
              role: 'user',
              content: `Инструмент ${toolName} не существует. Используй доступные инструменты или ответь DONE:`
            })
          }
        }
      } else {
        // Если агент не использует инструменты и не сказал DONE, подсказываем
        this.conversationHistory.push({
          role: 'assistant',
          content: agentResponse
        })

        this.conversationHistory.push({
          role: 'user',
          content: 'Используй инструменты для выполнения задачи или ответь DONE: если задача выполнена/невозможна'
        })
      }
    }

    if (!finalAnswer) {
      finalAnswer = `⚠️ Не удалось завершить задачу за ${maxIterations} итераций.\n\nВыполнено:\n${executionLog.join('\n')}`
    } else if (executionLog.length > 0) {
      finalAnswer = `${executionLog.join('\n')}\n\n${finalAnswer}`
    }

    console.log('🎯 Финальный ответ:', finalAnswer)
    return finalAnswer
  }

  // Получить информацию о модели
  async getModelInfo() {
    if (!this.client) return null
    
    try {
      const models = await this.client.system.listDownloadedModels()
      return models.length > 0 ? models[0] : null
    } catch (error) {
      console.error('Ошибка получения информации о модели:', error)
      return null
    }
  }

  // Переподключиться
  async reconnect() {
    this.isConnected = false
    this.model = null
    await this.init()
  }

  // Получить список доступных инструментов
  getAvailableTools(): string[] {
    return Array.from(this.availableTools.keys())
  }
}

// Единственный экземпляр сервиса
export const lmStudioService = new LMStudioService()
