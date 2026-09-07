import type { SimulationExpression } from '../types'

const root = '/simulation/david-lim-v1-draft'

export function useSimulationAssets() {
  function portrait(expression: SimulationExpression): string {
    return `${root}/characters/david-lim/${expression}.webp`
  }

  return {
    background: `${root}/scenes/meeting-room-day.webp`,
    avatar: `${root}/characters/david-lim/avatar.webp`,
    portrait,
  }
}
