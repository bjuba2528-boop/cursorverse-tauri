/**
 * 🧠 Люси v2.0 - Автономный AI-агент с собственной системой мышления
 * 
 * Особенности:
 * - Внутренний монолог и планирование
 * - Собственная логика принятия решений
 * - Контекстная память
 * - Самообучение на основе результатов
 */

import { invoke } from '@tauri-apps/api/core';
import { llmService } from './llmService';
import Fuse from 'fuse.js';

interface InstalledApp {
  name: string;
  path: string;
}

// Структура мысли агента
export interface Thought {
  type: 'analysis' | 'plan' | 'decision' | 'execution' | 'reflection'
  content: string
  timestamp: number
  confidence: number // 0-1
}

// Контекст для принятия решений (зарезервировано для будущего)
// interface Context {
//   userIntent: string
//   availableActions: string[]
//   systemState: any
//   history: Thought[]
//   learnings: Learning[]
// }

// Обучение на основе опыта
interface Learning {
  situation: string
  action: string
  result: 'success' | 'failure'
  feedback: string
  timestamp: number
}

// План действий
interface ActionPlan {
  steps: PlanStep[]
  reasoning: string
  confidence: number
}

interface PlanStep {
  action: string
  params: any
  reason: string
  expectedOutcome: string
}

class LucyAI {
  private thoughts: Thought[] = []
  private learnings: Learning[] = []
  // private context: Partial<Context> = {} // Зарезервировано для будущего использования
  private personalityTraits = {
    cautiousness: 0.7, // 0-1, влияет на проверку перед выполнением
    creativity: 0.8,   // 0-1, влияет на поиск нестандартных решений
    verbosity: 0.6,    // 0-1, влияет на количество объяснений
    proactivity: 0.9   // 0-1, влияет на предложение дополнительных действий
  };
  private installedApps: InstalledApp[] = [];
  private fuse: Fuse<InstalledApp> | null = null;
  private lastAppScan: number = 0;

  constructor() {
    this.loadLearnings();
    this.addThought('analysis', 'Я - Люси, автономный AI-агент. Инициализация завершена.', 1.0);
    this.updateInstalledApps(); // Загружаем приложения при старте
  }

  // ============= МЫШЛЕНИЕ =============

  /**
   * Добавить мысль в поток сознания
   */
  private addThought(type: Thought['type'], content: string, confidence: number = 0.8) {
    const thought: Thought = {
      type,
      content,
      timestamp: Date.now(),
      confidence
    }
    
    this.thoughts.push(thought)
    
    // Сохраняем только последние 100 мыслей для производительности
    if (this.thoughts.length > 100) {
      this.thoughts.shift()
    }

    // Логируем в консоль для отладки
    console.log(`🧠 [${type.toUpperCase()}] ${content} (уверенность: ${(confidence * 100).toFixed(0)}%)`)
    
    return thought
  }

  /**
   * Получить все мысли
   */
  getThoughts(): Thought[] {
    return [...this.thoughts]
  }

  /**
   * Получить последние мысли
   */
  getRecentThoughts(count: number = 5): Thought[] {
    return this.thoughts.slice(-count)
  }

  // ============= АНАЛИЗ И ПЛАНИРОВАНИЕ =============

  /**
   * Проанализировать запрос пользователя
   */
  private async analyzeUserIntent(userRequest: string): Promise<string> {
    this.addThought('analysis', `Анализирую запрос: "${userRequest}"`, 0.9)
    
    // Простая категоризация запросов
    const intent = this.categorizeIntent(userRequest)
    
    this.addThought('analysis', `Определён тип запроса: ${intent}`, 0.85)
    
    return intent
  }

  /**
   * Категоризация намерения
   */
  private categorizeIntent(request: string): string {
    const lower = request.toLowerCase()
    
    if (lower.includes('открой') || lower.includes('запусти')) return 'open_application'
    if (lower.includes('создай') || lower.includes('напиши')) return 'create_file'
    if (lower.includes('покажи') || lower.includes('список')) return 'get_information'
    if (lower.includes('выполни') || lower.includes('сделай')) return 'execute_command'
    if (lower.includes('найди') || lower.includes('ищи')) return 'search'
    if (lower.includes('помоги') || lower.includes('как')) return 'help'
    
    return 'general_task'
  }

