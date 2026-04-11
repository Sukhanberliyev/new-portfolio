import type { WallpaperOption } from './osTypes'

export const DEFAULT_WALLPAPER_ID = 'sequoia'

export const WALLPAPERS: WallpaperOption[] = [
  {
    id: 'sequoia',
    name: 'Sequoia',
    background:
      'linear-gradient(165deg, #1a3a52 0%, #2d5a7b 25%, #4a8fb8 45%, #87b8d4 65%, #c4a574 85%, #d4b896 100%)',
  },
  {
    id: 'ventura',
    name: 'Ventura',
    background:
      'linear-gradient(135deg, #0f172a 0%, #1e3a5f 30%, #3d6b8c 55%, #7eb8c4 75%, #a8d4e6 100%)',
  },
  {
    id: 'sonoma',
    name: 'Sonoma',
    background:
      'linear-gradient(180deg, #1a1a2e 0%, #2d1f3d 40%, #4a3068 70%, #8b5a9e 100%)',
  },
  {
    id: 'abstract',
    name: 'Abstract',
    background:
      'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(99, 102, 241, 0.45), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 70%, rgba(236, 72, 153, 0.35), transparent 50%), linear-gradient(160deg, #0c0c12 0%, #1a1a24 100%)',
  },
  {
    id: 'paper',
    name: 'Paper',
    background: 'linear-gradient(180deg, #e8e4dc 0%, #d4cfc4 50%, #c9c3b8 100%)',
  },
]
