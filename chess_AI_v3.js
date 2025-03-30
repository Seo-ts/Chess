// 전역 변수 추가: AI의 현재 색상과 이전 게임에서 흑을 잡았는지 여부
let aiColor = 'black'; // AI의 현재 게임 색상 (기본값: 흑)
let aiPlayedBlackLastGame = true; // AI가 마지막 게임에서 흑을 잡았는지 여부

const board = document.getElementById('chessboard');
const resetButton = document.getElementById('reset');
const whiteCapturedStorage = document.getElementById('whiteCapturedPieces');
const blackCapturedStorage = document.getElementById('blackCapturedPieces');
const statusDisplay = document.getElementById('status');

let selectedCell = null;
let selectedStorageCell = null;
let currentTurn = 'white'; // 항상 백이 먼저 시작
let gameOver = false;
let moveHistory = [];
let highlightedCells = [];
let internalBoardState = Array(8).fill().map(() => Array(8).fill(null));
// let lastFirstTurn = 'white'; // 이 변수는 더 이상 필요 없음

const pieces = {
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
};

const pieceValues = {
    'P': 1, 'p': 1,
    'N': 3, 'n': 3,
    'B': 3, 'b': 3,
    'R': 5, 'r': 5,
    'Q': 9, 'q': 9,
    'K': 0, 'k': 0 // 킹의 점수는 일반적으로 0 또는 매우 높게 설정 (잡히면 게임 끝)
};

// 기물 위치 가중치 (중앙을 선호, 단순화된 예시)
const pawnPositionValues = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
    [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0], // 중앙 선호도 약간 추가
    [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0],
    [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], // 전진 보너스
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
];
// 다른 기물 위치 가중치 추가 가능...

// 체스판 생성
const createBoard = () => {
    board.innerHTML = "";
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(cell));
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#779556' : '#ebecd0';
            board.appendChild(cell);
        }
    }
};

// 보관소 셀 생성
const createStorageCells = (storageElement) => {
    storageElement.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.classList.add('storage-cell');
        cell.dataset.index = i;
        cell.addEventListener('click', () => handleStorageCellClick(cell));
        storageElement.appendChild(cell);
    }
};

//기물 생성 (유니코드 문자 사용)
const createPiece = (char) => {
    const span = document.createElement('span');
    span.textContent = pieces[char];
    span.dataset.piece = char;
    span.classList.add('piece');
    span.style.fontSize = '40px'; // 기물 크기
    span.style.lineHeight = '60px'; // 셀 중앙 정렬
    return span;
};

// 초기 기물 배치
const initPieces = () => {
    const setup = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [], [], [], [],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.innerHTML = ''); // Clear existing pieces first

    setup.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            if (piece) {
                const cellIndex = rowIndex * 8 + colIndex;
                 if (cellIndex < cells.length) {
                    cells[cellIndex].appendChild(createPiece(piece));
                 }
            }
        });
    });
};

// 보관소 초기화
const initStorageAreas = () => {
    createStorageCells(whiteCapturedStorage);
    createStorageCells(blackCapturedStorage);
};

// 체스판 상태를 배열로 변환
const getBoardState = () => {
    const state = Array(8).fill().map(() => Array(8).fill(null));
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (cell.firstChild) {
            state[row][col] = cell.firstChild.dataset.piece;
        }
    });
    return state;
};

// 특정 위치의 셀 가져오기
const getCell = (row, col) => {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
};

// 특정 위치의 기물 확인
const getPieceAt = (row, col, boardState = null) => {
    boardState = boardState || internalBoardState; // Use internal state by default
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return boardState[row][col];
};