  /**
   * Создать план действий
   */
  private async createActionPlan(userRequest: string, intent: string): Promise<ActionPlan> {
    this.addThought('plan', 'Создаю план действий...', 0.8)
    
    // Если LLM доступен, используем его для планирования
    if (llmService.isReady()) {
      return await this.createSmartPlan(userRequest, intent)
    }
    
    // Иначе используем базовое планирование
    return this.createBasicPlan(userRequest, intent)
  }

  /**
   * Умное планирование через LLM
   */
  private async createSmartPlan(userRequest: string, intent: string): Promise<ActionPlan> {
    this.addThought('plan', 'Использую LLM для создания плана...', 0.9)
    
    try {
      const planPrompt = `Ты - система планирования для AI агента. Твоя задача - разбить запрос пользователя на последовательность конкретных действий. Отвечай только в формате JSON.

Запрос:
"${userRequest}"

Проанализируй запрос. Если он содержит несколько команд (например, "открой X и сделай Y"), создай шаг для каждой команды.

Пример сложного запроса: "Открой Spotify и включи музыку"
Правильный план для него:
{
  "reasoning": "Пользователь хочет сначала открыть приложение, а потом управлять музыкой.",
  "confidence": 0.95,
  "steps": [
    {
      "action": "open_application",
      "params": {"appName": "Spotify"},
      "reason": "Открыть Spotify",
      "expectedOutcome": "Приложение Spotify будет запущено."
    },
    {
      "action": "media_control",
      "params": {"action": "play"},
      "reason": "Включить музыку",
      "expectedOutcome": "Воспроизведение музыки начнется."
    }
  ]
}

Сформируй JSON план для текущего запроса.

Доступные действия:
- open_application: открывает приложение (используй полный путь из списка)
- media_control: управляет плеером. Параметры: "play", "pause", "next", "previous", "stop", "volumeUp", "volumeDown", "mute".
- create_file: создает файл.
- execute_command: выполняет команду.
- read_file: читает файл.
- get_processes: получает список процессов.
- get_system_info: получает информацию о системе.`

      const response = await llmService.chat([
        { role: 'system', content: 'Ты - система планирования для AI агента. Отвечай только JSON.' },
        { role: 'user', content: planPrompt }
      ])

      // Попытка исправить невалидный JSON
      const sanitizedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const plan = JSON.parse(sanitizedResponse)
      
      this.addThought('plan', `План создан: ${plan.steps.length} шагов`, plan.confidence)
      
      return plan
    } catch (error) {
      console.error('Ошибка LLM планирования:', error)
      this.addThought('reflection', `Ошибка планирования: ${error}. Переключаюсь на базовый план.`, 0.3)
      return await this.createBasicPlan(userRequest, intent)
    }
  }

