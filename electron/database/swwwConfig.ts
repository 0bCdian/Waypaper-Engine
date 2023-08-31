import {
  ResizeType,
  FilterType,
  TransitionType,
  transitionPosition
} from '../../src/hooks/swwwConfigStore'

export const initialSwwwConfigDB = {
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
  invertY: 0 , // Same as false
  transitionBezier: '.25,.1,.25,1',
  transitionWaveX: 20,
  transitionWaveY: 20
}

export type swwwConfig = typeof initialSwwwConfigDB
