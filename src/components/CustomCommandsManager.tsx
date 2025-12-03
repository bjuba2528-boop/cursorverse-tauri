import React, { useState, useEffect } from 'react'
import { customCommandsManager, type CustomCommand } from '../utils/customCommands'
import { open } from '@tauri-apps/plugin-dialog'
import './CustomCommandsManager.css'

const CustomCommandsManager: React.FC = () => {
  const [commands, setCommands] = useState<CustomCommand[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null)
  
  // Форма для новой/редактируемой команды
  const [formData, setFormData] = useState({
    phrase: '',
    action: 'open_file' as 'open_file' | 'open_folder' | 'run_command' | 'open_url',
    target: '',
    description: ''
  })

  useEffect(() => {
    loadCommands()
  }, [])

  const loadCommands = () => {
    setCommands(customCommandsManager.getAllCommands())
  }

  const handleAdd = () => {
    if (!formData.phrase || !formData.target) {
      alert('Заполните фразу и цель команды!')
      return
    }

    customCommandsManager.addCommand(formData)
    loadCommands()
    resetForm()
  }

  const handleUpdate = () => {
    if (!editingCommand) return

    customCommandsManager.updateCommand(editingCommand.id, formData)
    loadCommands()
    resetForm()
  }

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту команду?')) {
      customCommandsManager.removeCommand(id)
      loadCommands()
    }
  }

  const handleEdit = (command: CustomCommand) => {
    setEditingCommand(command)
    setFormData({
      phrase: command.phrase,
      action: command.action,
      target: command.target,
      description: command.description || ''
    })
  }

  const resetForm = () => {
    setFormData({
      phrase: '',
      action: 'open_file',
      target: '',
      description: ''
    })
    setEditingCommand(null)
  }

  const handleBrowseFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: formData.action === 'open_folder'
      })
      
      if (selected && typeof selected === 'string') {
        setFormData({ ...formData, target: selected })
      }
    } catch (e) {
      console.error('Ошибка выбора файла:', e)
    }
  }

  const handleExport = () => {
    const json = customCommandsManager.exportCommands()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'custom_commands.json'
    a.click()
  }

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      
      if (selected && typeof selected === 'string') {
        const response = await fetch(`file://${selected}`)
        const json = await response.text()
        if (customCommandsManager.importCommands(json)) {
          loadCommands()
          alert('Команды успешно импортированы!')
        } else {
          alert('Ошибка импорта команд')
        }
      }
    } catch (e) {
      console.error('Ошибка импорта:', e)
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'open_file': return '📄 Открыть файл'
      case 'open_folder': return '📁 Открыть папку'
      case 'run_command': return '⚡ Выполнить команду'
      case 'open_url': return '🌐 Открыть URL'
      default: return action
    }
  }

  return (
    <>
      <button 
        className="custom-commands-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Управление пользовательскими командами"
      >
        🎤 {commands.length}
      </button>

      {isOpen && (
        <div className="custom-commands-modal">
          <div className="custom-commands-content">
            <div className="modal-header">
              <h3>🎤 Пользовательские голосовые команды</h3>
              <button className="close-button" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="commands-form">
              <h4>{editingCommand ? '✏️ Редактировать' : '➕ Добавить'} команду</h4>
              
              <div className="form-group">
                <label>Фраза для активации:</label>
                <input
                  type="text"
                  placeholder='Например: "открой мой проект"'
                  value={formData.phrase}
                  onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Тип действия:</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                >
                  <option value="open_file">📄 Открыть файл</option>
                  <option value="open_folder">📁 Открыть папку</option>
                  <option value="run_command">⚡ Выполнить команду</option>
                  <option value="open_url">🌐 Открыть URL</option>
                </select>
              </div>

              <div className="form-group">
                <label>Цель (путь/команда/URL):</label>
                <div className="target-input-group">
                  <input
                    type="text"
                    placeholder={
                      formData.action === 'open_url' 
                        ? 'https://example.com'
                        : formData.action === 'run_command'
                        ? 'notepad'
                        : 'C:\\path\\to\\file'
                    }
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  />
                  {(formData.action === 'open_file' || formData.action === 'open_folder') && (
                    <button className="browse-button" onClick={handleBrowseFile}>
                      📂 Обзор
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Описание (опционально):</label>
                <input
                  type="text"
                  placeholder="Краткое описание команды"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-buttons">
                {editingCommand ? (
                  <>
                    <button className="btn-primary" onClick={handleUpdate}>💾 Сохранить</button>
                    <button className="btn-secondary" onClick={resetForm}>Отмена</button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={handleAdd}>➕ Добавить</button>
                )}
              </div>
            </div>

            <div className="commands-list">
              <div className="list-header">
                <h4>📝 Мои команды ({commands.length})</h4>
                <div className="list-actions">
                  <button className="btn-small" onClick={handleExport} title="Экспорт">
                    💾 Экспорт
                  </button>
                  <button className="btn-small" onClick={handleImport} title="Импорт">
                    📥 Импорт
                  </button>
                </div>
              </div>

              {commands.length === 0 ? (
                <div className="empty-list">
                  <p>📭 Нет сохраненных команд</p>
                  <p>Добавьте свою первую голосовую команду!</p>
                </div>
              ) : (
                <div className="commands-grid">
                  {commands.map((cmd) => (
                    <div key={cmd.id} className="command-card">
                      <div className="command-header">
                        <div className="command-phrase">🎤 "{cmd.phrase}"</div>
                        <div className="command-actions">
                          <button 
                            className="btn-icon" 
                            onClick={() => handleEdit(cmd)}
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button 
                            className="btn-icon" 
                            onClick={() => handleDelete(cmd.id)}
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="command-action">{getActionLabel(cmd.action)}</div>
                      <div className="command-target" title={cmd.target}>
                        {cmd.target}
                      </div>
                      {cmd.description && (
                        <div className="command-description">{cmd.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CustomCommandsManager