  /**
   * Базовое планирование без LLM
   */
  private async createBasicPlan(userRequest: string, intent: string): Promise<ActionPlan> {
    const lower = userRequest.toLowerCase()
    const plan: ActionPlan = {
      steps: [],
      reasoning: 'Базовый план на основе ключевых слов',
      confidence: 0.7
    }

    switch (intent) {
      case 'open_application':
        const app = await this.findApplication(userRequest);
        if (app) {
            plan.steps.push({
                action: 'open_application',
                params: { appName: app.path }, // Используем путь для надёжности
                reason: `Пользователь хочет открыть ${app.name}`,
                expectedOutcome: `${app.name} откроется`
            });
        } else {
            plan.steps.push({
                action: 'chat',
                params: { message: `Я не смогла найти приложение. Попробуйте еще раз` },
                reason: 'Приложение не найдено',
                expectedOutcome: 'Сообщить пользователю о неудаче'
            });
        }
        break

      case 'create_file':
        const fileMatch = lower.match(/создай файл (.+?)(?:\s+с|$)/)
        const contentMatch = lower.match(/с (?:текстом |содержимым )?(.+)/)
        
        if (fileMatch) {
          plan.steps.push({
            action: 'create_file',
            params: {
              path: fileMatch[1].trim(),
              content: contentMatch ? contentMatch[1].trim() : ''
            },
            reason: 'Создание файла по запросу',
            expectedOutcome: 'Файл будет создан'
          })
        }
        break

      case 'get_information':
        if (lower.includes('процесс')) {
          plan.steps.push({
            action: 'get_processes',
            params: {},
            reason: 'Получение списка процессов',
            expectedOutcome: 'Список запущенных процессов'
          })
        } else if (lower.includes('систем')) {
          plan.steps.push({
            action: 'get_system_info',
            params: {},
            reason: 'Получение информации о системе',
            expectedOutcome: 'Данные о системе'
          })
        }
        break

      case 'execute_command':
        const cmdMatch = lower.match(/выполни (.+)/)
        if (cmdMatch) {
          plan.steps.push({
            action: 'execute_command',
            params: { command: cmdMatch[1].trim() },
            reason: 'Выполнение команды',
            expectedOutcome: 'Команда будет выполнена'
          })
        }
        break

      default:
        plan.steps.push({
          action: 'chat',
          params: { message: userRequest },
          reason: 'Общий запрос, требуется диалог',
          expectedOutcome: 'Ответ на вопрос'
        })
    }

    this.addThought('plan', `Базовый план: ${plan.steps.length} шагов`, plan.confidence)
    return plan
  }

  /**
   * Найти приложение с помощью нечёткого поиска
   */
  private async findApplication(query: string): Promise<InstalledApp | null> {
    // Обновляем список раз в 5 минут
    if (Date.now() - this.lastAppScan > 300000) {
      await this.updateInstalledApps();
    }

    if (!this.fuse) {
      this.addThought('analysis', 'Список приложений пуст, не могу выполнить поиск', 0.4);
      return null;
    }

    // Извлекаем название из запроса
    const match = query.toLowerCase().match(/(?:открой|запусти)\s+(.+)/);
    const appQuery = match ? match[1].trim() : query.trim();

    this.addThought('analysis', `Ищу приложение по запросу: "${appQuery}"`, 0.9);
    const results = this.fuse.search(appQuery);

    if (results.length > 0) {
      const bestMatch = results[0].item;
      this.addThought('analysis', `Найдено лучшее совпадение: ${bestMatch.name}`, 0.8);
      return bestMatch;
    }

    this.addThought('analysis', `Приложение "${appQuery}" не найдено`, 0.5);
    return null;
  }

  /**
   * Обновить список установленных приложений
   */
  private async updateInstalledApps() {
    try {
      this.addThought('analysis', 'Обновляю список установленных приложений...', 0.9);
      const result = await invoke<string>('get_installed_apps');
      this.installedApps = JSON.parse(result);
      
      this.fuse = new Fuse(this.installedApps, {
        keys: ['name'],
        includeScore: true,
        threshold: 0.4, // Порог совпадения
      });

      this.lastAppScan = Date.now();
      this.addThought('analysis', `Список обновлён. Найдено ${this.installedApps.length} приложений.`, 1.0);
    } catch (error) {
      console.error('Ошибка обновления списка приложений:', error);
      this.addThought('reflection', `Ошибка обновления списка приложений: ${error}`, 0.2);
    }
  }

  // ============= ПРИНЯТИЕ РЕШЕНИЙ =============

  /**
   * Принять решение о выполнении плана
   */
  private async makeDecision(plan: ActionPlan): Promise<boolean> {
    this.addThought('decision', 'Оцениваю план...', 0.8)
    
    // Проверка безопасности
    const isDangerous = this.assessDanger(plan)
    
    if (isDangerous) {
      this.addThought('decision', '⚠️ План может быть опасным, требуется осторожность', 0.5)
      
      // В зависимости от черты cautiousness
      if (this.personalityTraits.cautiousness > 0.8) {
        this.addThought('decision', 'Отклоняю план из-за высокой осторожности', 0.9)
        return false
      }
    }
    
    // Проверка уверенности
    if (plan.confidence < 0.5) {
      this.addThought('decision', 'Низкая уверенность в плане, лучше спросить пользователя', 0.7)
      return false
    }
    
    // Проверка на основе прошлого опыта
    const similarLearning = this.findSimilarLearning(plan)
    if (similarLearning && similarLearning.result === 'failure') {
      this.addThought('decision', 'Похожая ситуация ранее привела к ошибке, будь осторожен', 0.6)
      // Но всё равно попробуем
    }
    
    this.addThought('decision', '✅ План одобрен к выполнению', 0.9)
    return true
  }