// 기물별 이동 가능 위치 계산 (캐슬링과 앙파상 수정)
const getValidMoves = (piece, row, col, boardState = null, skipCastlingCheck = false) => {
    const moves = [];
    const isWhite = piece === piece.toUpperCase();
    boardState = boardState || internalBoardState; // Use internal state if none provided

    switch (piece.toUpperCase()) {
        case 'P': // 폰
            const direction = isWhite ? -1 : 1;
            const startRow = isWhite ? 6 : 1;
            const promotionRow = isWhite ? 0 : 7;

            // 1칸 전진
            if (row + direction >= 0 && row + direction <= 7 && getPieceAt(row + direction, col, boardState) === null) {
                moves.push([row + direction, col]);
                // 2칸 전진 (시작 위치에서만)
                if (row === startRow && getPieceAt(row + 2 * direction, col, boardState) === null) {
                    moves.push([row + 2 * direction, col]);
                }
            }
            // 대각선 공격
            if (col > 0 && getPieceAt(row + direction, col - 1, boardState) &&
                (isWhite !== (getPieceAt(row + direction, col - 1, boardState) === getPieceAt(row + direction, col - 1, boardState).toUpperCase()))) {
                moves.push([row + direction, col - 1]);
            }
            if (col < 7 && getPieceAt(row + direction, col + 1, boardState) &&
                (isWhite !== (getPieceAt(row + direction, col + 1, boardState) === getPieceAt(row + direction, col + 1, boardState).toUpperCase()))) {
                moves.push([row + direction, col + 1]);
            }
            // 앙파상
            const enPassantRow = isWhite ? 3 : 4;
            if (row === enPassantRow && moveHistory.length > 0) {
                const lastMove = moveHistory[moveHistory.length - 1];
                // lastMove.from/to might be DOM elements or objects depending on history implementation. Ensure we get row/col data.
                const lastFromRow = parseInt(lastMove.from.dataset?.row ?? lastMove.from.row); // Adapt based on history structure
                const lastFromCol = parseInt(lastMove.from.dataset?.col ?? lastMove.from.col);
                const lastToRow = parseInt(lastMove.to.dataset?.row ?? lastMove.to.row);
                const lastToCol = parseInt(lastMove.to.dataset?.col ?? lastMove.to.col);
                const lastPiece = lastMove.pieceMoved ?? lastMove.piece ?? (lastMove.to.firstChild ? lastMove.to.firstChild.dataset.piece : null); // Adapt based on history structure

                if (lastPiece && lastPiece.toUpperCase() === 'P' && Math.abs(lastFromRow - lastToRow) === 2 && lastToRow === row && Math.abs(lastToCol - col) === 1) {
                    moves.push([row + direction, lastToCol, 'enPassant']);
                }
            }
            break;

        case 'R': // 루크
            for (let dir of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                let newRow = row, newCol = col;
                while (true) {
                    newRow += dir[0];
                    newCol += dir[1];
                    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                    const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                    if (pieceAtPos) {
                        if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) { // 다른 색 기물
                            moves.push([newRow, newCol]);
                        }
                        break; // 같은 색 또는 다른 색 기물 만나면 멈춤
                    }
                    moves.push([newRow, newCol]); // 빈 칸
                }
            }
            break;

        case 'N': // 나이트
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (let [dr, dc] of knightMoves) {
                const newRow = row + dr, newCol = col + dc;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
                const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) { // 비어있거나 다른 색 기물
                    moves.push([newRow, newCol]);
                }
            }
            break;

        case 'B': // 비숍
             for (let dir of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                let newRow = row, newCol = col;
                while (true) {
                    newRow += dir[0];
                    newCol += dir[1];
                    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                    const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                    if (pieceAtPos) {
                        if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) {
                            moves.push([newRow, newCol]);
                        }
                        break;
                    }
                    moves.push([newRow, newCol]);
                }
            }
            break;

        case 'Q': // 퀸
            for (let dir of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                let newRow = row, newCol = col;
                while (true) {
                    newRow += dir[0];
                    newCol += dir[1];
                    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                    const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                    if (pieceAtPos) {
                        if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) {
                            moves.push([newRow, newCol]);
                        }
                        break;
                    }
                    moves.push([newRow, newCol]);
                }
            }
            break;

        case 'K': // 킹
            const kingMoves = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (let [dr, dc] of kingMoves) {
                const newRow = row + dr, newCol = col + dc;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
                const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                 // 이동하려는 칸이 공격받는지 여부는 isMoveValid에서 체크
                if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) {
                    moves.push([newRow, newCol]);
                }
            }
             // 캐슬링 (재귀 방지 및 isSquareAttacked 사용 단순화)
            // 캐슬링 (skipCastlingCheck 플래그는 isSquareAttacked 재귀 호출 방지용으로 유지)
            if (!skipCastlingCheck) {
                const kingStartRow = isWhite ? 7 : 0;
                // 조건 0: 킹이 시작 위치에 있어야 함
                if (row === kingStartRow && col === 4) {
                    // 조건 1: 현재 체크 상태가 아니어야 함 (가장 먼저 확인!)
                    if (!isInCheck(isWhite ? 'white' : 'black', boardState)) {
                        // 킹/룩 이동 여부 체크 (기존 로직 유지)
                        const kingMoved = moveHistory.some(m => (m.pieceMoved ?? m.piece)?.toUpperCase() === 'K' && m.from.row === kingStartRow && m.from.col === 4);

                        if (!kingMoved) {
                            // 킹사이드 캐슬링 (h파일 룩)
                            const rookKingSideCol = 7;
                            const rookKingSideMoved = moveHistory.some(m => (m.pieceMoved ?? m.piece)?.toUpperCase() === 'R' && m.from.row === kingStartRow && m.from.col === rookKingSideCol);
                            // 조건: 해당 위치에 룩이 있고, 룩이 움직인 적 없어야 함
                            if (getPieceAt(kingStartRow, rookKingSideCol, boardState)?.toUpperCase() === 'R' && !rookKingSideMoved) {
                                // 조건: 경로가 비어있어야 함 (f, g 파일)
                                if (getPieceAt(kingStartRow, 5, boardState) === null && getPieceAt(kingStartRow, 6, boardState) === null) {
                                    // 조건: 킹이 통과하는 칸(f파일)과 도착하는 칸(g파일)이 공격받지 않아야 함
                                    // (시작 칸(e파일)은 이미 위에서 체크 상태 아님을 확인)
                                    if (!isSquareAttacked(kingStartRow, 5, isWhite ? 'white' : 'black', boardState) &&
                                        !isSquareAttacked(kingStartRow, 6, isWhite ? 'white' : 'black', boardState)) {
                                        moves.push([kingStartRow, 6, 'castling']); // 캐슬링 이동 제안
                                    }
                                }
                            }

                            // 퀸사이드 캐슬링 (a파일 룩)
                            const rookQueenSideCol = 0;
                            const rookQueenSideMoved = moveHistory.some(m => (m.pieceMoved ?? m.piece)?.toUpperCase() === 'R' && m.from.row === kingStartRow && m.from.col === rookQueenSideCol);
                            // 조건: 해당 위치에 룩이 있고, 룩이 움직인 적 없어야 함
                            if (getPieceAt(kingStartRow, rookQueenSideCol, boardState)?.toUpperCase() === 'R' && !rookQueenSideMoved) {
                                // 조건: 경로가 비어있어야 함 (b, c, d 파일)
                                if (getPieceAt(kingStartRow, 1, boardState) === null && getPieceAt(kingStartRow, 2, boardState) === null && getPieceAt(kingStartRow, 3, boardState) === null) {
                                    // 조건: 킹이 통과하는 칸(c, d파일)과 도착하는 칸(c파일)이 공격받지 않아야 함
                                    // (시작 칸(e파일)은 이미 위에서 체크 상태 아님을 확인)
                                    if (!isSquareAttacked(kingStartRow, 2, isWhite ? 'white' : 'black', boardState) &&
                                        !isSquareAttacked(kingStartRow, 3, isWhite ? 'white' : 'black', boardState)) {
                                        // 참고: 킹이 최종 도착하는 c파일(2열)이 공격받는지는 isSquareAttacked에서 확인됨.
                                        moves.push([kingStartRow, 2, 'castling']); // 캐슬링 이동 제안
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break; // 킹 케이스 종료
    }

    // Filter out moves that leave the king in check
    const validFilteredMoves = [];
    for (const move of moves) {
         const [toRow, toCol] = move;
         if (isMoveValid(row, col, toRow, toCol, piece, isWhite ? 'white' : 'black', boardState, move[2])) {
              validFilteredMoves.push(move);
         }
     }
     // console.log(`Piece ${piece} at ${row},${col} has moves:`, moves, `Valid moves:`, validFilteredMoves);


    // Return the original moves list for highlighting, but validation happens later
    // Correction: Return the filtered valid moves for AI, but maybe original for highlight? Let's return original for now and filter in highlight/move.
    // Re-correction: It's better to return only valid moves from this function for consistency, especially for AI.
     return validFilteredMoves; // Return only legally valid moves
};

// 초기화 시 internalBoardState 설정
const initInternalBoardState = () => {
    const setup = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        Array(8).fill(null), Array(8).fill(null), Array(8).fill(null), Array(8).fill(null), // Empty rows
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
     // Deep copy setup to internalBoardState
    internalBoardState = setup.map(row => [...row]);
};

// 이동 시 internalBoardState 업데이트 (캐슬링, 앙파상 포함)
const updateInternalBoardState = (fromRow, fromCol, toRow, toCol, piece, specialMove = null) => {
    internalBoardState[toRow][toCol] = piece;
    internalBoardState[fromRow][fromCol] = null;

    if (specialMove === 'enPassant') {
        const capturedPawnRow = fromRow; // 앙파상으로 잡힌 폰은 이동한 폰과 같은 행에 있음
        const capturedPawnCol = toCol;
        internalBoardState[capturedPawnRow][capturedPawnCol] = null;
    } else if (specialMove === 'castling') {
        const rookFromCol = toCol === 6 ? 7 : 0; // 킹사이드면 7, 퀸사이드면 0
        const rookToCol = toCol === 6 ? 5 : 3;   // 킹사이드면 5, 퀸사이드면 3
        const rookPiece = internalBoardState[fromRow][rookFromCol];
        internalBoardState[fromRow][rookToCol] = rookPiece;
        internalBoardState[fromRow][rookFromCol] = null;
    }
     // Check promotion after move for internal state
     checkPromotionInternal(toRow, toCol, piece);
};

// 내부 상태 폰 승급 처리 (AI용, 자동 퀸 승급)
const checkPromotionInternal = (row, col, piece) => {
    if (!piece) return;
    const isWhite = piece === piece.toUpperCase();
    const promotionRow = isWhite ? 0 : 7;
    if (piece.toUpperCase() === 'P' && row === promotionRow) {
        internalBoardState[row][col] = isWhite ? 'Q' : 'q'; // AI는 자동으로 퀸으로 승급
    }
};

const transpositionTable = new Map();

// Zobrist Hashing (simple example, can be improved)
const zobristKeys = Array(8).fill().map(() =>
    Array(8).fill().map(() =>
        // 12 piece types (P, R, N, B, Q, K, p, r, n, b, q, k)
        Array(12).fill().map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    )
);
// Add keys for turn, castling rights, en passant target square if needed for more accuracy

const pieceToIndex = (piece) => {
    const piecesList = ['P', 'R', 'N', 'B', 'Q', 'K', 'p', 'r', 'n', 'b', 'q', 'k'];
    return piecesList.indexOf(piece);
};

const computeZobristHash = (boardState) => {
    let hash = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const index = pieceToIndex(piece);
                if (index !== -1) { // Ensure piece is valid
                    hash ^= zobristKeys[row][col][index];
                }
            }
        }
    }
    // Add hash ^= turnKey if currentTurn === 'white' etc.
    return hash;
};


const killerMoves = Array(10).fill().map(() => []); // 최대 깊이 10
const historyTable = {}; // [piece][to_sq] -> score

// 이동 우선순위 계산 (간단화된 버전)
const getMovePriority = (move, boardState, depth) => {
    let priority = 0;
    const targetPiece = boardState[move.to[0]][move.to[1]];

    // MVV-LVA (Most Valuable Victim - Least Valuable Aggressor)
    if (targetPiece) {
        priority += 10 * pieceValues[targetPiece] - pieceValues[move.piece];
    }

    // Killer Moves
    if (killerMoves[depth]?.some(m => m.from[0] === move.from[0] && m.from[1] === move.from[1] && m.to[0] === move.to[0] && m.to[1] === move.to[1])) {
        priority += 50;
    }

    // History Heuristic (simple version)
    const historyKey = `${move.piece}_${move.to[0]}_${move.to[1]}`;
     priority += historyTable[historyKey] || 0;

     // Promotion boost
     if (move.piece.toUpperCase() === 'P') {
         const promotionRow = (move.piece === 'P') ? 0 : 7;
         if (move.to[0] === promotionRow) {
             priority += pieceValues['Q'] * 10; // Prioritize promotion to queen
         }
     }


    return priority;
};

// 이동 정렬
const sortMoves = (moves, boardState, depth) => {
    // Calculate priorities first
    const movesWithPriority = moves.map(move => ({
        move,
        priority: getMovePriority(move, boardState, depth)
    }));

    // Sort in descending order of priority
    movesWithPriority.sort((a, b) => b.priority - a.priority);

    // Return just the moves in sorted order
    return movesWithPriority.map(item => item.move);
};

// 가능한 모든 이동 생성 (특정 색상)
const getPossibleMoves = (boardState, color) => {
    const moves = [];
    const isWhiteTurn = color === 'white';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((isWhiteTurn && piece === piece.toUpperCase()) ||
                          (!isWhiteTurn && piece === piece.toLowerCase()))) {
                // Get moves *without* self-check validation here, validation happens in getLegalMoves or isMoveValid
                 const potentialMoves = getValidMoves_Raw(piece, row, col, boardState); // Use a version that doesn't filter based on check
                potentialMoves.forEach(move => {
                    // Add piece info to the move object
                    moves.push({ from: [row, col], to: move, piece: piece });
                });
            }
        }
    }
    return moves;
};


