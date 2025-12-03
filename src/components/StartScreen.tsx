import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import { invoke } from '@tauri-apps/api/core'
import '../StartScreen.css'
import MusicPlayer from './MusicPlayer'

interface StartScreenProps {
  onStart: () => void
}

function StartScreen({ onStart }: StartScreenProps) {
  const { t, lang, setLang } = useI18n()
  const [autostart, setAutostart] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const enabled = await invoke<boolean>('is_autostart_enabled')
        setAutostart(enabled)
      } catch (e) {
        console.error('Ошибка проверки автозапуска:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleAutostart = async () => {
    try {
      if (autostart) {
        await invoke('disable_autostart')
        setAutostart(false)
        console.log('Автозапуск отключён')
      } else {
        await invoke('enable_autostart')
        setAutostart(true)
        console.log('Автозапуск включён')
      }
    } catch (e: any) {
      console.error('Ошибка переключения автозапуска:', e)
      alert('Не удалось изменить автозапуск: ' + (e?.message || e))
    }
  }

  return (
    <div className="start-screen">
      {/* Волны */}
      <div className="wave"></div>
      <div className="wave"></div>
      <div className="wave"></div>

      {/* Декоративные элементы */}
      <div className="decorative-elements">
        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="floating-circle circle-3"></div>
        <div className="floating-circle circle-4"></div>
        <div className="floating-square square-1"></div>
        <div className="floating-square square-2"></div>
      </div>

      {/* 3D сфера */}
      <div className="sphere-view">
        <div className="sphere-plane">
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
        </div>
      </div>

      {/* Контент стартового экрана */}
      <div className="start-content">
        <div className="start-logo">
          <h1 className="start-title">{t('start_title')}</h1>
          <p className="start-subtitle">{t('start_subtitle')}</p>
        </div>
        
        <div className="start-buttons" style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'center' }}>
          <button className="start-button" onClick={onStart}>
            {t('start_button')}
          </button>
          {/* Выбор языка */}
          <select aria-label={t('language_selector_label')} value={lang} onChange={(e)=>setLang(e.target.value as any)} style={{ padding:'8px 10px', background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#fff' }}>
            <option value="uk">Українська</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Блок поддержки проекта (ненавязчивый) */}
        <div style={{marginTop:10,textAlign:'center'}}>
          <span style={{fontSize:12,opacity:.6,color:'#ddd'}}>
            {t('support_label')}
            {' '}
            <a href="https://send.monobank.ua/jar/7p4c9uySHf" target="_blank" rel="noopener noreferrer" style={{color:'#ddd',opacity:.7,textDecoration:'underline'}}>{t('support_monobank')}</a>
            {' • '}
            <a href="https://funpay.com/uk/users/6117488/" target="_blank" rel="noopener noreferrer" style={{color:'#ddd',opacity:.7,textDecoration:'underline'}}>{t('support_funpay')}</a>
            {' • '}
            <a href="https://lolz.live/members/3486486/" target="_blank" rel="noopener noreferrer" style={{color:'#ddd',opacity:.7,textDecoration:'underline'}}>lolz</a>
          </span>
          <div style={{marginTop:6,fontSize:11,opacity:.55,color:'#ccc'}}>
            {t('support_card')}{' '}<code style={{background:'rgba(255,255,255,0.08)',padding:'2px 6px',borderRadius:4}}>4874 1000 2050 5312</code>
          </div>
        </div>
        
        <div style={{marginTop:30,padding:'16px 24px',background:'rgba(0,0,0,0.5)',border:'2px solid rgba(220,20,60,0.4)',borderRadius:12,maxWidth:400,margin:'30px auto 0'}}>
          <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:600,color:'var(--elfen-light-pink)',marginBottom:4}}>{t('autostart_title')}</div>
              <div style={{fontSize:12,opacity:.75,color:'#ccc'}}>{t('autostart_desc')}</div>
            </div>
            <div style={{position:'relative',width:52,height:28,background:autostart?'var(--elfen-crimson)':'rgba(255,255,255,0.2)',borderRadius:14,transition:'background .3s',border:'2px solid '+(autostart?'var(--elfen-red)':'rgba(255,255,255,0.3)'),boxShadow:autostart?'0 0 15px rgba(220,20,60,0.6)':'none'}}>
              <input type="checkbox" checked={autostart} onChange={toggleAutostart} disabled={loading} style={{position:'absolute',opacity:0,width:0,height:0}} />
              <div style={{position:'absolute',top:2,left:autostart?24:2,width:20,height:20,background:'#fff',borderRadius:'50%',transition:'left .3s',boxShadow:'0 2px 4px rgba(0,0,0,0.3)'}} />
            </div>
          </label>
        </div>
      </div>
      
      <MusicPlayer />
    </div>
  )
}

export default StartScreen
