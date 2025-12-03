import React, { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import { llmService, type LLMConfig, type LLMProvider } from '../utils/llmService'
import './LLMSettings.css'

const LLMSettings: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useI18n()
  const [config, setConfig] = useState<LLMConfig>(llmService.getConfig())
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = () => {
    setStatus(llmService.isReady() ? 'connected' : 'disconnected')
  }

  const handleSave = async () => {
    setStatus('connecting')
    llmService.saveConfig(config)
    
    setTimeout(() => {
      checkStatus()
      if (llmService.isReady()) {
        setIsOpen(false)
      }
    }, 1000)
  }

  // Конфигурации по умолчанию для каждого провайдера
  const providerDefaults: Record<LLMProvider, any> = {
    gemini: {
      model: 'gemini-2.0-flash-exp',
      apiKey: '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      info: '🌟 Google Gemini 2.0 - самая продвинутая модель! Доступны: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash'
    },
    yandexgpt: {
      model: 'yandexgpt-lite',
      baseURL: 'https://llm.api.cloud.yandex.net/foundationModels/v1',
      info: 'YandexGPT - работает в России, грант 4000₽ при регистрации'
    },
    lmstudio: {
      model: 'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
      apiKey: 'lm-studio',
      baseURL: 'http://localhost:1234/v1',
      info: '🦙 LM Studio - локальная LLaMA модель (полная приватность, без интернета)'
    },
    lucy: {
      model: 'gpt-4o',
      apiKey: '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',
      baseURL: 'https://models.inference.ai.azure.com',
      info: '🌟 Lucy AI - бесплатные модели от GitHub (GPT-4o, Llama, Phi-4)'
    }
  }

  const handleProviderChange = (provider: LLMProvider) => {
    const defaults = providerDefaults[provider]
    setConfig({
      ...config,
      provider,
      model: defaults.model,
      baseURL: defaults.baseURL
    })
  }

  return (
    <>
      <button 
        className="llm-settings-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={t('llm_settings_toggle_title')}
      >
        <span className={`status-dot ${status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'}`}></span>
        ⚙️
      </button>

      {isOpen && (
        <div className="llm-settings-modal" onClick={() => setIsOpen(false)}>
          <div className="llm-settings-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚙️ {t('llm_settings_title')}</h3>
              <button className="close-button" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="settings-form">
              <div className="form-group">
                <label>🌐 {t('llm_provider_label')}:</label>
                <select 
                  value={config.provider || 'lmstudio'} 
                  onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
                >
                  <option value="lucy">🌟 Lucy AI (GitHub Models - бесплатно)</option>
                  <option value="lmstudio">🦙 LM Studio (LLaMA - локально)</option>
                  <option value="yandexgpt">{t('llm_provider_yandex')}</option>
                  <option value="gemini">{t('llm_provider_gemini')}</option>
                </select>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  {providerDefaults[config.provider || 'yandexgpt'].info}
                </div>
              </div>

              <div className="form-group">
                <label>🔑 {t('llm_api_key_label')}:</label>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder={config.provider === 'gemini' ? 'AIzaSy...' : 'AQVNxxxxx...'}
                />
                {config.provider === 'lucy' && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(168,85,247,0.1)', borderRadius: 6, fontSize: 12 }}>
                    <strong>🌟 Получите GitHub Personal Access Token:</strong>
                    <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      <li>Откройте: <a href="https://github.com/settings/tokens" target="_blank" style={{ color: '#a855f7' }}>GitHub Tokens</a></li>
                      <li>Нажмите <strong>"Generate new token (classic)"</strong> (не Fine-grained!)</li>
                      <li>Установите срок действия (например, 90 дней)</li>
                      <li>НЕ выбирайте никакие scopes (оставьте пустым)</li>
                      <li>Нажмите <strong>"Generate token"</strong></li>
                      <li>Скопируйте токен вида <code>ghp_xxxxxxxxxxxx</code> и вставьте выше</li>
                    </ol>
                    <div style={{ marginTop: 8, padding: 6, background: 'rgba(220,38,38,0.2)', borderRadius: 4, border: '1px solid rgba(220,38,38,0.4)' }}>
                      ⚠️ <strong>ВАЖНО:</strong> Используйте <strong>classic</strong> токен БЕЗ scope! Fine-grained не работает.
                    </div>
                    <div style={{ marginTop: 4, padding: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                      ✨ <strong>Бесплатно:</strong> GPT-4o, Llama 3.3, Phi-4, Mistral - без кредитки!
                    </div>
                    <div style={{ marginTop: 4, padding: 6, background: 'rgba(34,197,94,0.2)', borderRadius: 4 }}>
                      🌍 <strong>Работает в России!</strong> Не требует VPN.
                    </div>
                  </div>
                )}
                {config.provider === 'gemini' && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(59,130,246,0.1)', borderRadius: 6, fontSize: 12 }}>
                    <strong>🔑 Получите Gemini API Key:</strong>
                    <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      <li>Откройте: <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: '#60a5fa' }}>Google AI Studio</a></li>
                      <li>Нажмите <strong>"Create API key"</strong></li>
                      <li>Выберите проект или создайте новый (Google Cloud Console)</li>
                      <li>Скопируйте ключ вида <code>AIzaSy...</code> и вставьте выше</li>
                    </ol>
                    <div style={{ marginTop: 8, padding: 6, background: 'rgba(34,197,94,0.2)', borderRadius: 4, border: '1px solid rgba(34,197,94,0.4)' }}>
                      ✨ <strong>Доступные модели:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 20, fontSize: 11 }}>
                        <li><code>gemini-2.0-flash-exp</code> - новейшая, самая быстрая!</li>
                        <li><code>gemini-1.5-pro</code> - максимальная мощь</li>
                        <li><code>gemini-1.5-flash</code> - быстрая и экономная</li>
                      </ul>
                    </div>
                    <div style={{ marginTop: 8, padding: 6, background: 'rgba(220,38,38,0.2)', borderRadius: 4, border: '1px solid rgba(220,38,38,0.4)' }}>
                      ⚠️ <strong>Важно:</strong> Gemini может не работать в России (нужен VPN/прокси)
                    </div>
                  </div>
                )}
                {config.provider === 'yandexgpt' && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(220,38,38,0.1)', borderRadius: 6, fontSize: 12 }}>
                    <strong>📋 {t('yandex_setup_title')}:</strong>
                    <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      <li>{t('yandex_setup_step1')}</li>
                      <li>{t('yandex_setup_step2')}</li>
                      <li>{t('yandex_setup_step3')}</li>
                      <li>{t('yandex_setup_step4')}</li>
                      <li>{t('yandex_setup_step5')}</li>
                    </ol>
                    <div style={{ marginTop: 8, padding: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                      💰 {t('yandex_setup_grant_note')}
                    </div>
                  </div>
                )}
              </div>

              {config.provider === 'yandexgpt' && (
                <div className="form-group">
                  <label>📁 Catalog ID (Folder ID):</label>
                  <input
                    type="text"
                    value={config.catalogId || ''}
                    onChange={(e) => setConfig({ ...config, catalogId: e.target.value })}
                    placeholder="b1g..."
                  />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                    Найди в <a href="https://console.yandex.cloud/folders/b1gf60jmr28js999hc1l/dashboard" target="_blank" rel="noopener noreferrer" style={{color: 'var(--elfen-crimson)', textDecoration: 'underline'}}>консоли Yandex Cloud</a> (вверху страницы, после "Каталог:")
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>🤖 {t('llm_model_label')}:</label>
                <input
                  type="text"
                  value={config.model || providerDefaults[config.provider || 'yandexgpt'].model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  placeholder={providerDefaults[config.provider || 'yandexgpt'].model}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('llm_temperature_label')}:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature || 0.7}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>{t('llm_max_tokens_label')}:</label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={config.maxTokens || 500}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="status-info">
                <div className={`status-badge ${status}`}>
                  {status === 'connected' && `✅ ${t('status_connected')}`}
                  {status === 'connecting' && `🔄 ${t('status_connecting')}`}
                  {status === 'disconnected' && `❌ ${t('status_not_connected')}`}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave}>
                  💾 {t('llm_save_and_connect')}
                </button>
                <button className="btn-secondary" onClick={() => setIsOpen(false)}>
                  {t('cancel')}
                </button>
              </div>

              <div className="settings-info">
                <h4>ℹ️ {t('llm_info_title')}:</h4>
                <ul>
                  <li>{t('llm_info_yandex')}</li>
                  <li>{t('llm_info_gemini')}</li>
                  <li>{t('llm_info_keys')}</li>
                </ul>
              </div>

              <div className="settings-info" style={{ marginTop: 16 }}>
                <h4>💖 {t('support_title')}:</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href="https://send.monobank.ua/jar/7p4c9uySHf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    💳 {t('support_monobank')}
                  </a>
                  <a
                    href="https://funpay.com/uk/users/6117488/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    🎮 {t('support_funpay')}
                  </a>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {t('support_card_label')}: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>4874 1000 2050 5312</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default LLMSettings
