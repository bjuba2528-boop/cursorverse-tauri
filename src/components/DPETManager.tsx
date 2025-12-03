import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './DPETManager.css'

interface DPetPackage {
  id: string
  name: string
  author?: string
  description?: string
  preview_image?: string
  preview_path?: string
  states: string[]
}

interface DPet {
  id: string
  name: string
  package_id: string
  position: { x: number; y: number }
  state: string
  velocity: { x: number; y: number }
}

export default function DPETManager() {
  const [packages, setPackages] = useState<DPetPackage[]>([])
  const [activePets, setActivePets] = useState<DPet[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [zoomPreview, setZoomPreview] = useState<{ img: string; title: string } | null>(null)
  const [view, setView] = useState<'library' | 'active'>('library')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const pkgs = await invoke<DPetPackage[]>('dpet_load_packages')
      const pets = await invoke<DPet[]>('dpet_get_active_pets')
      
      // Загружаем превью для каждого пакета
      const pkgsWithPreviews = await Promise.all(pkgs.map(async (pkg) => {
        if (pkg.preview_path) {
          try {
            const base64 = await invoke<string>('dpet_get_sprite_sheet', { packageId: pkg.id })
            return { ...pkg, preview_image: base64 }
          } catch (err) {
            console.warn('Failed to load preview for', pkg.id, err)
            return pkg
          }
        }
        return pkg
      }))
      
      setPackages(pkgsWithPreviews)
      setActivePets(pets)
    } catch (error) {
      console.error('Failed to load DPET data:', error)
    }
  }

  // Импорт и создание отключены по запросу пользователя

  const handleRemovePet = async (petId: string) => {
    try {
      setLoading(true)
      await invoke('dpet_remove_pet', { petId })
      await loadData()
    } catch (error) {
      console.error('Failed to remove pet:', error)
      alert('Ошибка удаления питомца: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dpet-manager">
      <div className="dpet-header">
        <h1>🐾 Pets Library</h1>
        <p className="dpet-subtitle">Библиотека анимированных питомцев на рабочий стол</p>
      </div>

      {/* Переключатель вида */}
      <div className="dpet-view-switcher">
        <button
          className={view === 'library' ? 'active' : ''}
          onClick={() => setView('library')}
        >
          📚 Библиотека ({packages.length})
        </button>
        <button
          className={view === 'active' ? 'active' : ''}
          onClick={() => setView('active')}
        >
          ✨ Активные ({activePets.length})
        </button>
      </div>

      {/* Библиотека питомцев */}
      {view === 'library' && (
        <div className="dpet-section">
          <div className="dpet-section-header">
            <h2>📦 Доступные питомцы</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="dpet-btn dpet-btn-secondary"
                onClick={loadData}
                disabled={loading}
                title="Обновить список питомцев"
              >
                🔄 Обновить
              </button>
              {/* Кнопка добавления удалена по запросу пользователя */}
            </div>
          </div>

          {packages.length === 0 ? (
            <div className="dpet-empty">
              <p>Библиотека пуста</p>
              <p className="dpet-hint">Нажмите "Добавить питомца" чтобы импортировать новых питомцев</p>
              <p className="dpet-hint">📁 Путь к библиотеке: C:\Users\shust\AppData\Local\CursorVerse\CustomPets</p>
            </div>
          ) : (
            <div className="dpet-packages-grid">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`dpet-package-card ${selectedPackage === pkg.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <div className="dpet-package-preview">
                    {pkg.preview_image ? (
                      <img
                        src={`data:image/png;base64,${pkg.preview_image}`}
                        alt={pkg.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          setZoomPreview({ img: `data:image/png;base64,${pkg.preview_image}`, title: pkg.name })
                        }}
                      />
                    ) : (
                      <div className="dpet-package-placeholder">🐾</div>
                    )}
                  </div>
                  <div className="dpet-package-info">
                    <h3>{pkg.name}</h3>
                    {/* Скрываем автора и путь/описание по просьбе пользователя */}
                  </div>
                  <button
                    className="dpet-btn dpet-btn-success"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLoading(true)
                      invoke('dpet_create_pet', { packageId: pkg.id })
                        .then(loadData)
                        .catch((error) => alert('Ошибка создания питомца: ' + error))
                        .finally(() => setLoading(false))
                    }}
                    disabled={loading}
                  >
                    ✨ Создать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Активные питомцы */}
      {view === 'active' && (
        <div className="dpet-section">
          <div className="dpet-section-header">
            <h2>✨ Активные питомцы</h2>
          </div>

          {activePets.length === 0 ? (
            <div className="dpet-empty">
              <p>Нет активных питомцев</p>
              <p className="dpet-hint">Перейдите в библиотеку и создайте питомца</p>
            </div>
          ) : (
            <div className="dpet-pets-grid">
              {activePets.map((pet) => (
                <div key={pet.id} className="dpet-pet-card">
                  <div className="dpet-pet-info">
                    <h3>{pet.name}</h3>
                    <p className="dpet-state">Состояние: {pet.state}</p>
                    <p className="dpet-position">
                      Позиция: x: {Math.round(pet.position.x)}, y: {Math.round(pet.position.y)}
                    </p>
                  </div>
                  <button
                    className="dpet-btn dpet-btn-danger"
                    onClick={() => handleRemovePet(pet.id)}
                    disabled={loading}
                  >
                    ❌ Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="dpet-loading">
          <div className="dpet-spinner"></div>
          <p>Загрузка...</p>
        </div>
      )}
      {zoomPreview && (
        <div className="dpet-zoom-overlay" onClick={() => setZoomPreview(null)}>
          <div className="dpet-zoom-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{zoomPreview.title}</h3>
            <img src={zoomPreview.img} alt={zoomPreview.title} />
            <button className="dpet-btn" onClick={() => setZoomPreview(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}