// Raw move generation without check validation (for isSquareAttacked)
const getValidMoves_Raw = (piece, row, col, boardState) => {
     const moves = [];
    const isWhite = piece === piece.toUpperCase();

     switch (piece.toUpperCase()) {
         case 'P':
             const direction = isWhite ? -1 : 1;
             const startRow = isWhite ? 6 : 1;
              // 1칸 전진 (보드 범위 체크 필수)
              if (row + direction >= 0 && row + direction < 8 && getPieceAt(row + direction, col, boardState) === null) {
                 moves.push([row + direction, col]);
                 // 2칸 전진
                 if (row === startRow && getPieceAt(row + 2 * direction, col, boardState) === null) {
                     moves.push([row + 2 * direction, col]);
                 }
             }
              // 대각선 공격 (보드 범위 체크 필수)
              if (col > 0 && row + direction >=0 && row+direction < 8) {
                  const targetPiece = getPieceAt(row + direction, col - 1, boardState);
                  if(targetPiece && (isWhite !== (targetPiece === targetPiece.toUpperCase()))) {
                      moves.push([row + direction, col - 1]);
                  }
              }
               if (col < 7 && row + direction >=0 && row+direction < 8) {
                    const targetPiece = getPieceAt(row + direction, col + 1, boardState);
                   if(targetPiece && (isWhite !== (targetPiece === targetPiece.toUpperCase()))) {
                       moves.push([row + direction, col + 1]);
                   }
               }
                // 앙파상 (로직은 getValidMoves와 동일하게 유지 가능)
                 const enPassantRow = isWhite ? 3 : 4;
                 if (row === enPassantRow && moveHistory.length > 0) {
                     const lastMove = moveHistory[moveHistory.length - 1];
                     const lastFromRow = parseInt(lastMove.from.dataset?.row ?? lastMove.from.row);
                     const lastFromCol = parseInt(lastMove.from.dataset?.col ?? lastMove.from.col);
                     const lastToRow = parseInt(lastMove.to.dataset?.row ?? lastMove.to.row);
                     const lastToCol = parseInt(lastMove.to.dataset?.col ?? lastMove.to.col);
                     const lastPiece = lastMove.pieceMoved ?? lastMove.piece ?? (lastMove.to.firstChild ? lastMove.to.firstChild.dataset.piece : null);

                      if (lastPiece && lastPiece.toUpperCase() === 'P' && Math.abs(lastFromRow - lastToRow) === 2 && lastToRow === row && Math.abs(lastToCol - col) === 1) {
                         // Check if landing square is valid
                          if (row + direction >= 0 && row + direction < 8 && lastToCol >= 0 && lastToCol < 8) {
                             moves.push([row + direction, lastToCol, 'enPassant']);
                         }
                     }
                 }
             break;
          case 'R':
             for (let dir of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                 let newRow = row, newCol = col;
                 while (true) {
                     newRow += dir[0];
                     newCol += dir[1];
                     if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                     const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                     if (pieceAtPos) {
                         if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) { moves.push([newRow, newCol]); }
                         break;
                     }
                     moves.push([newRow, newCol]);
                 }
             }
             break;
         case 'N':
             const knightMoves = [ [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1] ];
             for (let [dr, dc] of knightMoves) {
                 const newRow = row + dr, newCol = col + dc;
                 if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
                 const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                 if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) { moves.push([newRow, newCol]); }
             }
             break;
         case 'B':
              for (let dir of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                 let newRow = row, newCol = col;
                 while (true) {
                     newRow += dir[0];
                     newCol += dir[1];
                     if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                     const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                     if (pieceAtPos) {
                         if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) { moves.push([newRow, newCol]); }
                         break;
                     }
                     moves.push([newRow, newCol]);
                 }
             }
             break;
         case 'Q':
             for (let dir of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                 let newRow = row, newCol = col;
                 while (true) {
                     newRow += dir[0];
                     newCol += dir[1];
                     if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                     const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                     if (pieceAtPos) {
                         if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) { moves.push([newRow, newCol]); }
                         break;
                     }
                     moves.push([newRow, newCol]);
                 }
             }
             break;
         case 'K':
             const kingMoves = [ [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1] ];
             for (let [dr, dc] of kingMoves) {
                 const newRow = row + dr, newCol = col + dc;
                 if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
                 const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                 if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) { moves.push([newRow, newCol]); }
             }
              // Castling moves (raw, check validation happens later if needed)
             const kingStartRow = isWhite ? 7 : 0;
             if (row === kingStartRow && col === 4) {
                 // King side
                 if (getPieceAt(row, 5, boardState) === null && getPieceAt(row, 6, boardState) === null && getPieceAt(row, 7, boardState)?.toUpperCase() === 'R') {
                     moves.push([row, 6, 'castling']);
                 }
                 // Queen side
                 if (getPieceAt(row, 1, boardState) === null && getPieceAt(row, 2, boardState) === null && getPieceAt(row, 3, boardState) === null && getPieceAt(row, 0, boardState)?.toUpperCase() === 'R') {
                     moves.push([row, 2, 'castling']);
                 }
             }
             break;
     }
     return moves;
 }


// 특정 칸이 공격받는지 확인
const isSquareAttacked = (row, col, attackedByColor, boardState) => {
    const opponentColor = attackedByColor === 'white' ? 'black' : 'white';
    // Get raw moves for the opponent
    const opponentMoves = getPossibleMoves(boardState, opponentColor); // Fetches moves {from, to, piece}

    for (const move of opponentMoves) {
        const [toRow, toCol] = move.to; // Extract target square from the move object
         // Check if the target square matches the square we're interested in
         if (toRow === row && toCol === col) {
            // Special check for pawns: diagonal move IS an attack, straight move IS NOT.
            if (move.piece.toUpperCase() === 'P') {
                const fromCol = move.from[1];
                 if (fromCol !== toCol) { // Pawn attack is diagonal
                     // console.log(`Square ${row},${col} attacked by ${opponentColor} pawn from ${move.from[0]},${fromCol}`);
                    return true;
                }
            } else {
                 // console.log(`Square ${row},${col} attacked by ${opponentColor} ${move.piece} from ${move.from[0]},${move.from[1]}`);
                return true; // Any other piece landing on the square is an attack
            }
        }
    }
    // console.log(`Square ${row},${col} is NOT attacked by ${opponentColor}`);
    return false;
};

// 킹의 위치 찾기
const findKing = (color, boardState) => {
    const kingPiece = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (boardState[row][col] === kingPiece) {
                return [row, col];
            }
        }
    }
    return null; // Should not happen in a normal game
};

// 체크 상태 확인
const isInCheck = (color, boardState) => {
    const kingPos = findKing(color, boardState);
    if (!kingPos) return false; // King not on board
    const [kingRow, kingCol] = kingPos;
    // Check if the king's square is attacked by the opponent
    return isSquareAttacked(kingRow, kingCol, color, boardState);
};


// 특정 이동이 유효한지 확인 (자신의 킹을 체크 상태로 만들지 않는지)
const isMoveValid = (fromRow, fromCol, toRow, toCol, piece, color, boardState, specialMove = null) => {
    if (!piece) return false; // Should not happen if called correctly

    // 1. Simulate the move in a temporary board state
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[toRow][toCol] = piece;
    tempBoard[fromRow][fromCol] = null;

     // Handle simulation for special moves
     if (specialMove === 'enPassant') {
         const capturedPawnRow = fromRow;
         const capturedPawnCol = toCol;
         tempBoard[capturedPawnRow][capturedPawnCol] = null;
     } else if (specialMove === 'castling') {
         const rookFromCol = toCol === 6 ? 7 : 0;
         const rookToCol = toCol === 6 ? 5 : 3;
         const rookPiece = tempBoard[fromRow][rookFromCol]; // Use tempBoard
         if (rookPiece) { // Ensure rook exists before moving
             tempBoard[fromRow][rookToCol] = rookPiece;
             tempBoard[fromRow][rookFromCol] = null;
         } else {
             // This castling move is invalid if rook isn't there - should be caught earlier ideally
             // console.warn(`Castling invalid: Rook not found at ${fromRow}, ${rookFromCol}`);
              return false;
          }
     }


    // 2. Check if the king of the moving player ('color') is in check *after* the move
    const isKingInCheckAfterMove = isInCheck(color, tempBoard);

    // console.log(`Checking move validity: ${piece} ${fromRow},${fromCol} -> ${toRow},${toCol}. King in check after move: ${isKingInCheckAfterMove}`);


    // The move is valid if the king is NOT in check after the move
    return !isKingInCheckAfterMove;
};


// 가능한 모든 합법적인 이동 생성
const getLegalMoves = (boardState, color) => {
    const possibleMoves = getPossibleMoves(boardState, color); // Gets {from, to, piece} objects
    const legalMoves = [];

    for (const move of possibleMoves) {
        const { from, to, piece } = move;
        const [fromRow, fromCol] = from;
        const [toRow, toCol, special] = to; // 'to' array might include special flag

         // Check if the move puts the own king in check
         if (isMoveValid(fromRow, fromCol, toRow, toCol, piece, color, boardState, special)) {
              // Add castling specific checks here if not already covered by isSquareAttacked in getValidMoves
              if (special === 'castling') {
                  // King must not be in check currently (checked in getValidMoves)
                  // Squares king passes over must not be attacked (checked in getValidMoves)
                  // King and Rook must not have moved (checked in getValidMoves)
                  // Path must be clear (checked in getValidMoves)
                  // Destination square must not be attacked (This is covered by the general isMoveValid check!)
                  legalMoves.push(move);
              } else {
                 legalMoves.push(move);
             }
         }
    }
    // console.log(`Legal moves for ${color}:`, legalMoves);
    return legalMoves;
};


// 가능한 이동 표시
const highlightValidMoves = (piece, row, col) => {
    clearHighlightedMoves();
    const boardState = internalBoardState; // Use internal state
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    // Get moves that are generally valid for the piece type
    const moves = getValidMoves(piece, row, col, boardState); // This now returns only legal moves

    moves.forEach(([r, c, special]) => {
        // No need to call isMoveValid again, as getValidMoves should return pre-filtered moves
        const cell = getCell(r, c);
        if (cell) {
            cell.classList.add('highlight');
            highlightedCells.push(cell);
        }
    });
};

// 이동 표시 초기화
const clearHighlightedMoves = () => {
    highlightedCells.forEach(cell => cell.classList.remove('highlight'));
    highlightedCells = [];
};

