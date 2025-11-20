import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './PetsManager.css';

interface Pet {
  id: string;
  file_path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CatalogPet {
  id: string;
  name: string;
  category: string;
  preview: string;
}

export const PetsManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [availablePets, setAvailablePets] = useState<CatalogPet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [addingPet, setAddingPet] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const selectedPet = availablePets.find((pet) => pet.id === selectedPetId) || null;

  const categories = ['all', ...Array.from(new Set(availablePets.map(pet => pet.category)))].sort();
  const filteredPets = selectedCategory === 'all' 
    ? availablePets 
    : availablePets.filter(pet => pet.category === selectedCategory);

  useEffect(() => {
    loadPets();
    loadAvailablePets();
  }, []);

  const loadPets = async () => {
    try {
      const loadedPets = await invoke<Pet[]>('get_all_pets');
      setPets(loadedPets);
    } catch (error) {
      console.error('Failed to load pets:', error);
    }
  };

  const loadAvailablePets = async () => {
    try {
      setCatalogLoading(true);
      const catalog = await invoke<CatalogPet[]>('get_available_pets');
      setAvailablePets(catalog);
      setSelectedPetId((current) => {
        if (current && catalog.some((pet) => pet.id === current)) {
          return current;
        }
        return catalog[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Failed to load catalog:', error);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleAddPet = async () => {
    if (!selectedPetId) return;
    try {
      setAddingPet(true);
      await invoke('add_pet_from_catalog', { petId: selectedPetId });
      await loadPets();
    } catch (error) {
      console.error('Failed to add pet:', error);
    } finally {
      setAddingPet(false);
    }
  };

  const handleRemovePet = async (petId: string) => {
    try {
      await invoke('remove_pet', { petId });
      await loadPets();
    } catch (error) {
      console.error('Failed to remove pet:', error);
    }
  };

  return (
    <div className="pets-manager-overlay">
      <div className="pets-manager-modal">
        <div className="pets-manager-header">
          <h2>🐾 Менеджер питомцев</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="pets-manager-content">
          <div className="pet-catalog">
            <div className="catalog-header">
              <h3>Библиотека питомцев</h3>
              <p>Выберите персонажа из встроенной коллекции</p>
            </div>

            {catalogLoading ? (
              <p className="catalog-status">Загружаем коллекцию...</p>
            ) : availablePets.length === 0 ? (
              <p className="catalog-status">
                Папка CustomPets пуста. Добавьте файлы в C:\\Users\\ВАШЕ_ИМЯ\\AppData\\Local\\CursorVerse\\CustomPets
              </p>
            ) : (
              <>
                <div className="category-filter">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat === 'all' ? '🌟 Все' : cat}
                    </button>
                  ))}
                </div>
                <div className="catalog-grid">
                  {filteredPets.map((pet) => (
                    <button
                      key={pet.id}
                      className={`catalog-card ${selectedPetId === pet.id ? 'selected' : ''}`}
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      <img src={pet.preview} alt={pet.name} />
                      <span>{pet.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedPet && (
              <div className="selected-pet-preview">
                <img src={selectedPet.preview} alt={selectedPet.name} />
                <div>
                  <h4>{selectedPet.name}</h4>
                  <p>Будет добавлен в виде отдельного окна.</p>
                </div>
              </div>
            )}

            <button
              className="add-pet-button"
              onClick={handleAddPet}
              disabled={!selectedPetId || addingPet}
            >
              {addingPet ? 'Добавляем...' : 'Добавить выбранного питомца'}
            </button>
          </div>

          <div className="pets-list">
            <h3>Активные питомцы ({pets.length})</h3>
            {pets.length === 0 ? (
              <p className="no-pets">У вас пока нет питомцев. Нажмите "Добавить питомца", чтобы начать!</p>
            ) : (
              <ul>
                {pets.map((pet) => (
                  <li key={pet.id} className="pet-item">
                    <div className="pet-info">
                      <span className="pet-name">{pet.file_path.split('\\').pop()}</span>
                      <span className="pet-details">
                        Позиция: ({pet.x}, {pet.y}) | Размер: {pet.width}x{pet.height}
                      </span>
                    </div>
                    <button
                      className="remove-pet-button"
                      onClick={() => handleRemovePet(pet.id)}
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pets-instructions">
            <h4>Как использовать:</h4>
            <ul>
              <li><strong>Выбор питомца:</strong> нажмите на карточку из библиотеки и подтвердите кнопкой ниже</li>
              <li><strong>Левая кнопка мыши:</strong> Удерживайте и перетаскивайте питомца</li>
              <li><strong>Колесико мыши:</strong> Прокручивайте для изменения размера</li>
              <li><strong>Удаление:</strong> Используйте кнопку выше для удаления питомца</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
