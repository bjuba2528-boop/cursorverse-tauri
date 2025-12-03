// Хранилище пользовательских голосовых команд

interface CustomCommand {
  id: string
  phrase: string // Фраза для активации (например, "открой мой проект")
  action: 'open_file' | 'open_folder' | 'run_command' | 'open_url'
  target: string // Путь к файлу/папке или команда для выполнения
  description?: string
}

class CustomCommandsManager {
  private commands: CustomCommand[] = []
  private storageKey = 'cursorverse_custom_commands'

  constructor() {
    this.loadCommands()
  }

  // Загрузка команд из localStorage
  loadCommands(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.commands = JSON.parse(stored)
        console.log(`📝 Загружено ${this.commands.length} пользовательских команд`)
      }
    } catch (e) {
      console.error('Ошибка загрузки команд:', e)
    }
  }

  // Сохранение команд в localStorage
  saveCommands(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.commands))
      console.log(`💾 Сохранено ${this.commands.length} команд`)
    } catch (e) {
      console.error('Ошибка сохранения команд:', e)
    }
  }

  // Добавить новую команду
  addCommand(command: Omit<CustomCommand, 'id'>): CustomCommand {
    const newCommand: CustomCommand = {
      ...command,
      id: Date.now().toString() + Math.random().toString(36)
    }
    this.commands.push(newCommand)
    this.saveCommands()
    console.log('✅ Добавлена команда:', newCommand.phrase)
    return newCommand
  }

  // Удалить команду
  removeCommand(id: string): boolean {
    const index = this.commands.findIndex(cmd => cmd.id === id)
    if (index !== -1) {
      const removed = this.commands.splice(index, 1)[0]
      this.saveCommands()
      console.log('🗑️ Удалена команда:', removed.phrase)
      return true
    }
    return false
  }

  // Обновить команду
  updateCommand(id: string, updates: Partial<Omit<CustomCommand, 'id'>>): boolean {
    const command = this.commands.find(cmd => cmd.id === id)
    if (command) {
      Object.assign(command, updates)
      this.saveCommands()
      console.log('📝 Обновлена команда:', command.phrase)
      return true
    }
    return false
  }

  // Получить все команды
  getAllCommands(): CustomCommand[] {
    return [...this.commands]
  }

  // Найти команду по фразе (нечеткое сравнение)
  findCommandByPhrase(userPhrase: string): CustomCommand | null {
    const normalized = userPhrase.toLowerCase().trim()
    
    // Точное совпадение
    let match = this.commands.find(cmd => 
      cmd.phrase.toLowerCase() === normalized
    )
    if (match) return match

    // Частичное совпадение (фраза содержит команду)
    match = this.commands.find(cmd => 
      normalized.includes(cmd.phrase.toLowerCase())
    )
    if (match) return match

    // Команда содержит фразу
    match = this.commands.find(cmd => 
      cmd.phrase.toLowerCase().includes(normalized)
    )
    if (match) return match

    return null
  }

  // Экспорт команд в JSON
  exportCommands(): string {
    return JSON.stringify(this.commands, null, 2)
  }

  // Импорт команд из JSON
  importCommands(json: string): boolean {
    try {
      const imported = JSON.parse(json) as CustomCommand[]
      if (Array.isArray(imported)) {
        this.commands = imported
        this.saveCommands()
        console.log(`📥 Импортировано ${imported.length} команд`)
        return true
      }
    } catch (e) {
      console.error('Ошибка импорта команд:', e)
    }
    return false
  }

  // Очистить все команды
  clearAll(): void {
    this.commands = []
    this.saveCommands()
    console.log('🗑️ Все команды удалены')
  }
}

// Единственный экземпляр менеджера команд
export const customCommandsManager = new CustomCommandsManager()

// Типы для экспорта
export type { CustomCommand }
