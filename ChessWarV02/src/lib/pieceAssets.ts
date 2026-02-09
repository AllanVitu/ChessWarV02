const baseUrl = import.meta.env.BASE_URL || '/'
const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

const asset = (path: string) => `${normalizedBase}${path}`

const pieceImages: Record<string, string> = {
  P: asset('pieces/white-pawn.png'),
  R: asset('pieces/white-rook.png'),
  N: asset('pieces/white-knight.png'),
  B: asset('pieces/white-bishop.png'),
  Q: asset('pieces/white-queen.png'),
  K: asset('pieces/white-king.png'),
  p: asset('pieces/black-pawn.png'),
  r: asset('pieces/black-rook.png'),
  n: asset('pieces/black-knight.png'),
  b: asset('pieces/black-bishop.png'),
  q: asset('pieces/black-queen.png'),
  k: asset('pieces/black-king.png'),
}

export const getPieceImage = (piece: string): string => pieceImages[piece] ?? ''

export const pieceImageMap = pieceImages
