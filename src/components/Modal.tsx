import React, { useEffect, useState } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  type?: 'info' | 'success' | 'error' | 'warning'
}

function Modal({ isOpen, onClose, title, children, type = 'info' }: ModalProps) {
  const [animationState, setAnimationState] = useState<'appear' | 'leave' | ''>('')

  useEffect(() => {
    if (isOpen) {
      setAnimationState('appear')
    } else if (animationState === 'appear') {
      setAnimationState('leave')
    }
  }, [isOpen, animationState])

  // Закрытие по Esc
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleAnimationEnd = () => {
    if (animationState === 'leave') {
      setAnimationState('')
    }
  }

  if (!isOpen && animationState === '') return null

  return (
    <>
      <div 
        className={`modal-overlay ${isOpen ? 'state-show' : ''}`}
        onClick={onClose}
      />
      <div 
        className={`modal-frame state-${animationState}`}
        onAnimationEnd={handleAnimationEnd}
        onClick={onClose}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-inset">
            <span className="close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path 
                  fill="currentColor" 
                  d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"
                />
              </svg>
            </span>
            <div className="modal-body">
              {title && <h3 className={title === 'Превью курсора' ? 'modal-title-preview' : `modal-title-${type}`}>{title}</h3>}
              <div className="modal-content">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Modal
