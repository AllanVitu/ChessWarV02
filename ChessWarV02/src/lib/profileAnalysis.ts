export type MetricItem = {
  label: string
  value: string
  detail: string
}

export type FocusItem = {
  label: string
  progress: number
}

export type HighlightItem = {
  title: string
  detail: string
  tag: string
}

export type RivalItem = {
  name: string
  note: string
  delta: string
}

export type TrendHighlight = {
  label: string
  value: string
  note: string
}

export type AiSignal = {
  label: string
  value: string
  note: string
}

export type ProfileAiAnalysis = {
  keyMetrics: MetricItem[]
  focusAreas: FocusItem[]
  highlights: HighlightItem[]
  alerts: HighlightItem[]
  rivals: RivalItem[]
  aiSignals: AiSignal[]
  trend: number[]
  trendHighlights: TrendHighlight[]
}

export const getProfileAiAnalysis = (): ProfileAiAnalysis => ({
  keyMetrics: [
    { label: 'Indice IA', value: '84%', detail: 'Fiabilite sur 30 jours' },
    { label: 'Precision', value: '86%', detail: '+3.1% recent' },
    { label: 'Ouvertures jouees', value: '14', detail: 'Top 3 stables' },
    { label: 'Stabilite', value: '78%', detail: 'Moins de gaffes' },
  ],
  focusAreas: [
    { label: 'Finales techniques', progress: 68 },
    { label: 'Conversions tactiques', progress: 74 },
    { label: 'Gestion du temps', progress: 52 },
    { label: "Preparation d'ouverture", progress: 61 },
  ],
  highlights: [
    { title: 'Ouvertures solides', detail: '74% sur Ruy Lopez', tag: 'Fort' },
    { title: 'Pression au centre', detail: '62% de controle', tag: 'Stable' },
    { title: 'Finales propres', detail: '1.2 gaffe / 10', tag: 'Regulier' },
  ],
  alerts: [
    { title: 'Zeitnot recurrent', detail: 'Pic sous 2 min', tag: 'A corriger' },
    { title: 'Defenses passives', detail: 'Pieces en retard', tag: 'Vigilance' },
    { title: 'Echanges precipites', detail: 'Taux 38%', tag: 'A surveiller' },
  ],
  rivals: [
    { name: 'I. Alvarez', note: 'Tactique agressive', delta: '+12' },
    { name: 'C. Russo', note: 'Jeu positionnel', delta: '+8' },
    { name: 'T. Holm', note: 'Finales solides', delta: '+5' },
  ],
  aiSignals: [
    { label: 'Style dominant', value: 'Positionnel', note: 'IA 0.81' },
    { label: 'Risque moyen', value: 'Modere', note: '0.9 gaffe / 10' },
    { label: 'Tempo', value: 'Stable', note: '+4% sur blitz' },
  ],
  trend: [32, 46, 40, 58, 52, 68, 60, 66],
  trendHighlights: [
    { label: 'Pic IA', value: '2188', note: '+46 ce mois' },
    { label: 'Meilleure ouverture', value: 'Ruy Lopez', note: '71% de score' },
    { label: 'Indice de risque', value: 'Faible', note: '0,9 gaffes' },
  ],
})

export const buildTrendPaths = (
  values: number[],
  width: number,
  height: number,
  padding: number,
): { line: string; area: string } => {
  const safeValues = values.length ? values : [0]
  const span = Math.max(1, safeValues.length - 1)
  const xStep = (width - padding * 2) / span
  const maxHeight = height - padding * 2

  const points = safeValues.map((value, index) => {
    const clamped = Math.max(0, Math.min(100, value))
    const x = padding + xStep * index
    const y = height - padding - (clamped / 100) * maxHeight
    return { x, y }
  })

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ')
  const last = points[points.length - 1] ?? { x: padding, y: height - padding }
  const area = `${line} L${last.x} ${height - padding} L${padding} ${height - padding} Z`

  return { line, area }
}