  /**
   * Оценить опасность плана
   */
  private assessDanger(plan: ActionPlan): boolean {
    const dangerousActions = ['shutdown', 'restart', 'delete', 'format', 'rm -rf']
    
    return plan.steps.some(step => 
      dangerousActions.some(danger => 
        JSON.stringify(step).toLowerCase().includes(danger)
      )
    )
  }

  /**
   * Найти похожее обучение
   */
  private findSimilarLearning(plan: ActionPlan): Learning | null {
    // Простой поиск по первому действию
    const firstAction = plan.steps[0]?.action
    
    return this.learnings.find(l => 
      l.situation.includes(firstAction)
    ) || null
  }

  // ============= ВЫПОЛНЕНИЕ =============

  /**
   * Выполнить план
   */
  private async executePlan(plan: ActionPlan): Promise<string> {
    this.addThought('execution', 'Начинаю выполнение плана...', 0.9)
    
    const results: string[] = []
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]
      this.addThought('execution', `Шаг ${i + 1}/${plan.steps.length}: ${step.action}`, 0.85)
      
      try {
        const result = await this.executeAction(step.action, step.params)
        results.push(result)
        
        this.addThought('execution', `✅ Шаг ${i + 1} выполнен: ${result}`, 0.9)
        
        // Записываем успешный опыт
        this.recordLearning(step.action, 'success', result)
        
      } catch (error: any) {
        const errorMsg = `❌ Ошибка на шаге ${i + 1}: ${error.message}`
        results.push(errorMsg)
        
        this.addThought('execution', errorMsg, 0.3)
        
        // Записываем неудачный опыт
        this.recordLearning(step.action, 'failure', error.message)
        
        // Продолжаем выполнение или останавливаемся?
        if (this.personalityTraits.cautiousness > 0.7) {
          this.addThought('decision', 'Останавливаю выполнение из-за ошибки', 0.8)
          break
        }
      }
    }
    
    return results.join('\n')
  }

  /**
   * Выполнить одно действие
   */
  private async executeAction(action: string, params: any): Promise<string> {
    switch (action) {
      case 'open_application':
        await invoke('open_application', { appName: params.appName })
        return `Приложение ${params.appName} открыто`

      case 'create_file':
        await invoke('create_file', params)
        return `Файл ${params.path} создан`

      case 'read_file':
        const content = await invoke('read_file', { path: params.path })
        return `Содержимое: ${content}`

      case 'execute_command':
        const result = await invoke('execute_shell_command', {
          command: params.command,
          args: params.args || []
        })
        return String(result)

      case 'get_processes':
        const processes = await invoke('get_process_list')
        return String(processes)

      case 'get_system_info':
        const sysInfo = await invoke('get_system_info')
        return String(sysInfo)

      case 'chat':
        if (llmService.isReady()) {
          return await llmService.chat([
            { role: 'user', content: params.message }
          ])
        }
        return 'LLM недоступен для чата'

      default:
        throw new Error(`Неизвестное действие: ${action}`)
    }
  }

  // ============= РЕФЛЕКСИЯ И ОБУЧЕНИЕ =============

  /**
   * Записать опыт
   */
  private recordLearning(action: string, result: 'success' | 'failure', feedback: string) {
    const learning: Learning = {
      situation: action,
      action,
      result,
      feedback,
      timestamp: Date.now()
    }
    
    this.learnings.push(learning)
    
    // Сохраняем только последние 100 опытов
    if (this.learnings.length > 100) {
      this.learnings.shift()
    }
    
    this.saveLearnings()
  }

  /**
   * Сохранить опыт в localStorage
   */
  private saveLearnings() {
    try {
      localStorage.setItem('lucy_learnings', JSON.stringify(this.learnings))
    } catch (error) {
      console.error('Ошибка сохранения опыта:', error)
    }
  }

  /**
   * Загрузить опыт из localStorage
   */
  private loadLearnings() {
    try {
      const saved = localStorage.getItem('lucy_learnings')
      if (saved) {
        this.learnings = JSON.parse(saved)
        console.log(`📚 Загружено ${this.learnings.length} опытов`)
      }
    } catch (error) {
      console.error('Ошибка загрузки опыта:', error)
    }
  }

  /**
   * Рефлексия после выполнения
   */
  private async reflect(_userRequest: string, _result: string, success: boolean) {
    this.addThought('reflection', 'Анализирую результаты...', 0.8)
    
    if (success) {
      this.addThought('reflection', '✅ Задача выполнена успешно!', 1.0)
      
      // Если включена проактивность, предложим дополнительные действия
      if (this.personalityTraits.proactivity > 0.7) {
        this.addThought('reflection', '💡 Могу предложить связанные действия...', 0.7)
      }
    } else {
      this.addThought('reflection', '⚠️ Возникли проблемы при выполнении', 0.4)
      this.addThought('reflection', 'Запоминаю ошибку для будущего', 0.9)
    }
  }

  // ============= ОСНОВНОЙ МЕТОД =============

  /**
   * Обработать запрос пользователя (главный метод)
   */
  async processRequest(userRequest: string): Promise<string> {
    try {
      // 1. АНАЛИЗ
      this.addThought('analysis', `Получен запрос: "${userRequest}"`, 1.0)
      const intent = await this.analyzeUserIntent(userRequest)
      
      // 2. ПЛАНИРОВАНИЕ
      const plan = await this.createActionPlan(userRequest, intent)
      
      // 3. ПРИНЯТИЕ РЕШЕНИЯ
      const approved = await this.makeDecision(plan)
      
      if (!approved) {
        this.addThought('decision', 'План отклонён, запрашиваю подтверждение', 0.5)
        return '⚠️ Я не уверена в безопасности этого действия. Подтвердите выполнение явно.'
      }
      
      // 4. ВЫПОЛНЕНИЕ
      const result = await this.executePlan(plan)
      
      // 5. РЕФЛЕКСИЯ
      await this.reflect(userRequest, result, true)
      
      // Формируем ответ с учётом verbosity
      let response = result
      
      if (this.personalityTraits.verbosity > 0.7) {
        const reasoning = `\n\n💭 Мои мысли: ${plan.reasoning}`
        response += reasoning
      }
      
      return response
      
    } catch (error: any) {
      this.addThought('reflection', `❌ Критическая ошибка: ${error.message}`, 0.1)
      await this.reflect(userRequest, error.message, false)
      
      return `❌ Ошибка: ${error.message}\n\n💭 Я запомнила эту ошибку и постараюсь избежать её в будущем.`
      
    }
  }

  // ============= УТИЛИТЫ =============

  /**
   * Получить статистику обучения
   */
  getLearningStats() {
    const total = this.learnings.length
    const successes = this.learnings.filter(l => l.result === 'success').length
    const failures = this.learnings.filter(l => l.result === 'failure').length
    
    return {
      total,
      successes,
      failures,
      successRate: total > 0 ? (successes / total * 100).toFixed(1) + '%' : '0%'
    }
  }

  /**
   * Очистить память
   */
  clearMemory() {
    this.thoughts = []
    this.learnings = []
    localStorage.removeItem('lucy_learnings')
    this.addThought('analysis', 'Память очищена', 1.0)
  }

  /**
   * Изменить черты характера
   */
  updatePersonality(traits: Partial<typeof this.personalityTraits>) {
    this.personalityTraits = { ...this.personalityTraits, ...traits }
    this.addThought('reflection', 'Черты характера обновлены', 0.9)
  }

  /**
   * Получить черты характера
   */
  getPersonality() {
    return { ...this.personalityTraits }
  }
}

// Единственный экземпляр Люси
export const lucyAI = new LucyAI()