// 클릭 핸들러 (체스판 셀)
const handleCellClick = (cell) => {
    if (gameOver || currentTurn === aiColor) return; // 플레이어 턴이 아니면 무시

    if (selectedStorageCell) {
         // Logic for placing captured piece (currently disabled/not standard chess)
         clearStorageSelection();
        return;
    }

    const targetPieceElement = cell.firstChild;
    const targetPiece = targetPieceElement ? targetPieceElement.dataset.piece : null;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    if (selectedCell) {
        const fromRow = parseInt(selectedCell.dataset.row);
        const fromCol = parseInt(selectedCell.dataset.col);
        const pieceElement = selectedCell.firstChild;
        const piece = pieceElement ? pieceElement.dataset.piece : null;

        if (!piece) {
            console.error('handleCellClick: No piece in selectedCell');
            clearSelection();
            clearHighlightedMoves();
            return;
        }

        const color = piece === piece.toUpperCase() ? 'white' : 'black';
        if (color !== currentTurn) { // Should not happen if selection logic is correct
             clearSelection();
             clearHighlightedMoves();
             return;
         }

        // Find the target move among highlighted (legal) moves
        const targetMove = highlightedCells.find(highlightedCell =>
            parseInt(highlightedCell.dataset.row) === row && parseInt(highlightedCell.dataset.col) === col
        );


         if (targetMove) { // targetMove is the cell div itself
            // Need the special flag if any - re-fetch from getValidMoves? No, check highlight source.
            // Let's re-calculate the specific move details for safety
            const allValidMoves = getValidMoves(piece, fromRow, fromCol, internalBoardState);
            const specificMove = allValidMoves.find(([r, c, _]) => r === row && c === col);

             if (specificMove) {
                 movePiece(cell, specificMove[2]); // Pass the special flag ('enPassant' or 'castling')
             } else {
                  // This case means a highlighted cell was clicked, but it's not a valid move re-calculated? Should not happen.
                  console.warn("Clicked highlighted cell is not a valid move on re-check.");
                  clearSelection();
                  clearHighlightedMoves();
             }

        } else if (cell === selectedCell) {
            // Clicked the same selected cell again - deselect
            clearSelection();
            clearHighlightedMoves();
        } else {
             // Clicked an invalid square or own piece
             const clickedPiece = getPieceAt(row, col, internalBoardState);
             if (clickedPiece && (clickedPiece === clickedPiece.toUpperCase()) === (piece === piece.toUpperCase())) {
                 // Clicked another piece of the same color - switch selection
                 clearSelection();
                 clearHighlightedMoves();
                 selectPiece(cell);
                 highlightValidMoves(clickedPiece, row, col);
             } else {
                 // Clicked an empty invalid square or opponent piece without it being a valid move
                 clearSelection();
                 clearHighlightedMoves();
             }
         }

    } else if (targetPiece) {
         const pieceColor = targetPiece === targetPiece.toUpperCase() ? 'white' : 'black';
         // Select piece only if it's the current player's turn and the piece matches the turn color
         if (pieceColor === currentTurn) {
            selectPiece(cell);
            highlightValidMoves(targetPiece, row, col);
        }
    }
};

// 클릭 핸들러 (보관소 셀 - Not used in standard chess, keep minimal)
const handleStorageCellClick = (cell) => {
    if (gameOver) return;
     console.log("Storage click - not implemented for standard chess rules.");
     clearStorageSelection(); // Just clear any selection
    // if (selectedStorageCell === cell) {
    //     clearStorageSelection();
    //     return;
    // }
    // if (selectedStorageCell) {
    //     clearStorageSelection();
    // }
    // if (cell.firstChild) {
    //     // selectStorageCell(cell);
    // }
};

// 기물 선택 (체스판)
const selectPiece = (cell) => {
    selectedCell?.classList.remove('selected'); // Deselect previous
    selectedCell = cell;
    cell.classList.add('selected');
};

// 기물 선택 (보관소)
const selectStorageCell = (cell) => {
     selectedStorageCell?.classList.remove('selected');
    selectedStorageCell = cell;
    cell.classList.add('selected');
};


// 기물 이동 (DOM 업데이트 및 내부 상태 업데이트 호출)
const movePiece = (targetCell, specialMove = null) => {
    if (!selectedCell || selectedCell === targetCell || !selectedCell.firstChild) {
        clearSelection();
        clearHighlightedMoves();
        return;
    }

    const fromRow = parseInt(selectedCell.dataset.row);
    const fromCol = parseInt(selectedCell.dataset.col);
    const toRow = parseInt(targetCell.dataset.row);
    const toCol = parseInt(targetCell.dataset.col);

    const pieceElement = selectedCell.firstChild;
    const piece = pieceElement.dataset.piece;
    let capturedPieceElement = targetCell.firstChild;
    let capturedPiece = capturedPieceElement ? capturedPieceElement.dataset.piece : null;
    let capturedOnSquare = [toRow, toCol]; // Default capture square

     // --- Capture Logic ---
     if (specialMove === 'enPassant') {
         const capturedPawnRow = fromRow; // En passant captures pawn on the 'from' row
         const capturedPawnCol = toCol;
         const capturedPawnCell = getCell(capturedPawnRow, capturedPawnCol);
         if (capturedPawnCell && capturedPawnCell.firstChild) {
             capturedPieceElement = capturedPawnCell.firstChild;
             capturedPiece = capturedPieceElement.dataset.piece;
             capturedOnSquare = [capturedPawnRow, capturedPawnCol]; // Update where capture happened
              // Add captured piece to storage
             addPieceToStorage(capturedPieceElement);
             capturedPawnCell.innerHTML = ''; // Remove from board visually
         } else {
             console.error("En passant error: Cannot find pawn to capture.");
             // Potentially revert or handle error state
         }
     } else if (capturedPieceElement) {
         // Normal capture
         addPieceToStorage(capturedPieceElement);
         targetCell.innerHTML = ''; // Clear target cell before moving piece
     }

     // --- Move Piece Logic ---
     targetCell.appendChild(pieceElement); // Move piece visually

     // --- Handle Castling Rook Move Visually ---
     if (specialMove === 'castling') {
         const rookFromCol = toCol === 6 ? 7 : 0;
         const rookToCol = toCol === 6 ? 5 : 3;
         const rookCell = getCell(fromRow, rookFromCol);
         const rookTargetCell = getCell(toRow, rookToCol);
         if (rookCell && rookCell.firstChild && rookTargetCell) {
             rookTargetCell.appendChild(rookCell.firstChild);
         } else {
              console.error("Castling error: Cannot move rook visually.");
              // Potentially revert or handle error state
          }
     }

    // --- Update Internal State ---
    updateInternalBoardState(fromRow, fromCol, toRow, toCol, piece, specialMove);

    // --- Record Move ---
     // Store enough info to potentially undo or analyze
     moveHistory.push({
         from: { row: fromRow, col: fromCol },
         to: { row: toRow, col: toCol },
         pieceMoved: piece,
         capturedPiece: capturedPiece, // Can be null
         specialMove: specialMove, // Can be null, 'enPassant', 'castling'
         // boardStateBefore: boardStateBefore // Optional: for undo
     });


    // --- Post-Move Actions ---
    clearSelection();
    clearHighlightedMoves();
    checkPromotion(targetCell); // Check for pawn promotion visually

     // If promotion happens, it will handle the turn switch after selection.
     // Otherwise, switch turn here.
     if (!isPromotionPending(targetCell)) {
         switchTurn();
     }
};

// Helper to add captured piece to the correct storage
const addPieceToStorage = (pieceElement) => {
    if (!pieceElement) return;
    const piece = pieceElement.dataset.piece;
    const isWhite = piece === piece.toUpperCase();
    const storage = isWhite ? whiteCapturedStorage : blackCapturedStorage;
    const emptyStorageCell = Array.from(storage.querySelectorAll('.storage-cell')).find(cell => !cell.firstChild);
    if (emptyStorageCell) {
        emptyStorageCell.appendChild(pieceElement); // Move the element
    } else {
        console.warn("No empty storage cell found for captured piece:", piece);
        // Piece is effectively removed from the game if storage is full
    }
};


// Check if promotion is happening (for turn switching logic)
const isPromotionPending = (cell) => {
     const pieceElement = cell.firstChild;
     if (!pieceElement) return false;
     const piece = pieceElement.dataset.piece;
     const row = parseInt(cell.dataset.row);
     const isWhitePawn = piece === 'P' && row === 0;
     const isBlackPawn = piece === 'p' && row === 7;
     return isWhitePawn || isBlackPawn;
 };


// 턴 전환 및 상태 업데이트, AI 호출 로직
const switchTurn = () => {
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    updateStatus(); // Update the status display

    // Check for game over conditions (checkmate/stalemate) for the player whose turn it now is
    if (isGameOver(currentTurn, internalBoardState)) {
        gameOver = true;
        updateStatus(); // Update status to show final result
        return;
    }


    // If it's now the AI's turn, trigger its move
    if (currentTurn === aiColor && !gameOver) {
        setTimeout(aiMove, 100); // Short delay for AI move
    }
}

// 게임 종료 조건 확인 (체크메이트 또는 스테일메이트)
const isGameOver = (playerColor, boardState) => {
     const legalMoves = getLegalMoves(boardState, playerColor);
     if (legalMoves.length === 0) {
         if (isInCheck(playerColor, boardState)) {
             // Checkmate
             console.log(`Checkmate! ${playerColor === 'white' ? 'Black' : 'White'} wins.`);
             return true;
         } else {
             // Stalemate
             console.log("Stalemate! It's a draw.");
             return true;
         }
     }
     // Add checks for insufficient material, fifty-move rule if desired
     return false;
 }


// 2. 플레이어 체크메이트 알림 확인 및 명확화
// updateStatus 함수 수정 (기존 로직에서 메시지 명확화)

