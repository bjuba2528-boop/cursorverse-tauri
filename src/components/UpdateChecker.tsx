import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { open } from '@tauri-apps/plugin-shell'
import Modal from './Modal'
import { useI18n } from '../i18n'

interface UpdateCheckerProps {
  onUpdateComplete?: () => void
}

const MANUAL_DOWNLOAD_URL = 'https://github.com/ShustovCarleone/Cursor-Galaxy/releases/latest'

function UpdateChecker({ onUpdateComplete }: UpdateCheckerProps) {
  const { t } = useI18n()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [checking, setChecking] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    if (checking) return
    
    setChecking(true)
    setError('')
    setStatusMessage('')
    
    try {
      const update = await check()
      
      if (update?.available) {
        setUpdateAvailable(true)
        setUpdateVersion(update.version)
        setStatusMessage(`${t('update_status_available_prefix')} ${update.version}`)
      } else {
        setStatusMessage(t('update_status_latest'))
        setTimeout(() => setStatusMessage(''), 3000)
      }
    } catch (err: any) {
      console.error('Failed to check for updates:', err)
      const errorMsg = err?.message || String(err) || t('update_error_check_generic')
      setError(errorMsg)
      setStatusMessage(t('update_error_check_failed'))
      setTimeout(() => {
        setError('')
        setStatusMessage('')
      }, 5000)
    } finally {
      setChecking(false)
    }
  }

  const openConfirmModal = () => {
    setShowModal(true)
    setError('')
  }

  const handleInstallUpdate = async () => {
    try {
      setDownloading(true)
      setError('')
      setDownloadProgress(0)
      
      const update = await check()
      
      if (!update?.available) {
        setError(t('update_error_not_found'))
        setDownloading(false)
        return
      }

      // Симуляция прогресса (т.к. Tauri 2.x может не предоставлять прогресс)
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) return prev
          return prev + 10
        })
      }, 500)

      await update.downloadAndInstall()
      
      clearInterval(progressInterval)
      setDownloadProgress(100)
      
      // Небольшая задержка перед перезапуском
      setTimeout(async () => {
        await relaunch()
      }, 1000)
      
    } catch (err: any) {
      console.error('Failed to install update:', err)
      const errorMsg = err?.message || String(err) || t('update_error_install_failed')
      setError(errorMsg)
      setDownloading(false)
      setDownloadProgress(0)
    }
  }

  const handleDismiss = () => {
    setShowModal(false)
    setError('')
    if (onUpdateComplete) {
      onUpdateComplete()
    }
  }

  const handleManualDownload = async () => {
    try {
      await open(MANUAL_DOWNLOAD_URL)
    } catch (err) {
      console.error('Failed to open URL:', err)
    }
  }

  return (
    <>
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button 
          onClick={updateAvailable ? openConfirmModal : checkForUpdates}
          disabled={checking || downloading}
          className={updateAvailable ? 'update-available' : ''}
          style={{ 
            fontSize: 13, 
            minHeight: 40,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {checking && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              {t('update_checking')}
            </span>
          )}
          {!checking && updateAvailable && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              {t('update_button_available_prefix')} {updateVersion}
            </span>
          )}
          {!checking && !updateAvailable && t('update_button_check')}
        </button>
        
        {statusMessage && !error && (
          <div style={{ 
            fontSize: 11, 
            opacity: 0.7, 
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.8)'
          }}>
            {statusMessage}
          </div>
        )}
        
        {error && (
          <div style={{ 
            fontSize: 11, 
            opacity: 0.8,
            textAlign: 'center',
            color: '#ff6b6b',
            padding: '4px 8px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: 4
          }}>
            {error}
          </div>
        )}
      </div>
      
      {showModal && updateAvailable && (
        <Modal
          isOpen={showModal}
          onClose={handleDismiss}
          type="info"
          title={t('update_modal_title')}
        >
          <div style={{ padding: '16px 0' }}>
            {error && (
              <div style={{ 
                color: '#ef4444', 
                marginBottom: 16,
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                ❌ {error}
              </div>
            )}
            
            <p style={{ marginBottom: 16, fontSize: 15, lineHeight: 1.6 }}>
              {t('update_modal_found_prefix')} <strong style={{ color: '#FF0080' }}>{updateVersion}</strong>
            </p>
            
            {downloading ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ 
                  height: 10, 
                  background: 'rgba(255,255,255,0.08)', 
                  borderRadius: 5, 
                  overflow: 'hidden',
                  marginBottom: 8 
                }}>
                  <div style={{ 
                    width: `${downloadProgress}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, #FF0080, #C724B1)',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 10px rgba(255, 0, 128, 0.5)'
                  }} />
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, textAlign: 'center' }}>
                  {t('update_downloading')} {downloadProgress}%
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={handleInstallUpdate} 
                    style={{ 
                      flex: 1,
                      background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                      fontWeight: 600
                    }}
                  >
                    {t('update_install_now')}
                  </button>
                  <button 
                    onClick={handleDismiss} 
                    className="reset-btn" 
                    style={{ 
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    {t('later')}
                  </button>
                </div>
                <button 
                  onClick={handleManualDownload}
                  style={{ 
                    fontSize: 12, 
                    opacity: 0.85,
                    background: 'rgba(157, 0, 255, 0.15)',
                    border: '1px solid rgba(157, 0, 255, 0.3)'
                  }}
                >
                  {t('update_manual_download')}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .update-available {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 0, 128, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(255, 0, 128, 0); }
        }
      `}</style>
    </>
  )
}

export default UpdateChecker
