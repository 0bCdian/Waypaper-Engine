import { create } from 'zustand'
export enum ResizeType {
  crop = 'crop',
  fit = 'fit',
  none = 'no'
}
export enum FilterType {
  Lanczos3 = 'Lanczos3',
  Bilinear = 'Bilinear',
  CatmullRom = 'CatmullRom',
  Mitchell = 'Mitchell',
  Nearest = 'Nearest'
}
export enum TransitionType {
  none = 'none',
  simple = 'simple',
  fade = 'fade',
  left = 'left',
  right = 'right',
  top = 'top',
  bottom = 'bottom',
  wipe = 'wipe',
  wave = 'wave',
  grow = 'grow',
  center = 'center',
  any = 'any',
  outer = 'outer',
  random = 'random'
}

export enum transitionPosition {
  center = 'center',
  top = 'top',
  left = 'left',
  right = 'right',
  bottom = 'bottom',
  topLeft = 'top-left',
  topRight = 'top-right',
  bottomLeft = 'bottom-left',
  bottomRight = 'bottom-right'
}

export interface SwwwFormData {
  resizeType: ResizeType
  fillColor: string
  filterType: FilterType
  transitionType: TransitionType
  transitionStep: number
  transitionDuration: number
  transitionFPS: number
  transitionAngle: number
  transitionPositionType: 'alias' | 'int' | 'float'
  transitionPosition: transitionPosition
  transitionPositionIntX: number
  transitionPositionIntY: number
  transitionPositionFloatX: number
  transitionPositionFloatY: number
  invertY: number
  transitionBezier: `${number},${number},${number},${number}`
  transitionWaveX: number
  transitionWaveY: number
}
const initialSwwwConfig: SwwwFormData = {
  resizeType: ResizeType.crop,
  fillColor: '#000000',
  filterType: FilterType.Lanczos3,
  transitionType: TransitionType.simple,
  transitionStep: 90,
  transitionDuration: 3,
  transitionFPS: 60,
  transitionAngle: 45,
  transitionPositionType: 'alias',
  transitionPosition: transitionPosition.center,
  transitionPositionIntX: 960,
  transitionPositionIntY: 540,
  transitionPositionFloatX: 0.5,
  transitionPositionFloatY: 0.5,
  invertY: 0,
  transitionBezier: '.25,.1,.25,1',
  transitionWaveX: 20,
  transitionWaveY: 20
}

interface State {
  swwwConfig: SwwwFormData
}

interface Actions {
  saveConfig: (data: SwwwFormData) => void
  getConfig: () => SwwwFormData
}
export const swwwConfigStore = create<State & Actions>()((set, get) => ({
  swwwConfig: initialSwwwConfig,
  saveConfig: (data: SwwwFormData) => {
    set((state) => {
      return {
        ...state,
        swwwConfig: data
      }
    })
    const { updateSwwwConfig } = window.API_RENDERER
    const newState = get().swwwConfig
    updateSwwwConfig(newState)
  },
  getConfig: () => {
    return get().swwwConfig
  }
}))