const updateStatus = () => {
    let statusText = "";
    if (gameOver) {
         const playerColor = aiColor === 'white' ? 'black' : 'white'; // 플레이어 색상
         const isPlayerInCheck = isInCheck(playerColor, internalBoardState);
         const playerHasMoves = getLegalMoves(internalBoardState, playerColor).length > 0;

         // AI의 체크메이트/스테일메이트 확인 (현재 턴 기준)
         const isAiInCheck = isInCheck(aiColor, internalBoardState);
         const aiHasMoves = getLegalMoves(internalBoardState, aiColor).length > 0;

         if (currentTurn === playerColor) { // 게임 종료 시점이 플레이어 턴일 때 (AI가 마지막 수를 둠)
             if (isPlayerInCheck && !playerHasMoves) {
                 statusText = `Checkmate! AI (${aiColor}) wins!`; // 플레이어 체크메이트
             } else if (!isPlayerInCheck && !playerHasMoves) {
                 statusText = "Stalemate! It's a draw."; // 플레이어 스테일메이트
             } else {
                 // 다른 게임 종료 사유 (거의 발생 안함)
                  statusText = "Game Over.";
              }
         } else { // 게임 종료 시점이 AI 턴일 때 (플레이어가 마지막 수를 둠)
              if (isAiInCheck && !aiHasMoves) {
                  statusText = `Checkmate! Player (${playerColor}) wins!`; // AI 체크메이트
              } else if (!isAiInCheck && !aiHasMoves) {
                  statusText = "Stalemate! It's a draw."; // AI 스테일메이트
              } else {
                   statusText = "Game Over.";
               }
         }

    } else { // 게임 진행 중
        const checkedPlayer = isInCheck(currentTurn, internalBoardState) ? currentTurn : null;
        if (checkedPlayer) {
            // 체크 상태인 플레이어가 사람인지 AI인지 구분
            const playerPronoun = checkedPlayer === aiColor ? `AI (${aiColor})` : `Player (${checkedPlayer})`;
            statusText = `${playerPronoun} is in check! `;
        }

        if (currentTurn === aiColor) {
            statusText += `AI (${aiColor}) Thinking...`;
        } else {
             const playerColor = aiColor === 'white' ? 'black' : 'white';
            statusText += `Player (${playerColor}) turn.`;
        }
    }
    statusDisplay.textContent = statusText;
    statusDisplay.style.display = 'block';
};

// 폰 승급 체크 (시각적)
const checkPromotion = (cell) => {
    const pieceElement = cell.firstChild;
    if (!pieceElement) return;

    const piece = pieceElement.dataset.piece;
    const row = parseInt(cell.dataset.row);
    const isWhitePawn = piece === 'P' && row === 0;
    const isBlackPawn = piece === 'p' && row === 7;

    if (isWhitePawn || isBlackPawn) {
         // If AI promotes, handle automatically (e.g., always Queen)
         if ((isWhitePawn && aiColor === 'white') || (isBlackPawn && aiColor === 'black')) {
              const promotedPiece = isWhitePawn ? 'Q' : 'q';
              cell.innerHTML = ''; // Clear the pawn
              cell.appendChild(createPiece(promotedPiece)); // Add the queen
              internalBoardState[row][parseInt(cell.dataset.col)] = promotedPiece; // Update internal state
              console.log(`AI promoted pawn to ${promotedPiece}`);
              switchTurn(); // Promotion complete, switch turn
         } else {
             // Player promotion: Open popup
             openPromotionPopup(cell, isWhitePawn ? 'white' : 'black');
         }
    }
};

// 승급 팝업 창
const openPromotionPopup = (cell, color) => {
    const promotionPieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    // Disable board interaction while popup is open
    board.style.pointerEvents = 'none';

    const popup = document.createElement('div');
    popup.classList.add('promotion-popup');
    popup.style.position = 'absolute';
    // Position popup near the cell (example positioning)
     const cellRect = cell.getBoundingClientRect();
     popup.style.left = `${cellRect.left + window.scrollX}px`;
     popup.style.top = `${cellRect.top + window.scrollY}px`;
     popup.style.border = '2px solid black';
     popup.style.background = 'white';
     popup.style.padding = '10px';
     popup.style.zIndex = '1000';


    const message = document.createElement('p');
    message.textContent = 'Promote pawn to:';
     message.style.margin = '0 0 5px 0';
     message.style.textAlign = 'center';
    popup.appendChild(message);

     const pieceContainer = document.createElement('div');
     pieceContainer.style.display = 'flex';
     pieceContainer.style.gap = '5px';


    promotionPieces.forEach((pieceChar) => {
        const pieceElem = createPiece(pieceChar);
         pieceElem.style.cursor = 'pointer';
         pieceElem.style.border = '1px solid #ccc';
         pieceElem.style.padding = '5px';

        pieceElem.addEventListener('click', () => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);

            cell.innerHTML = ''; // Remove the pawn
            cell.appendChild(createPiece(pieceChar)); // Add the chosen piece visually
            internalBoardState[row][col] = pieceChar; // Update internal state

            document.body.removeChild(popup); // Close popup
             board.style.pointerEvents = 'auto'; // Re-enable board interaction

             console.log(`Player promoted pawn to ${pieceChar}`);
             switchTurn(); // Promotion chosen, now switch turn
        });
         pieceContainer.appendChild(pieceElem);
    });

    popup.appendChild(pieceContainer);
    document.body.appendChild(popup);
};

// 선택 초기화 (체스판)
const clearSelection = () => {
    selectedCell?.classList.remove('selected');
    selectedCell = null;
};

// 선택 초기화 (보관소)
const clearStorageSelection = () => {
    selectedStorageCell?.classList.remove('selected');
    selectedStorageCell = null;
};

// 게임 초기화 (첫 턴 및 AI 색상 전환 로직 수정)
const resetGame = () => {
    // 1. Determine AI color for this game
    // If AI played black last game, it plays white now, and vice versa.
    aiColor = aiPlayedBlackLastGame ? 'white' : 'black';
    // Update the tracker for the *next* reset
    aiPlayedBlackLastGame = (aiColor === 'black');

    console.log(`--- New Game ---`);
    console.log(`AI plays: ${aiColor}. Player plays: ${aiColor === 'white' ? 'black' : 'white'}.`);
    console.log(`White always starts.`);

    // 2. Reset board and state
    createBoard();
    initPieces();
    initStorageAreas();
    initInternalBoardState(); // Reset internal state based on initPieces setup
    moveHistory = [];
    clearStorageSelection();
    clearSelection();
    clearHighlightedMoves();
    gameOver = false;
    transpositionTable.clear(); // Clear transposition table
     killerMoves.forEach(level => level.length = 0); // Clear killer moves
     Object.keys(historyTable).forEach(key => delete historyTable[key]); // Clear history table


    // 3. Set the starting turn
    currentTurn = 'white'; // White always starts

    // 4. Update status and trigger AI if it starts
    updateStatus(); // Set initial status message

    if (currentTurn === aiColor && !gameOver) {
        // AI is White and starts the game
        setTimeout(aiMove, 500); // Give a moment before AI moves
    }
};

// --- Evaluation Functions (Keep as is, they favor Black with higher scores) ---
const evaluateBoard = (boardState) => {
    let score = 0; // Higher score favors Black

    // --- 1. 기본 평가: 기물 가치 및 위치 보너스 ---
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePositionBonus = 0;
    let blackPositionBonus = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const value = pieceValues[piece];
                const isWhite = piece === piece.toUpperCase();

                if (isWhite) {
                    whiteMaterial += value;
                    if (piece === 'P') whitePositionBonus += pawnPositionValues[row][col];
                    // Add other white position bonuses...
                } else {
                    blackMaterial += value;
                    if (piece === 'p') blackPositionBonus += pawnPositionValues[7 - row][col];
                    // Add other black position bonuses...
                }
            }
        }
    }
    // 기본 점수 = 흑 재료 - 백 재료 + 흑 위치 - 백 위치
    score = (blackMaterial + blackPositionBonus) - (whiteMaterial + whitePositionBonus);

    // --- 2. 추가 정적 평가 요소들 ---
    score += evaluatePieceActivity(boardState, 'black'); // 활동성은 높을수록 좋음
    score -= evaluatePieceActivity(boardState, 'white');
    score += evaluatePawnStructure(boardState, 'black'); // 폰 구조 점수 (구현에 따라 +/-)
    score -= evaluatePawnStructure(boardState, 'white');
    score += evaluateKingSafety(boardState, 'black');    // 왕 안전성 점수 (높을수록 좋음)
    score -= evaluateKingSafety(boardState, 'white');
    score += evaluateOpenFiles(boardState, 'black');     // 열린 파일 점수
    score -= evaluateOpenFiles(boardState, 'white');
    score += evaluateCenterControl(boardState, 'black');  // 중앙 장악 점수
    score -= evaluateCenterControl(boardState, 'white');
    score += evaluatePiecePairs(boardState, 'black');    // 쌍 기물 보너스
    score -= evaluatePiecePairs(boardState, 'white');
    score += evaluatePassedPawns(boardState, 'black');   // 통과한 폰 보너스
    score -= evaluatePassedPawns(boardState, 'white');
    if (isInCheck('white', boardState)) score += 0.1; // 흑이 백을 체크하면 흑에게 보너스
    if (isInCheck('black', boardState)) score -= 0.1; // 백이 흑을 체크하면 백에게 보너스 (흑에게 페널티)

    // --- 3. 기물 위협 평가 추가 ---
    // 위협 페널티는 해당 색상에게 불리함을 의미 (양수 값)
    const blackThreatPenalty = evaluateThreats(boardState, 'black');
    const whiteThreatPenalty = evaluateThreats(boardState, 'white');

    // 흑에 대한 위협 페널티는 흑에게 안 좋으므로 전체 점수(흑 기준)에서 뺀다.
    score -= blackThreatPenalty;
    // 백에 대한 위협 페널티는 백에게 안 좋으므로 전체 점수(흑 기준)에 더한다 (흑의 상대적 이득).
    score += whiteThreatPenalty;

    // console.log(`Final Score: ${score.toFixed(2)} (Material/Pos: ${((blackMaterial + blackPositionBonus) - (whiteMaterial + whitePositionBonus)).toFixed(2)}, Black Threat Penalty: ${blackThreatPenalty.toFixed(2)}, White Threat Penalty: ${whiteThreatPenalty.toFixed(2)})`);

    return score;
};


