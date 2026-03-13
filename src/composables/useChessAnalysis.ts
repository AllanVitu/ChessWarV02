import { ref, computed, watch, type Ref } from 'vue'
import {
  applyMove,
  createInitialFen,
  fenToBoard,
  formatMove,
  getTurnFromFen,
  getLegalMoves,
  type Move,
  type Side,
} from '@/lib/chessEngine'

export interface AnalysisNode {
  id: string
  parentId: string | null
  fen: string
  moveUci: string | null
  notation: string | null
  children: string[]
  ply: number
}

const ANALYSIS_ROOT_ID = 'analysis-root'

export function useChessAnalysis(
  rawMoves: Ref<Array<{ from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }>>,
) {
  const nodes = ref<Record<string, AnalysisNode>>({})
  const currentId = ref(ANALYSIS_ROOT_ID)
  const mainlinePath = ref<string[]>([ANALYSIS_ROOT_ID])
  const selectedSquare = ref<string | null>(null)
  let nodeCounter = 0

  const nextId = () => {
    nodeCounter += 1
    return `analysis-${nodeCounter}`
  }

  const rebuildTree = () => {
    nodeCounter = 0
    const root: AnalysisNode = {
      id: ANALYSIS_ROOT_ID,
      parentId: null,
      fen: createInitialFen(),
      moveUci: null,
      notation: null,
      children: [],
      ply: 0,
    }
    const tree: Record<string, AnalysisNode> = { [ANALYSIS_ROOT_ID]: root }
    const mainline: string[] = [ANALYSIS_ROOT_ID]
    let cursor = root

    for (const move of rawMoves.value) {
      const applied = applyMove(cursor.fen, move)
      if (!applied.move) break
      const id = nextId()
      const node: AnalysisNode = {
        id,
        parentId: cursor.id,
        fen: applied.fen,
        moveUci: `${applied.move.from}${applied.move.to}${applied.move.promotion ?? ''}`,
        notation: formatMove(applied.move),
        children: [],
        ply: cursor.ply + 1,
      }
      tree[id] = node
      const parentNode = tree[cursor.id]
      if (!parentNode) break
      parentNode.children = [...parentNode.children, id]
      mainline.push(id)
      cursor = node
    }

    nodes.value = tree
    mainlinePath.value = mainline
    currentId.value = mainline[mainline.length - 1] ?? ANALYSIS_ROOT_ID
    selectedSquare.value = null
  }

  const currentNode = computed<AnalysisNode>(() => {
    return (
      nodes.value[currentId.value] ?? {
        id: ANALYSIS_ROOT_ID,
        parentId: null,
        fen: createInitialFen(),
        moveUci: null,
        notation: null,
        children: [],
        ply: 0,
      }
    )
  })

  const fen = computed(() => currentNode.value.fen)
  const turn = computed<Side>(() => getTurnFromFen(fen.value))
  const board = computed(() => fenToBoard(fen.value))
  const legalMoves = computed(() => getLegalMoves(fen.value, turn.value))

  const movesFromSelected = computed(() => {
    if (!selectedSquare.value) return []
    return legalMoves.value.filter((m) => m.from === selectedSquare.value)
  })

  const targetSquares = computed(
    () => new Set(movesFromSelected.value.map((m) => m.to)),
  )

  const children = computed(() =>
    currentNode.value.children
      .map((id) => nodes.value[id])
      .filter((n): n is AnalysisNode => Boolean(n)),
  )

  const path = computed(() => {
    const result: AnalysisNode[] = []
    let node: AnalysisNode | undefined = currentNode.value
    while (node) {
      result.unshift(node)
      if (!node.parentId) break
      node = nodes.value[node.parentId]
    }
    return result
  })

  const addVariation = (move: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    const parent = currentNode.value
    const applied = applyMove(parent.fen, move)
    if (!applied.move) return null

    // Check if this move already exists as a child
    const existing = parent.children
      .map((id) => nodes.value[id])
      .find(
        (n) =>
          n &&
          n.moveUci ===
            `${applied.move!.from}${applied.move!.to}${applied.move!.promotion ?? ''}`,
      )
    if (existing) {
      currentId.value = existing.id
      selectedSquare.value = null
      return existing
    }

    const id = nextId()
    const node: AnalysisNode = {
      id,
      parentId: parent.id,
      fen: applied.fen,
      moveUci: `${applied.move.from}${applied.move.to}${applied.move.promotion ?? ''}`,
      notation: formatMove(applied.move),
      children: [],
      ply: parent.ply + 1,
    }

    const updatedParent = { ...parent, children: [...parent.children, id] }
    nodes.value = { ...nodes.value, [id]: node, [parent.id]: updatedParent }
    currentId.value = id
    selectedSquare.value = null
    return node
  }

  const goToNode = (id: string) => {
    if (nodes.value[id]) {
      currentId.value = id
      selectedSquare.value = null
    }
  }

  const goForward = () => {
    const first = currentNode.value.children[0]
    if (first) goToNode(first)
  }

  const goBack = () => {
    const parent = currentNode.value.parentId
    if (parent) goToNode(parent)
  }

  const goToStart = () => goToNode(ANALYSIS_ROOT_ID)

  const goToEnd = () => {
    const last = mainlinePath.value[mainlinePath.value.length - 1]
    if (last) goToNode(last)
  }

  return {
    rootId: ANALYSIS_ROOT_ID,
    nodes,
    currentId,
    mainlinePath,
    selectedSquare,
    currentNode,
    fen,
    turn,
    board,
    legalMoves,
    movesFromSelected,
    targetSquares,
    children,
    path,
    rebuildTree,
    addVariation,
    goToNode,
    goForward,
    goBack,
    goToStart,
    goToEnd,
  }
}
