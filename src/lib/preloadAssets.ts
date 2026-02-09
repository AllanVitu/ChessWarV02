export type PreloadStage = 'initializing' | 'downloading' | 'compiling' | 'ready'

export type PreloadAsset = {
  url: string
  label?: string
  weight?: number
  optional?: boolean
  heavy?: boolean
}

export type PreloadProgress = {
  loaded: number
  total: number
  percent: number
  stage: PreloadStage
  current?: string
}

export type PreloadResult =
  | { ok: true }
  | { ok: false; error: Error; code: string; detail?: string }

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const buildError = (error: unknown, code: string, detail?: string): PreloadResult => {
  const err = error instanceof Error ? error : new Error(String(error))
  return { ok: false, error: err, code, detail }
}

export type PreloadOptions = {
  signal?: AbortSignal
  onProgress?: (progress: PreloadProgress) => void
}

export const preloadAssets = async (
  assets: PreloadAsset[],
  { signal, onProgress }: PreloadOptions = {},
): Promise<PreloadResult> => {
  const totalWeight = assets.reduce((sum, item) => sum + (item.weight ?? 1), 0) || 1
  let loadedWeight = 0

  const report = (stage: PreloadStage, current?: string, partialWeight = 0) => {
    const percent = clampPercent(((loadedWeight + partialWeight) / totalWeight) * 100)
    onProgress?.({
      loaded: Math.round(loadedWeight + partialWeight),
      total: Math.round(totalWeight),
      percent,
      stage,
      current,
    })
  }

  report('initializing')

  try {
    for (const asset of assets) {
      if (signal?.aborted) {
        return buildError(new Error('Chargement interrompu.'), 'ABORTED')
      }

      const weight = asset.weight ?? 1
      let itemProgress = 0
      report('downloading', asset.label ?? asset.url)

      const response = await fetch(asset.url, { cache: 'force-cache', signal })
      if (!response.ok) {
        if (asset.optional) {
          loadedWeight += weight
          continue
        }
        return buildError(new Error(`Asset ${response.status}: ${asset.url}`), 'ASSET_404', asset.url)
      }

      if (response.body && response.headers.has('content-length')) {
        const length = Number(response.headers.get('content-length')) || 0
        if (length > 0) {
          const reader = response.body.getReader()
          let received = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              received += value.length
              itemProgress = Math.min(received / length, 1) * weight
              report('downloading', asset.label ?? asset.url, itemProgress)
            }
          }
        } else {
          await response.arrayBuffer()
        }
      } else {
        await response.arrayBuffer()
      }

      loadedWeight += weight
      report('downloading', asset.label ?? asset.url)
    }

    report('compiling')
    await new Promise((resolve) => setTimeout(resolve, 250))
    report('ready')
    return { ok: true }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      return buildError(error, 'ABORTED')
    }
    return buildError(error, 'UNKNOWN')
  }
}