// --- Other Evaluation Helpers (Keep as is) ---
// evaluatePieceActivity, evaluatePawnStructure, evaluateKingSafety, etc.
// These functions should return positive values for black's advantage
// and negative values for white's advantage based on the standard evaluation.
// Example structure (modify specific logic as needed):

const evaluatePieceActivity = (boardState, color) => {
     let activityScore = 0;
     // ... calculate activity ...
     // Return positive if good for black, negative if good for white
     // This might need adjustment if the function inherently calculates for one side.
     // Let's assume it calculates raw activity value:
      let rawActivity = 0;
       for (let row = 0; row < 8; row++) {
           for (let col = 0; col < 8; col++) {
               const piece = boardState[row][col];
               if (piece && ((color === 'white' && piece === piece.toUpperCase()) || (color === 'black' && piece === piece.toLowerCase()))) {
                   // Simple: count moves for minor/major pieces
                   if (piece.toUpperCase() !== 'P' && piece.toUpperCase() !== 'K') {
                        // Use getValidMoves_Raw to avoid deep recursion issues in evaluation
                        const moves = getValidMoves_Raw(piece, row, col, boardState);
                       rawActivity += moves.length * 0.05; // Small bonus per move
                   }
               }
           }
       }
     return rawActivity; // Return raw activity, sign handled in evaluateBoard
 };

 const evaluatePawnStructure = (boardState, color) => {
     let pawnScore = 0;
     const pawns = Array(8).fill(0); // Count pawns in each file for the given color
     const pawnPositions = [];

     for (let col = 0; col < 8; col++) {
         for (let row = 0; row < 8; row++) {
             const piece = boardState[row][col];
             if (piece && piece.toUpperCase() === 'P' &&
                 ((color === 'white' && piece === 'P') || (color === 'black' && piece === 'p'))) {
                 pawns[col]++;
                 pawnPositions.push({row, col});
             }
         }
     }

     // Doubled pawns penalty
     for (let col = 0; col < 8; col++) {
         if (pawns[col] > 1) {
             pawnScore -= 0.2 * (pawns[col] - 1);
         }
     }

     // Isolated pawns penalty
      for (const pawn of pawnPositions) {
          const col = pawn.col;
          const hasSupportLeft = col > 0 && pawns[col - 1] > 0;
          const hasSupportRight = col < 7 && pawns[col + 1] > 0;
          if (!hasSupportLeft && !hasSupportRight) {
              pawnScore -= 0.1;
          }
      }

     // Passed pawns are handled separately in evaluatePassedPawns

     return pawnScore; // Return raw score, sign handled in evaluateBoard
 };

 const evaluateKingSafety = (boardState, color) => {
     let safetyScore = 0;
     const kingPos = findKing(color, boardState);
     if (!kingPos) return 0;
     const [kingRow, kingCol] = kingPos;

     // Pawn shield bonus
     const shieldDirection = color === 'white' ? -1 : 1; // Pawns defending are usually one rank ahead
     for (let dc = -1; dc <= 1; dc++) {
         const shieldRow = kingRow + shieldDirection;
         const shieldCol = kingCol + dc;
          if (shieldRow >= 0 && shieldRow < 8 && shieldCol >= 0 && shieldCol < 8) {
              const piece = boardState[shieldRow][shieldCol];
              if (piece && piece.toUpperCase() === 'P' && ((color === 'white' && piece === 'P') || (color === 'black' && piece === 'p'))) {
                  safetyScore += 0.3; // Bonus for pawn shield
              }
          }
     }

      // Penalty for opponent pieces near king
      const opponentColor = color === 'white' ? 'black' : 'white';
      for (let dr = -2; dr <= 2; dr++) {
           for (let dc = -2; dc <= 2; dc++) {
               if (dr === 0 && dc === 0) continue;
               const r = kingRow + dr;
               const c = kingCol + dc;
               if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                   const piece = boardState[r][c];
                   if (piece && ((opponentColor === 'white' && piece === piece.toUpperCase()) || (opponentColor === 'black' && piece === piece.toLowerCase()))) {
                       // Penalty based on piece value and proximity (simple version)
                       safetyScore -= pieceValues[piece] * 0.05 / (Math.abs(dr) + Math.abs(dc));
                   }
               }
           }
       }

     // Penalty for open files near king (simplified)
     let fileIsOpen = true;
      for(let r=0; r<8; r++) {
          if(boardState[r][kingCol]?.toUpperCase() === 'P') {
              fileIsOpen = false;
              break;
          }
      }
      if(fileIsOpen) safetyScore -= 0.2;


     return safetyScore; // Return raw score, sign handled in evaluateBoard
 };

 const evaluateOpenFiles = (boardState, color) => {
     let fileScore = 0;
     const myRook = color === 'white' ? 'R' : 'r';
     const myQueen = color === 'white' ? 'Q' : 'q';
     const myPawn = color === 'white' ? 'P' : 'p';
     const oppPawn = color === 'white' ? 'p' : 'P';

     for (let col = 0; col < 8; col++) {
         let myPawnOnFile = false;
         let oppPawnOnFile = false;
         let myRookOrQueenOnFile = false;
         for (let row = 0; row < 8; row++) {
             const piece = boardState[row][col];
             if (piece === myPawn) myPawnOnFile = true;
             if (piece === oppPawn) oppPawnOnFile = true;
             if (piece === myRook || piece === myQueen) myRookOrQueenOnFile = true;
         }

         if (myRookOrQueenOnFile) {
             if (!myPawnOnFile && !oppPawnOnFile) { // Open file
                 fileScore += 0.3;
             } else if (!myPawnOnFile && oppPawnOnFile) { // Semi-open file (for me)
                 fileScore += 0.15;
             }
         }
     }
     return fileScore; // Return raw score, sign handled in evaluateBoard
 };

 const evaluateCenterControl = (boardState, color) => {
     let centerScore = 0;
     const centerSquares = [[3, 3], [3, 4], [4, 3], [4, 4]];
     const isWhite = color === 'white';

      for (let row = 0; row < 8; row++) {
         for (let col = 0; col < 8; col++) {
             const piece = boardState[row][col];
             if (piece && ((isWhite && piece === piece.toUpperCase()) || (!isWhite && piece === piece.toLowerCase()))) {
                 // Bonus for pieces occupying center
                  if (centerSquares.some(([r, c]) => r === row && c === col)) {
                      if(piece.toUpperCase() === 'P') centerScore += 0.2;
                      else centerScore += 0.1;
                  }

                  // Bonus for pieces attacking center
                  const moves = getValidMoves_Raw(piece, row, col, boardState); // Use raw moves for evaluation speed
                  for (const move of moves) {
                       if (centerSquares.some(([r, c]) => r === move[0] && c === move[1])) {
                           // Check if it's an actual attack for pawns
                           if(piece.toUpperCase() === 'P' && col === move[1]) continue; // Pawn moving straight doesn't control
                           centerScore += 0.05;
                       }
                   }
             }
         }
     }
     return centerScore; // Return raw score, sign handled in evaluateBoard
 };

 const evaluatePiecePairs = (boardState, color) => {
      let pairScore = 0;
      let bishopCount = 0;
      const isWhite = color === 'white';

      for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
              const piece = boardState[row][col];
              if (piece && ((isWhite && piece === piece.toUpperCase()) || (!isWhite && piece === piece.toLowerCase()))) {
                  if (piece.toUpperCase() === 'B') {
                      bishopCount++;
                  }
                  // Could add rook pair bonus etc.
              }
          }
      }

      if (bishopCount >= 2) {
          pairScore += 0.3; // Bishop pair bonus
      }

      return pairScore; // Return raw score, sign handled in evaluateBoard
  };

const evaluatePassedPawns = (boardState, color) => {
    let passedPawnScore = 0;
    const isWhite = color === 'white';
    const pawn = isWhite ? 'P' : 'p';
    const direction = isWhite ? -1 : 1;
    const promotionRank = isWhite ? 0 : 7;

    for (let startRow = 0; startRow < 8; startRow++) {
        for (let col = 0; col < 8; col++) {
            if (boardState[startRow][col] === pawn) {
                let isPassed = true;
                // Check squares in front in the same file and adjacent files
                for (let aheadRow = startRow + direction; ; aheadRow += direction) {
                     if (aheadRow < 0 || aheadRow > 7) break; // Reached end of board

                     for (let checkCol = col - 1; checkCol <= col + 1; checkCol++) {
                          if (checkCol < 0 || checkCol > 7) continue; // Check within board bounds

                          const blockingPiece = boardState[aheadRow][checkCol];
                          // Check only for *opponent's* pawns
                          if (blockingPiece && blockingPiece.toUpperCase() === 'P' && blockingPiece !== pawn) {
                              isPassed = false;
                              break;
                          }
                      }
                     if (!isPassed) break;
                 }


                if (isPassed) {
                    // Bonus based on how close to promotion
                    const ranksAdvanced = isWhite ? (6 - startRow) : (startRow - 1);
                     // Simple bonus, can be more sophisticated
                     passedPawnScore += 0.2 + (ranksAdvanced * 0.1);
                 }
            }
        }
    }
    return passedPawnScore; // Return raw score, sign handled in evaluateBoard
};

