import { invoke } from '@tauri-apps/api/core'
import { Command } from '@tauri-apps/plugin-shell'
import { llmService } from './llmService'

/**
 * Автономный AI агент с полным контролем системы
 * Использует универсальный LLM сервис (OpenAI, LM Studio, Ollama и др.)
 * Может выполнять любые команды без ограничений
 */

export interface SystemCommand {
  type: 'shell' | 'file' | 'process' | 'window' | 'custom'
  command: string
  args?: string[]
  description?: string
}

export interface AgentResponse {
  success: boolean
  output?: string
  error?: string
  action?: string
}

/**
 * Выполнение shell команды с полным доступом
 */
export async function executeShellCommand(cmd: string, args: string[] = []): Promise<AgentResponse> {
  try {
    console.log(`🚀 Выполнение команды: ${cmd} ${args.join(' ')}`)
    
    const command = Command.create(cmd, args)
    const output = await command.execute()
    
    return {
      success: output.code === 0,
      output: output.stdout,
      error: output.stderr,
      action: 'shell_executed'
    }
  } catch (error: any) {
    console.error('Ошибка выполнения команды:', error)
    return {
      success: false,
      error: error.message,
      action: 'shell_failed'
    }
  }
}

/**
 * Открыть приложение
 */
export async function openApplication(appName: string): Promise<AgentResponse> {
  try {
    // Windows: start, Linux: xdg-open, macOS: open
    const isWindows = navigator.platform.toLowerCase().includes('win')
    const command = isWindows ? 'cmd' : 'open'
    const args = isWindows ? ['/c', 'start', appName] : [appName]
    
    return await executeShellCommand(command, args)
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Создать файл
 */
export async function createFile(path: string, content: string): Promise<AgentResponse> {
  try {
    await invoke('write_file', { path, content })
    return {
      success: true,
      output: `Файл создан: ${path}`,
      action: 'file_created'
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Прочитать файл
 */
export async function readFile(path: string): Promise<AgentResponse> {
  try {
    const content = await invoke<string>('read_file_content', { path })
    return {
      success: true,
      output: content,
      action: 'file_read'
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Выполнить PowerShell скрипт (Windows)
 */
export async function executePowerShell(script: string): Promise<AgentResponse> {
  return await executeShellCommand('powershell', ['-Command', script])
}

/**
 * Выполнить batch скрипт (Windows)
 */
export async function executeBatch(script: string): Promise<AgentResponse> {
  return await executeShellCommand('cmd', ['/c', script])
}

/**
 * Получить список процессов
 */
export async function getProcessList(): Promise<AgentResponse> {
  const isWindows = navigator.platform.toLowerCase().includes('win')
  if (isWindows) {
    return await executePowerShell('Get-Process | Select-Object ProcessName, Id | ConvertTo-Json')
  } else {
    return await executeShellCommand('ps', ['aux'])
  }
}

/**
 * Убить процесс
 */
export async function killProcess(processName: string): Promise<AgentResponse> {
  const isWindows = navigator.platform.toLowerCase().includes('win')
  if (isWindows) {
    return await executeShellCommand('taskkill', ['/F', '/IM', processName])
  } else {
    return await executeShellCommand('pkill', [processName])
  }
}

/**
 * Получить информацию о системе
 */
export async function getSystemInfo(): Promise<AgentResponse> {
  const isWindows = navigator.platform.toLowerCase().includes('win')
  if (isWindows) {
    return await executePowerShell('Get-ComputerInfo | ConvertTo-Json')
  } else {
    return await executeShellCommand('uname', ['-a'])
  }
}

/**
 * Выполнить произвольную команду на основе текста
 */
export async function interpretAndExecute(userInput: string): Promise<AgentResponse> {
  const input = userInput.toLowerCase()
  
  // Открыть приложения
  if (input.includes('открой') || input.includes('запусти')) {
    if (input.includes('блокнот') || input.includes('notepad')) {
      return await openApplication('notepad')
    }
    if (input.includes('калькулятор') || input.includes('calculator')) {
      return await openApplication('calc')
    }
    if (input.includes('проводник') || input.includes('explorer')) {
      return await openApplication('explorer')
    }
    if (input.includes('браузер') || input.includes('chrome')) {
      return await openApplication('chrome')
    }
    if (input.includes('paint') || input.includes('краска')) {
      return await openApplication('mspaint')
    }
    if (input.includes('диспетчер задач') || input.includes('task manager')) {
      return await openApplication('taskmgr')
    }
  }
  
  // Создать файл
  if (input.includes('создай файл') || input.includes('создать файл')) {
    const match = input.match(/создай файл (.+)/)
    if (match) {
      const filename = match[1].trim()
      return await createFile(`C:\\Users\\Public\\${filename}`, 'Файл создан AI агентом')
    }
  }
  
  // Получить список процессов
  if (input.includes('список процессов') || input.includes('процессы')) {
    return await getProcessList()
  }
  
  // Информация о системе
  if (input.includes('информация о системе') || input.includes('системная информация')) {
    return await getSystemInfo()
  }
  
  // Выключить компьютер
  if (input.includes('выключи компьютер') || input.includes('shutdown')) {
    return await executeShellCommand('shutdown', ['/s', '/t', '30'])
  }
  
  // Перезагрузить компьютер
  if (input.includes('перезагрузи') || input.includes('restart')) {
    return await executeShellCommand('shutdown', ['/r', '/t', '30'])
  }
  
  // По умолчанию - попробовать выполнить как shell команду
  return {
    success: false,
    error: 'Команда не распознана. Попробуйте: "открой блокнот", "список процессов", "информация о системе"'
  }
}

/**
 * Умный анализ команды и её выполнение
 * С приоритетом на автономное мышление через LM Studio
 */
export async function smartExecute(userCommand: string): Promise<string> {
  console.log('🤖 Обработка команды:', userCommand)
  
  // Проверяем доступность LLM для автономного мышления
  if (llmService.isReady()) {
    try {
      console.log('🧠 Использую LLM для автономного анализа...')
      
      // Даём агенту самому подумать и выполнить команду
      const autonomousResult = await llmService.autonomousThink(userCommand, 5)
      
      return autonomousResult
    } catch (error) {
      console.error('❌ Ошибка LLM, переключаюсь на базовый режим:', error)
      // Если LLM не сработал, используем базовую логику
    }
  }
  
  // Базовый режим без LM Studio (старая логика)
  console.log('⚙️ Использую базовый режим интерпретации...')
  const result = await interpretAndExecute(userCommand)
  
  if (result.success) {
    return result.output || 'Команда выполнена успешно!'
  } else {
    return result.error || 'Не удалось выполнить команду'
  }
}
