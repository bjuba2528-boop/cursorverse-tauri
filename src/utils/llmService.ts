// LLM сервис на базе Google Gemini
import { invoke } from '@tauri-apps/api/core'

// Типы провайдеров
export type LLMProvider = 'gemini' | 'yandexgpt' | 'lmstudio' | 'lucy'

// Конфигурация провайдера
export interface LLMConfig {
  provider: LLMProvider
  apiKey?: string
  baseURL?: string
  model?: string
  temperature?: number
  maxTokens?: number
  catalogId?: string // Для YandexGPT (ID каталога Yandex Cloud)
}

// Сообщение в чате
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Результат выполнения
export interface ActionResult {
  success: boolean
  output: string
  error?: string
}

// Доступные инструменты для агента
export interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any) => Promise<ActionResult>
}

class UniversalLLMService {
  private config: LLMConfig = {
    provider: 'lmstudio', // По умолчанию LM Studio (локальная LLaMA)
    model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
    temperature: 0.7,
    maxTokens: 2000,
    apiKey: 'lm-studio', // LM Studio не требует ключа
    catalogId: '', // Folder ID из Yandex Cloud
    baseURL: 'http://localhost:1234/v1'
  }

  private isConnected: boolean = false
  private conversationHistory: ChatMessage[] = []
  private availableTools: Map<string, Tool> = new Map()

  constructor() {
    this.initTools()
    this.loadConfig()
    this.init()
  }

  // Загрузка конфигурации из localStorage
  private loadConfig() {
    try {
      const saved = localStorage.getItem('llm_config')
      if (saved) {
        const parsed = JSON.parse(saved)
        this.config = { 
          ...this.config, 
          ...parsed
        }
        console.log('📝 Загружена конфигурация:', this.config.provider, this.config.model)
      }
    } catch (e: any) {
      console.error('Ошибка загрузки конфигурации:', e)
    }
  }

