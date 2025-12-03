import React, { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { customCommandsManager, type CustomCommand } from '../utils/customCommands'
import { open } from '@tauri-apps/plugin-dialog'
import './LucyAssistant.css'

// CV иконка из public папки
const LucyIcon = '/CursorVerse.ico'

interface LogEntry { id:string; ts:number; text:string; type:'info'|'error'|'action' }

const DEFAULT_HOTKEY = 'Pause' // редко используется в играх

const CommandAssistant: React.FC = () => {
  const [commands, setCommands] = useState<CustomCommand[]>(customCommandsManager.getAllCommands())
  const [phrase, setPhrase] = useState('')
  const [target, setTarget] = useState('')
  const [action, setAction] = useState<CustomCommand['action']>('open_file')
  const [description, setDescription] = useState('')
  const [listening, setListening] = useState(false)
  const [hotkey, setHotkey] = useState(localStorage.getItem('command_assistant_hotkey') || DEFAULT_HOTKEY)
  const [micSupported, setMicSupported] = useState(true)
  const [micError, setMicError] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showCommandsModal, setShowCommandsModal] = useState(false)
  
  const recognitionRef = useRef<any>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { logEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [logs])

  // Speech setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicSupported(false)
      setMicError('Web Speech API недоступен')
      return
    }
    // Запрашиваем доступ к микрофону чтобы не падало на silent error
    navigator.mediaDevices?.getUserMedia?.({ audio: true }).then(() => {
      log('🎤 Разрешение микрофона получено','info')
    }).catch(err => {
      setMicSupported(false)
      setMicError('Нет доступа: ' + err.name)
      log('Нет доступа к микрофону: '+err.message,'error')
    })
  }, [])

  // Hotkey listener - нажать чтобы начать распознавание одной фразы
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === hotkey && !listening) {
        e.preventDefault()
        startListening()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hotkey, listening])

  const log = (text:string, type:LogEntry['type']='info') => {
    setLogs(prev => [...prev, { id:Date.now()+Math.random().toString(36), ts:Date.now(), text, type }].slice(-200))
  }

  const toggleListening = () => {
    if (!micSupported) return
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { setMicSupported(false); setMicError('Нет API'); return }
    
    // Если уже слушаем, не запускаем снова
    if (recognitionRef.current) {
      log('⚠️ Микрофон уже активен','error')
      return
    }
    
    try {
      const rec = new SpeechRecognition()
      rec.lang = 'ru-RU'
      rec.continuous = false // Однократное распознавание как в MDN
      rec.interimResults = false
      rec.maxAlternatives = 1
      
      rec.onstart = () => { 
        setListening(true)
        log('🎤 Слушаю...','info') 
      }
      
      rec.onresult = (ev:any) => {
        const text = ev.results[0][0].transcript.trim().toLowerCase()
        log('🗣 Распознано: '+text,'info')
        handlePhrase(text)
      }
      
      rec.onspeechend = () => {
        rec.stop() // Останавливаем после распознавания фразы
      }
      
      rec.onerror = (ev:any) => { 
        log('Ошибка распознавания: '+ev.error,'error')
        setListening(false)
      }
      
      rec.onend = () => { 
        setListening(false)
        recognitionRef.current = null
        log('✅ Готово','info')
      }
      
      recognitionRef.current = rec
      rec.start()
    } catch (e:any) {
      log('Не удалось начать распознавание: '+e.message,'error')
      setListening(false)
      recognitionRef.current = null
    }
  }

  const stopListening = () => {
    if (!recognitionRef.current) return
    
    try { 
      setListening(false) // Сначала сбрасываем флаг, чтобы onend не перезапустил
      recognitionRef.current.stop()
      recognitionRef.current = null
      log('⏹ Остановлено','info')
    } catch (e) {
      console.warn('Ошибка остановки:', e)
    }
  }

  const handlePhrase = async (spoken: string) => {
    const cmd = customCommandsManager.findCommandByPhrase(spoken)
    if (!cmd) { 
      log('Команда не найдена','error')
      return 
    }
    await executeCommand(cmd)
  }

  const executeCommand = async (cmd: CustomCommand) => {
    log('⚙️ Выполняю: '+cmd.phrase,'action')
    try {
      switch (cmd.action) {
        case 'open_file':
          // Windows: start "" "path"
          await invoke('execute_shell_command', { command: 'cmd', args: ['/c', 'start', '', cmd.target] })
          break
        case 'open_folder':
          await invoke('execute_shell_command', { command: 'cmd', args: ['/c', 'start', '', cmd.target] })
          break
        case 'run_command':
          await invoke('execute_shell_command', { command: 'cmd', args: ['/c', cmd.target] })
          break
        case 'open_url':
          await invoke('execute_shell_command', { command: 'cmd', args: ['/c', 'start', '', cmd.target] })
          break
      }
      log('✅ Готово','action')
    } catch (e:any) {
      log('❌ Ошибка выполнения: '+e.message,'error')
    }
  }

  const addCommand = () => {
    if (!phrase.trim() || !target.trim()) return
    const cmd = customCommandsManager.addCommand({ phrase: phrase.trim().toLowerCase(), action, target: target.trim(), description })
    setCommands(customCommandsManager.getAllCommands())
    setPhrase(''); setTarget(''); setDescription('')
    log('Добавлена команда: '+cmd.phrase,'action')
  }

  const removeCommand = (id:string) => {
    customCommandsManager.removeCommand(id)
    setCommands(customCommandsManager.getAllCommands())
  }

  const pickFile = async () => {
    try {
      const file = await open({ multiple:false, directory:false })
      if (file) {
        // plugin-dialog может возвращать строку пути
        setTarget(String(file))
        log('Выбран файл: '+file,'info')
      }
    } catch (e:any) {
      log('Ошибка выбора файла: '+e.message,'error')
    }
  }

  const saveHotkey = () => {
    localStorage.setItem('command_assistant_hotkey', hotkey)
    log('Горячая клавиша сохранена: '+hotkey,'info')
  }

  return (
    <div className="lucy-assistant">
      <div className="lucy-header">
        <div className="lucy-title">
          <div className="lucy-avatar"><img src={LucyIcon} alt="Lucy" style={{width:48,height:48,borderRadius:12}} onError={(e)=>{e.currentTarget.src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><text y="32" font-size="32">🤖</text></svg>'}} /></div>
          <div>
            <h2>Люси</h2>
            <p className="lucy-subtitle">Голосовые триггеры для запуска приложений</p>
          </div>
        </div>
        <div className="lucy-status">
          <div className={`status-indicator ${listening ? 'active' : 'ready'}`}>
            <span className="status-dot"></span>
            <span>{listening ? '🎤 Слушаю' : '🛑 Остановлен'}</span>
          </div>
          <div className={`llm-badge offline`} title="LLM не используется">⚙️ Режим команд</div>
        </div>
      </div>

      {/* Command creation */}
      <div className="lucy-welcome" style={{marginBottom:30}}>
        <h3 style={{marginBottom:16}}>Добавить команду</h3>
        <div style={{display:'flex',flexDirection:'column',gap:14,textAlign:'left'}}>
          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--elfen-light-pink)'}}>Фраза активации</span>
            <input style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'2px solid rgba(220,20,60,0.4)',background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:14,transition:'border .3s'}} value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="например: открой фотошоп" onFocus={e=>e.target.style.borderColor='var(--elfen-crimson)'} onBlur={e=>e.target.style.borderColor='rgba(220,20,60,0.4)'} />
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--elfen-light-pink)'}}>Действие</span>
            <select style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'2px solid rgba(220,20,60,0.4)',background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:14,cursor:'pointer'}} value={action} onChange={e=>setAction(e.target.value as any)}>
              <option value="open_file">Открыть файл / exe</option>
              <option value="open_folder">Открыть папку</option>
              <option value="run_command">Выполнить команду</option>
              <option value="open_url">Открыть URL</option>
            </select>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--elfen-light-pink)'}}>Цель</span>
            <div style={{display:'flex',gap:10}}>
              <input style={{flex:1,padding:'10px 14px',borderRadius:10,border:'2px solid rgba(220,20,60,0.4)',background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:14}} value={target} onChange={e=>setTarget(e.target.value)} placeholder="C:\\Path\\To\\App.exe или https://..." />
              <button type="button" onClick={pickFile} className="animated-button" style={{minWidth:120,height:44,padding:'0 16px',fontSize:14}}>📁 Выбрать</button>
            </div>
          </label>
          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--elfen-light-pink)'}}>Описание (необязательно)</span>
            <input style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'2px solid rgba(220,20,60,0.4)',background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:14}} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Кратко что делает" />
          </label>
          <button onClick={addCommand} disabled={!phrase.trim()||!target.trim()} className="confirm-button" style={{width:'100%',height:52,marginTop:8}}>
            <span className="button-text">✨ Добавить команду</span>
            <span className="button-icon-area">
              <span className="icon-default">➕</span>
              <span className="icon-success">✅</span>
            </span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="lucy-input-panel" style={{marginTop:'auto'}}>
        <div className="lucy-controls" style={{flexWrap:'wrap'}}>
          <button className="btn-control" onClick={toggleListening} disabled={!micSupported}>
            {listening? '⏹ Остановить' : '🎤 Слушать'}
          </button>
          <button className="btn-control" onClick={()=>setShowCommandsModal(true)} style={{background:'linear-gradient(135deg, var(--elfen-crimson) 0%, var(--elfen-red) 100%)'}}>
            📋 Команды ({commands.length})
          </button>
          <button className="btn-control" onClick={()=>{ customCommandsManager.clearAll(); setCommands([])}}>🗑️ Очистить команды</button>
          <button className="btn-control" onClick={()=>log(customCommandsManager.exportCommands(),'info')}>📤 Экспорт JSON</button>
        </div>
        <div style={{marginTop:20,display:'flex',flexDirection:'column',gap:8}}>
          <label>Горячая клавиша push-to-talk:
            <input value={hotkey} onChange={e=>setHotkey(e.target.value)} onBlur={saveHotkey} style={{marginLeft:8,padding:6,borderRadius:8,border:'1px solid var(--elfen-crimson)',background:'rgba(0,0,0,0.4)',color:'#fff'}} />
          </label>
          {!micSupported && <div style={{color:'#ff8080',fontSize:12}}>Микрофон недоступен: {micError}</div>}
        </div>
        <div style={{marginTop:24}}>
          <h4>Логи</h4>
          <div style={{maxHeight:160,overflowY:'auto',padding:10,border:'1px solid rgba(220,20,60,0.4)',borderRadius:12,background:'rgba(0,0,0,0.35)'}}>
            {logs.map(l => (
              <div key={l.id} style={{fontSize:12,marginBottom:4,color:l.type==='error'?'#ff6b6b':l.type==='action'?'var(--elfen-crimson)':'#ccc'}}>
                [{new Date(l.ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}] {l.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Commands Modal */}
      {showCommandsModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,backdropFilter:'blur(8px)'}} onClick={()=>setShowCommandsModal(false)}>
          <div style={{width:'90%',maxWidth:800,maxHeight:'85vh',background:'linear-gradient(135deg, rgba(10,0,0,0.98) 0%, rgba(26,0,0,0.98) 50%, rgba(51,0,0,0.95) 100%)',border:'2px solid var(--elfen-crimson)',borderRadius:16,padding:24,boxShadow:'0 8px 40px rgba(220,20,60,0.6), 0 0 60px rgba(139,0,0,0.4)',overflow:'hidden',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{margin:0}}>📋 Мои команды</h2>
              <button onClick={()=>setShowCommandsModal(false)} style={{padding:'8px 16px',background:'rgba(220,20,60,0.3)',border:'1px solid var(--elfen-crimson)',borderRadius:8,color:'#fff',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',paddingRight:8}}>
              {commands.length===0 && (
                <div style={{textAlign:'center',padding:60,opacity:.6}}>
                  <div style={{fontSize:48,marginBottom:16}}>📭</div>
                  <p>Нет команд. Добавьте команду в форме выше.</p>
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {commands.map(c => (
                  <div key={c.id} style={{background:'linear-gradient(135deg, rgba(139,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',border:'2px solid rgba(220,20,60,0.4)',borderRadius:14,padding:16,transition:'all .3s',boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <strong style={{color:'var(--elfen-light-pink)',fontSize:16,display:'block',marginBottom:8}}>💬 {c.phrase}</strong>
                        <div style={{fontSize:13,opacity:.75,color:'#fff',marginBottom:6}}>
                          <span style={{padding:'4px 10px',background:'rgba(220,20,60,0.3)',borderRadius:6,marginRight:8,fontSize:12,fontWeight:600}}>{c.action.replace('_',' ')}</span>
                          <span style={{wordBreak:'break-all'}}>{c.target}</span>
                        </div>
                        {c.description && <div style={{fontSize:13,opacity:.85,color:'#ccc',marginTop:8,fontStyle:'italic',paddingLeft:4}}>📝 {c.description}</div>}
                      </div>
                      <div style={{display:'flex',gap:8,flexShrink:0}}>
                        <button onClick={()=>{executeCommand(c);setShowCommandsModal(false)}} className="animated-button" style={{minWidth:100,height:38,fontSize:13}}>
                          <span>▶️ Запустить</span>
                        </button>
                        <button onClick={()=>removeCommand(c.id)} className="remove-button animated-button" style={{minWidth:90,height:38,fontSize:13}}>
                          <span>🗑️ Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default CommandAssistant