// --- 평가 관련 상수 추가 ---
const THREAT_PENALTY_FACTOR = 0.5; // 공격받는 기물 가치에 곱할 기본 페널티 계수
const UNDEFENDED_THREAT_MULTIPLIER = 1.5; // 보호받지 못하는 기물이 공격받을 때 페널티 증폭 배수
const LOW_ATTACKER_THREAT_MULTIPLIER = 1.2; // 가치가 낮은 기물에게 공격받을 때 페널티 증폭 배수

/**
 * 특정 색상의 기물에 대한 위협을 평가하여 페널티 점수를 반환하는 함수.
 * 점수는 항상 양수이며, 이 색상에게 불리함을 나타냅니다.
 * @param {Array<Array<String|null>>} boardState - 현재 보드 상태
 * @param {'white' | 'black'} color - 위협을 평가할 기물의 색상
 * @returns {number} - 해당 색상에 대한 총 위협 페널티 점수 (양수)
 */
const evaluateThreats = (boardState, color) => {
    let totalThreatPenalty = 0;
    const opponentColor = color === 'white' ? 'black' : 'white';

    // *** 성능 경고: 이 함수는 매 평가 시마다 두 번의 getPossibleMoves를 호출합니다. ***
    // 실제 적용 시 최적화(예: 공격만 계산하는 함수 사용)가 필요할 수 있습니다.
    const opponentMoves = getPossibleMoves(boardState, opponentColor); // 상대방의 모든 가능한 이동 (위협 확인용)
    const myDefendingMoves = getPossibleMoves(boardState, color);     // 자신의 모든 가능한 이동 (방어 확인용)

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];

            // 해당 색상의 기물이 있는 경우에만 평가
            if (piece && ((color === 'white' && piece === piece.toUpperCase()) ||
                          (color === 'black' && piece === piece.toLowerCase()))) {

                const pieceValue = pieceValues[piece];
                let isThreatened = false;
                let minAttackerValue = Infinity;
                const attackers = []; // 공격하는 상대 기물 정보 저장

                // 1. 이 칸을 공격하는 상대방 기물이 있는지 확인
                opponentMoves.forEach(move => {
                    // 폰의 공격은 대각선만 해당, 다른 기물은 해당 칸으로 이동 가능하면 공격으로 간주
                     const [targetRow, targetCol] = move.to;
                     const attackerPiece = move.piece;
                     if (targetRow === row && targetCol === col) {
                         if (attackerPiece.toUpperCase() === 'P') {
                             // 폰은 대각선 이동(공격)만 위협으로 간주
                             if (move.from[1] !== targetCol) {
                                 isThreatened = true;
                                 attackers.push(attackerPiece);
                                 minAttackerValue = Math.min(minAttackerValue, pieceValues[attackerPiece]);
                             }
                         } else {
                             isThreatened = true;
                             attackers.push(attackerPiece);
                             minAttackerValue = Math.min(minAttackerValue, pieceValues[attackerPiece]);
                         }
                     }
                });

                // 2. 위협받는 경우, 페널티 계산
                if (isThreatened) {
                    let isDefended = false;
                    let minDefenderValue = Infinity;

                    // 2a. 이 칸을 방어하는 아군 기물이 있는지 확인 (자기 자신 제외)
                    myDefendingMoves.forEach(move => {
                         const [targetRow, targetCol] = move.to;
                         const defenderPiece = move.piece;
                         // 자기 자신을 방어하는 경우는 제외 (move.from과 현재 위치 비교)
                          if (targetRow === row && targetCol === col && !(move.from[0] === row && move.from[1] === col)) {
                             // 폰의 방어는 대각선 공격 가능 위치여야 함
                              if (defenderPiece.toUpperCase() === 'P') {
                                 if (move.from[1] !== targetCol) {
                                      isDefended = true;
                                      minDefenderValue = Math.min(minDefenderValue, pieceValues[defenderPiece]);
                                  }
                              } else {
                                 isDefended = true;
                                 minDefenderValue = Math.min(minDefenderValue, pieceValues[defenderPiece]);
                              }
                          }
                    });

                    // 2b. 페널티 점수 계산
                    let currentPenalty = pieceValue * THREAT_PENALTY_FACTOR; // 기본 페널티

                    // 보호받지 못하면 페널티 증가
                    if (!isDefended) {
                        currentPenalty *= UNDEFENDED_THREAT_MULTIPLIER;
                    }

                    // 공격하는 기물의 가치가 현재 기물보다 낮으면 페널티 증가 (더 위험한 교환)
                    if (minAttackerValue < pieceValue) {
                         currentPenalty *= LOW_ATTACKER_THREAT_MULTIPLIER;
                    }
                    // 방어되고 있고, 최소 방어자 가치가 최소 공격자 가치보다 낮거나 같으면 페널티 감소? (옵션)
                    // else if (isDefended && minDefenderValue <= minAttackerValue) {
                    //    currentPenalty *= 0.5; // 페널티 감소 (교환이 유리하거나 동등)
                    //}


                    totalThreatPenalty += currentPenalty;
                    // console.log(`Threat detected: ${color} ${piece} at ${row},${col} attacked by [${attackers.join(',')}] (Min Val: ${minAttackerValue}). Defended: ${isDefended} (Min Val: ${minDefenderValue}). Penalty: ${currentPenalty.toFixed(2)}`);
                }
            }
        }
    }
    // console.log(`Total Threat Penalty for ${color}: ${totalThreatPenalty.toFixed(2)}`);
    return totalThreatPenalty; // 해당 색상에게 불리한 정도 (항상 양수)
};

// AlphaBeta 함수 수정: maximizingPlayer 인자에 따라 최대/최소 점수 탐색
// 함수 자체는 변경 없음. 호출하는 쪽에서 maximizingPlayer를 AI 색상에 맞게 설정.
// maximizingPlayer = true -> Black's turn (Maximizes score)
// maximizingPlayer = false -> White's turn (Minimizes score)
const alphaBeta = (boardState, depth, alpha, beta, maximizingPlayer, ply = 0) => { // Add ply for killer moves index
    const hash = computeZobristHash(boardState); // Consider adding turn/castling/enpassant to hash
    if (transpositionTable.has(hash)) {
        const entry = transpositionTable.get(hash);
        if (entry.depth >= depth) {
            // Can use score directly if exact match or adjust based on alpha/beta bounds
            if (entry.flag === 'exact') return entry.score;
             if (entry.flag === 'lowerbound' && entry.score >= beta) return beta; // Fail-high
             if (entry.flag === 'upperbound' && entry.score <= alpha) return alpha; // Fail-low
             // Adjust alpha/beta based on stored bounds if needed
            // alpha = Math.max(alpha, entry.alpha);
            // beta = Math.min(beta, entry.beta);
        }
    }


    if (depth === 0) {
        // Quiescence search can be added here to evaluate captures further
        return evaluateBoard(boardState);
    }

    const color = maximizingPlayer ? 'black' : 'white';
    let legalMoves = getLegalMoves(boardState, color);

    if (legalMoves.length === 0) {
        if (isInCheck(color, boardState)) {
            // Checkmate score - very bad for the player who is checkmated
            // Return +/- Infinity based on who was checkmated
            return maximizingPlayer ? -Infinity - depth : Infinity + depth; // Penalize faster checkmates more
        } else {
            // Stalemate score
            return 0; // Draw
        }
    }

    // Sort moves for better pruning
    legalMoves = sortMoves(legalMoves, boardState, ply);

    let bestScore;
    let tt_flag = 'upperbound'; // Assume fail-low initially

    if (maximizingPlayer) { // AI is Black (or the maximizing player in recursion)
        bestScore = -Infinity;
        for (const move of legalMoves) {
            const newBoard = boardState.map(row => [...row]);
            // Simulate move on newBoard (including special moves like castling/en passant)
            const { from, to, piece } = move;
            const [toRow, toCol, special] = to;
             newBoard[toRow][toCol] = piece;
             newBoard[from[0]][from[1]] = null;
             if (special === 'enPassant') {
                 newBoard[from[0]][toCol] = null;
             } else if (special === 'castling') {
                 const rookFromCol = toCol === 6 ? 7 : 0;
                 const rookToCol = toCol === 6 ? 5 : 3;
                 newBoard[from[0]][rookToCol] = newBoard[from[0]][rookFromCol];
                 newBoard[from[0]][rookFromCol] = null;
             }
             // Check internal promotion after simulation
             checkPromotionInternal(toRow, toCol, piece);


            const score = alphaBeta(newBoard, depth - 1, alpha, beta, false, ply + 1); // Recursive call for opponent
            if (score > bestScore) {
                bestScore = score;
            }
            if (bestScore > alpha) { // Found a better move for maximizer
                 alpha = bestScore;
                 tt_flag = 'exact'; // We have a score within the alpha-beta window
             }

            if (beta <= alpha) { // Beta cut-off
                 // Store killer move (move that caused beta cutoff)
                  if (!boardState[toRow][toCol]) { // Only store non-capture killer moves typically
                      if (!killerMoves[ply]) killerMoves[ply] = [];
                      killerMoves[ply].unshift(move); // Add to front
                      killerMoves[ply] = killerMoves[ply].slice(0, 2); // Keep only top 2
                  }
                  // Update History Table for the move that caused cutoff
                  const historyKey = `${move.piece}_${toRow}_${toCol}`;
                   historyTable[historyKey] = (historyTable[historyKey] || 0) + depth * depth;


                 tt_flag = 'lowerbound'; // Score is at least beta
                 bestScore = beta; // Return beta as the lower bound
                break;
            }
        }
    } else { // AI is White (or the minimizing player in recursion)
        bestScore = Infinity;
        for (const move of legalMoves) {
            const newBoard = boardState.map(row => [...row]);
            // Simulate move on newBoard
            const { from, to, piece } = move;
            const [toRow, toCol, special] = to;
             newBoard[toRow][toCol] = piece;
             newBoard[from[0]][from[1]] = null;
             if (special === 'enPassant') {
                 newBoard[from[0]][toCol] = null;
             } else if (special === 'castling') {
                 const rookFromCol = toCol === 6 ? 7 : 0;
                 const rookToCol = toCol === 6 ? 5 : 3;
                 newBoard[from[0]][rookToCol] = newBoard[from[0]][rookFromCol];
                 newBoard[from[0]][rookFromCol] = null;
             }
            checkPromotionInternal(toRow, toCol, piece);

            const score = alphaBeta(newBoard, depth - 1, alpha, beta, true, ply + 1); // Recursive call for opponent
            if (score < bestScore) {
                bestScore = score;
            }
             if (bestScore < beta) { // Found a better move for minimizer
                  beta = bestScore;
                  tt_flag = 'exact';
              }

            if (beta <= alpha) { // Alpha cut-off
                  // Store killer move
                   if (!boardState[toRow][toCol]) {
                       if (!killerMoves[ply]) killerMoves[ply] = [];
                       killerMoves[ply].unshift(move);
                       killerMoves[ply] = killerMoves[ply].slice(0, 2);
                   }
                    // Update History Table
                   const historyKey = `${move.piece}_${toRow}_${toCol}`;
                    historyTable[historyKey] = (historyTable[historyKey] || 0) + depth * depth;

                  tt_flag = 'upperbound'; // Score is at most alpha
                  bestScore = alpha; // Return alpha as the upper bound
                 break;
            }
        }
    }

    // Store result in transposition table
    transpositionTable.set(hash, { depth, score: bestScore, flag: tt_flag /*, alpha: originalAlpha, beta: originalBeta */ });

    return bestScore;
};