  // Сохранение конфигурации
  saveConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config }
    localStorage.setItem('llm_config', JSON.stringify(this.config))
    console.log('💾 Конфигурация сохранена:', this.config.provider)
    this.init()
  }

  // Получить текущую конфигурацию
  getConfig(): LLMConfig {
    return { ...this.config }
  }

  // Инициализация подключения
  async init() {
    try {
      const provider = this.config.provider || 'yandexgpt'
      console.log(`🔌 Проверка конфигурации ${provider}...`)
      
      if (provider === 'gemini') {
        this.isConnected = !!(this.config.apiKey && this.config.apiKey.trim().length > 0)
        console.log('✅ Gemini готов (фиксированный API ключ)')
      } else if (provider === 'yandexgpt') {
        this.isConnected = !!(this.config.apiKey && this.config.apiKey.trim().length > 0 && 
                             this.config.catalogId && this.config.catalogId.trim().length > 0)
        if (this.isConnected) {
          console.log('✅ YandexGPT готов')
        } else {
          console.warn('⚠️ Укажите API ключ и Catalog ID для YandexGPT')
        }
      } else if (provider === 'lmstudio') {
        // Проверяем доступность LM Studio
        try {
          const response = await fetch(`${this.config.baseURL}/models`, { signal: AbortSignal.timeout(3000) })
          this.isConnected = response.ok
          if (this.isConnected) {
            console.log('✅ LM Studio готов (локальная LLaMA)')
          } else {
            console.warn('⚠️ LM Studio не отвечает. Убедитесь, что сервер запущен на http://localhost:1234')
          }
        } catch (error) {
          this.isConnected = false
          console.warn('⚠️ LM Studio недоступен. Запустите LM Studio и загрузите модель.')
        }
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error)
      this.isConnected = false
    }
  }

  // Проверка готовности
  isReady(): boolean {
    return this.isConnected
  }

  // Отправить запрос в LLM через REST API
  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.isReady()) {
      throw new Error('AI не готов. Укажите API ключ в настройках.')
    }

    try {
      const provider = this.config.provider || 'yandexgpt'
      
      switch (provider) {
        case 'gemini':
          return await this.chatGemini(messages)
        case 'yandexgpt':
          return await this.chatYandexGPT(messages)
        case 'lmstudio':
          return await this.chatLMStudio(messages)
        case 'lucy':
          return await this.chatLucy(messages)
        default:
          throw new Error(`Неподдерживаемый провайдер: ${provider}`)
      }
    } catch (error: any) {
      console.error('❌ Ошибка LLM:', error)
      throw error
    }
  }

  // Google Gemini API
  private async chatGemini(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.config.apiKey as string
    const model = this.config.model || 'gemini-2.0-flash-exp'

    console.log('🤖 Отправляю запрос в Gemini 2.0...')
    console.log('📋 Модель:', model)
    
    // Преобразуем сообщения в формат Gemini
    const geminiContents = []
    let systemInstruction = ''
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content
      } else {
        geminiContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 секунд

    try {
      const requestBody: any = {
        contents: geminiContents,
        generationConfig: {
          temperature: this.config.temperature ?? 0.7,
          maxOutputTokens: this.config.maxTokens ?? 2000,
          topP: 0.95,
          topK: 40
        }
      }

      // Добавляем системную инструкцию если есть
      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }]
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Gemini error:', errorText)
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ Gemini response received')
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        
      if (!text) throw new Error('Пустой ответ от Gemini')
      return text.trim()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Запрос к Gemini отменён по таймауту.')
      }
      console.error('❌ Gemini error:', error)
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // LM Studio API (OpenAI-совместимый)
  private async chatLMStudio(messages: ChatMessage[]): Promise<string> {
    const baseURL = this.config.baseURL || 'http://localhost:1234/v1'

    const openaiMessages = messages.map(m => ({
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))

    console.log('🦙 Отправляю запрос в LM Studio (LLaMA)...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 секунд для локальной модели

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model || 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
          messages: openaiMessages,
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 2000,
          stream: false
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`LM Studio API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content
      
      if (!text) throw new Error('Пустой ответ от LM Studio')
      return text.trim()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Запрос к LM Studio отменён по таймауту.')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // YandexGPT API
  private async chatYandexGPT(messages: ChatMessage[]): Promise<string> {
    const apiKey = this.config.apiKey as string
    const catalogId = this.config.catalogId || ''
    const model = this.config.model || 'yandexgpt-lite'
    const baseURL = this.config.baseURL || 'https://llm.api.cloud.yandex.net/foundationModels/v1'

    const yandexMessages = messages.map(m => ({
      role: m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant',
      text: m.content
    }))

    console.log('🤖 Отправляю запрос в YandexGPT...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 секунд

    try {
      const response = await fetch(`${baseURL}/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`,
          'x-folder-id': catalogId
        },
        body: JSON.stringify({
          modelUri: `gpt://${catalogId}/${model}/latest`,
          completionOptions: {
            temperature: this.config.temperature ?? 0.7,
            maxTokens: this.config.maxTokens ?? 2000
          },
          messages: yandexMessages
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`YandexGPT API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const text = data.result?.alternatives?.[0]?.message?.text
      
      if (!text) throw new Error('Пустой ответ от YandexGPT')
      return text.trim()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Запрос к YandexGPT отменён по таймауту.')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Lucy AI (GitHub Models) - бесплатные модели от GitHub
  private async chatLucy(messages: ChatMessage[]): Promise<string> {
    const token = this.config.apiKey as string
    const model = this.config.model || 'gpt-4o'
    const baseURL = this.config.baseURL || 'https://models.inference.ai.azure.com'

    console.log('🔌 Проверка конфигурации lucy...')
    console.log('Model:', model)
    console.log('Token:', token ? `${token.substring(0, 20)}...` : 'NOT SET')
    console.log('BaseURL:', baseURL)

    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 2000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Lucy AI error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content

      if (!text) throw new Error('Пустой ответ от Lucy AI')
      return text.trim()
    } catch (error: any) {
      console.error('❌ Ошибка Lucy AI:', error)
      throw error
    }
  }

  // Инициализация инструментов
  private initTools() {
    // Выполнение shell команды
    this.availableTools.set('execute_command', {
      name: 'execute_command',
      description: 'Выполнить команду в терминале (cmd, powershell)',
      parameters: {
        command: 'string',
        args: 'array'
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
      description: 'Открыть приложение',
      parameters: {
        appName: 'string'
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
      description: 'Создать файл',
      parameters: {
        path: 'string',
        content: 'string'
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
      description: 'Прочитать файл',
      parameters: {
        path: 'string'
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
      description: 'Получить список процессов',
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

    // Информация о системе
    this.availableTools.set('get_system_info', {
      name: 'get_system_info',
      description: 'Получить информацию о системе',
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

    // Поиск в интернете
    this.availableTools.set('search_web', {
      name: 'search_web',
      description: 'Искать информацию в интернете через DuckDuckGo',
      parameters: {
        query: 'string'
      },
      execute: async (params) => {
        try {
          const result = await invoke('search_web', { query: params.query })
          return { success: true, output: String(result) }
        } catch (error) {
          return { success: false, output: '', error: String(error) }
        }
      }
    })

    console.log(`🛠️ Инициализировано ${this.availableTools.size} инструментов`)
  }

  // Автономное мышление агента
  async autonomousThink(userRequest: string, maxIterations: number = 5): Promise<string> {
    if (!this.isReady()) {
      throw new Error('llm не готов')
    }

    console.log('🧠 Автономное мышление...')
    console.log('📝 Запрос:', userRequest)

    this.conversationHistory = []

    // Системный промпт
    const systemPrompt = `Ты - Люси, автономный AI-агент с полным доступом к компьютеру.

ИНСТРУМЕНТЫ:
${Array.from(this.availableTools.entries())
  .map(([name, tool]) => `- ${name}: ${tool.description}`)
  .join('\n')}

ФОРМАТ ОТВЕТА:
Для использования инструмента:
TOOL: <название>
PARAMS: <JSON параметры>
REASON: <причина>

Когда готово:
DONE: <финальный ответ>

ПРАВИЛА:
1. Думай логически, планируй действия
2. Можешь выполнить несколько действий
3. Предупреждай об опасных операциях
4. Отвечай на русском`

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

      const agentResponse = await this.chat(this.conversationHistory)
      console.log('🤖 Ответ:', agentResponse)

      if (agentResponse.includes('DONE:')) {
        const match = agentResponse.match(/DONE:\s*(.+)/s)
        if (match) {
          finalAnswer = match[1].trim()
          break
        }
      }

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
              const reason = reasonMatch ? reasonMatch[1].trim() : 'Выполнение'

              console.log(`🛠️ Инструмент: ${toolName}`)
              console.log('📋 Параметры:', params)

              executionLog.push(reason)

              const result = await tool.execute(params)

              if (result.success) {
                console.log('✅', result.output)
                executionLog.push(`✅ ${result.output}`)

                this.conversationHistory.push({
                  role: 'assistant',
                  content: agentResponse
                })

                this.conversationHistory.push({
                  role: 'user',
                  content: `Результат ${toolName}: ${result.output}\n\nЧто дальше? Если готово - ответь DONE:`
                })
              } else {
                console.log('❌', result.error)
                executionLog.push(`❌ ${result.error}`)

                this.conversationHistory.push({
                  role: 'assistant',
                  content: agentResponse
                })

                this.conversationHistory.push({
                  role: 'user',
                  content: `Ошибка ${toolName}: ${result.error}\n\nПопробуй иначе или ответь DONE:`
                })
              }
            } catch (error: any) {
              console.error('❌ Ошибка:', error)
              this.conversationHistory.push({
                role: 'user',
                content: `Ошибка: ${error}. Ответь DONE:`
              })
            }
          }
        }
      } else {
        this.conversationHistory.push({
          role: 'assistant',
          content: agentResponse
        })

        this.conversationHistory.push({
          role: 'user',
          content: 'Используй инструменты или ответь DONE:'
        })
      }
    }

    if (!finalAnswer) {
      finalAnswer = `⚠️ Не завершено за ${maxIterations} итераций.\n\n${executionLog.join('\n')}`
    } else if (executionLog.length > 0) {
      finalAnswer = `${executionLog.join('\n')}\n\n${finalAnswer}`
    }

    console.log('🎯 Результат:', finalAnswer)
    return finalAnswer
  }

  // Получить список инструментов
  getAvailableTools(): string[] {
    return Array.from(this.availableTools.keys())
  }

  // Переподключиться
  async reconnect() {
    this.isConnected = false
    await this.init()
  }
}

// Единственный экземпляр
export const llmService = new UniversalLLMService()
