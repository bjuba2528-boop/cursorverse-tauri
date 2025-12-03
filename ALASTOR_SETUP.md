# 🎭 Alastor DPET - Quick Setup Guide

## О питомце

**Alastor** из Hazbin Hotel - харизматичный радио-демон в качестве вашего desktop pet!

## Автоматическая установка (Рекомендуется)

### Способ 1: Из Steam Workshop (требует Steam)

```cmd
download-alastor.bat
```

Этот скрипт:
1. Загрузит Alastor Shimeji из Steam Workshop (ID: 2970172335)
2. Конвертирует в формат DPET
3. Создаст готовый пакет `alastor-dpet`

### Способ 2: Ручная установка из Shimeji

Если у вас уже есть Alastor Shimeji:

```cmd
convert-shimeji-to-dpet.bat "путь\к\alastor-shimeji"
```

## Альтернатива: Создание с нуля

Если автоматические способы не работают, можно создать вручную:

### 1. Найдите GIF анимации Alastor

Источники:
- **GIPHY**: `https://giphy.com/search/alastor-hazbin-hotel`
- **Tenor**: `https://tenor.com/search/alastor-gifs`
- **Pinterest**: Поиск "Alastor pixel art gif"
- **DeviantArt**: Поиск "Alastor animated"

### 2. Создайте структуру

```
alastor-dpet/
├── dpet.json
└── animations/
    ├── idle/
    │   └── alastor_idle.gif
    ├── walk/
    │   └── alastor_walk.gif
    ├── fall/
    │   └── alastor_fall.gif
    ├── drag/
    │   └── alastor_drag.gif
    └── click/
        └── alastor_smile.gif
```

### 3. Создайте dpet.json

```json
{
  "name": "Alastor - Radio Demon",
  "author": "Hazbin Hotel",
  "fps": 24,
  "scale": 1.2,
  "behavior_change_rarity": 30.0,
  
  "can_move": true,
  "can_drag": true,
  "can_click": true,
  "can_fall": true,
  
  "move_speed": 3.0,
  
  "physics": {
    "max_velocity": 50.0,
    "friction": 0.88,
    "gravity": 2.5
  },
  
  "animations": {
    "idle": ["animations/idle/alastor_idle.gif"],
    "walk": ["animations/walk/alastor_walk.gif"],
    "fall": ["animations/fall/alastor_fall.gif"],
    "drag": ["animations/drag/alastor_drag.gif"],
    "click": ["animations/click/alastor_smile.gif"]
  }
}
```

### 4. Импортируйте в CursorVerse

1. Откройте CursorVerse
2. Вкладка **🐾 DPET**
3. **➕ Импортировать пакет**
4. Выберите `alastor-dpet`
5. **✨ Создать питомца**

## Рекомендуемые параметры для Alastor

Alastor - энергичный и харизматичный персонаж:

```json
{
  "scale": 1.2,              // Чуть больше обычного
  "move_speed": 3.0,         // Быстрые движения
  "behavior_change_rarity": 30.0,  // Часто меняет поведение
  "physics": {
    "max_velocity": 50.0,    // Очень быстрый
    "friction": 0.88,        // Скользкие движения
    "gravity": 2.5           // Усиленная гравитация
  }
}
```

## Идеи для анимаций

1. **Idle**: Улыбается, держит микрофон
2. **Walk**: Танцующая походка
3. **Fall**: Драматичное падение
4. **Drag**: Сопротивляется с ухмылкой
5. **Click**: Радиоволны, static эффект

## Поиск готовых ресурсов

### GIF коллекции
- GIPHY: https://giphy.com/search/alastor
- Tenor: https://tenor.com/search/alastor-hazbin-hotel
- Tumblr: Тег #alastor #hazbin hotel #gif

### Pixel Art
- itch.io: Поиск "Alastor sprite"
- Game Banana: Hazbin Hotel assets
- Sprite Database: Fan-made спрайты

## Troubleshooting

### Проблема: Не загружается из Steam

**Решение**: 
1. Проверьте подключение к интернету
2. Убедитесь, что у вас установлен Steam
3. Попробуйте скачать вручную из Workshop

### Проблема: Нет нужных анимаций

**Решение**:
1. Используйте одну и ту же GIF для всех состояний
2. Постепенно заменяйте на лучшие анимации
3. Создайте свои в Aseprite или GIMP

### Проблема: Файлы слишком большие

**Решение**:
- Используйте ezgif.com для оптимизации
- Уменьшите размер до 256x256 пикселей
- Сократите количество кадров

## Ресурсы

- **Steam Workshop**: https://steamcommunity.com/sharedfiles/filedetails/?id=2970172335
- **Hazbin Hotel Wiki**: https://hazbinhotel.fandom.com/wiki/Alastor
- **Fan Art**: DeviantArt, ArtStation

---

**Enjoy your Radio Demon desktop pet! 📻😈**