// 1. AI 이동 시각적 표시 및 3. 오프닝 다양성 적용 부분
// aiMove 함수 수정

const aiMove = () => {
    if (gameOver || currentTurn !== aiColor) return;

    console.log(`AI (${aiColor}) is thinking...`);
    updateStatus(); // AI 생각 중 상태 표시

    const legalMoves = getLegalMoves(internalBoardState, aiColor);

    if (legalMoves.length === 0) {
        console.log(`AI (${aiColor}) has no legal moves. Game should be over.`);
        if (!gameOver) {
            gameOver = true;
            updateStatus();
        }
        return;
    }

    let bestMove = null;
    let bestScore;
    const depth = 3; // 탐색 깊이
    const isAiMaximizing = (aiColor === 'black');
    bestScore = isAiMaximizing ? -Infinity : Infinity;

    // 이동별 점수를 저장할 배열
    const moveScores = [];

    // 모든 가능한 이동 평가
    for (const move of legalMoves) { // Use original legalMoves before sorting for evaluation
        const newBoard = internalBoardState.map(row => [...row]);
        // Simulate move
        const { from, to, piece } = move;
        const [toRow, toCol, special] = to;
         newBoard[toRow][toCol] = piece;
         newBoard[from[0]][from[1]] = null;
         if (special === 'enPassant') {
             newBoard[from[0]][toCol] = null;
         } else if (special === 'castling') {
             const rookFromCol = toCol === 6 ? 7 : 0;
             const rookToCol = toCol === 6 ? 5 : 3;
             newBoard[from[0]][rookToCol] = newBoard[from[0]][rookFromCol];
             newBoard[from[0]][rookFromCol] = null;
         }
        checkPromotionInternal(toRow, toCol, piece);

        const score = alphaBeta(newBoard, depth - 1, -Infinity, Infinity, !isAiMaximizing, 1);
        moveScores.push({ move, score });

        // // 기존 최고 점수 로직 (오프닝 이후에 사용) - 여기서는 점수만 계산
        // if (isAiMaximizing) {
        //     if (score > bestScore) { bestScore = score; bestMove = move; }
        // } else {
        //     if (score < bestScore) { bestScore = score; bestMove = move; }
        // }
    }

    // 3. 오프닝 다양성: 처음 3수(moveHistory.length < 6)는 상위 3개 중 랜덤 선택
    if (moveHistory.length < 6 && moveScores.length > 0) {
        // AI 목표에 따라 정렬
        if (isAiMaximizing) {
            moveScores.sort((a, b) => b.score - a.score); // Maximize (Black)
        } else {
            moveScores.sort((a, b) => a.score - b.score); // Minimize (White)
        }

        // 상위 N개 선택 (최대 3개)
        const N = 3;
        const topMoves = moveScores.slice(0, Math.min(N, moveScores.length));

        // 상위 이동 중 랜덤 선택
        if (topMoves.length > 0) {
             bestMove = topMoves[Math.floor(Math.random() * topMoves.length)].move;
             // 선택된 수의 점수 로깅 (디버깅용)
             const chosenScoreEntry = moveScores.find(ms => ms.move === bestMove);
             bestScore = chosenScoreEntry ? chosenScoreEntry.score : (isAiMaximizing ? -Infinity : Infinity);
             console.log(`AI Opening Move (Random from Top ${topMoves.length}): ${bestMove.piece} [${bestMove.from}] -> [${bestMove.to}], Score: ${bestScore}`);
         } else {
              // Should not happen if legalMoves exist, but fallback
              bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
               const chosenScoreEntry = moveScores.find(ms => ms.move === bestMove);
               bestScore = chosenScoreEntry ? chosenScoreEntry.score : (isAiMaximizing ? -Infinity : Infinity);
              console.warn("AI Opening Fallback: Random legal move chosen.");
          }

    } else if (moveScores.length > 0) {
         // 오프닝 이후: 가장 좋은 점수의 수를 선택
         let currentBestScore = isAiMaximizing ? -Infinity : Infinity;
         for(const ms of moveScores) {
              if (isAiMaximizing) {
                  if (ms.score > currentBestScore) {
                      currentBestScore = ms.score;
                      bestMove = ms.move;
                  }
              } else {
                   if (ms.score < currentBestScore) {
                       currentBestScore = ms.score;
                       bestMove = ms.move;
                   }
               }
         }
         bestScore = currentBestScore; // Update bestScore for logging
         console.log(`AI Normal Move: ${bestMove.piece} [${bestMove.from}] -> [${bestMove.to}], Best Score: ${bestScore}`);
     }


    // 찾은 최적의 수 실행
    if (bestMove) {
        const fromCell = getCell(bestMove.from[0], bestMove.from[1]);
        const toCell = getCell(bestMove.to[0], bestMove.to[1]);

        if (!fromCell || !toCell || !fromCell.firstChild) {
            console.error("AI move error: Could not find cells or piece for the chosen move:", bestMove);
            switchTurn();
            return;
        }

        // 1. AI 이동 시각적 표시: 이동 전 셀 스타일 저장 및 변경
        const originalFromBg = fromCell.style.backgroundColor;
        const originalToBg = toCell.style.backgroundColor;
        const highlightColor = '#faca01'; // AI 이동 하이라이트 색상

        fromCell.style.backgroundColor = highlightColor;
        toCell.style.backgroundColor = highlightColor;

        // 이동 실행
        selectedCell = fromCell;
        movePiece(toCell, bestMove.to[2]); // movePiece 내부에서 switchTurn 호출됨 (승급 아닌 경우)

        // 잠시 후 원래 색으로 복원
        setTimeout(() => {
            // 셀이 아직 존재하는지 확인 (드물지만 리셋 등 예외 상황 대비)
            const currentFromCell = getCell(bestMove.from[0], bestMove.from[1]);
            const currentToCell = getCell(bestMove.to[0], bestMove.to[1]);
            if (currentFromCell) currentFromCell.style.backgroundColor = originalFromBg;
             // 도착 셀은 기물이 있으므로, (row+col)%2 기준으로 다시 계산해서 적용하는 것이 더 정확할 수 있음
             if (currentToCell) {
                 const row = parseInt(currentToCell.dataset.row);
                 const col = parseInt(currentToCell.dataset.col);
                 currentToCell.style.backgroundColor = (row + col) % 2 === 0 ? '#779556' : '#ebecd0';
             }
            // if (currentToCell) currentToCell.style.backgroundColor = originalToBg; // 이전 색상으로 복원해도 무방
        }, 1000); // 0.5초 동안 표시

    } else {
        console.error(`AI (${aiColor}) could not determine a best move despite having legal moves.`);
        switchTurn(); // 턴 넘김
    }
};




// --- Event Listener ---
resetButton.addEventListener('click', resetGame);

// --- Initial Game Setup ---
resetGame(); // Start the first game
