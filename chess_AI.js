const board = document.getElementById('chessboard');
const resetButton = document.getElementById('reset');
const whiteCapturedStorage = document.getElementById('whiteCapturedPieces');
const blackCapturedStorage = document.getElementById('blackCapturedPieces');
const statusDisplay = document.getElementById('status');

let selectedCell = null;
let selectedStorageCell = null;
let currentTurn = 'white';
let gameOver = false;
let moveHistory = [];
let highlightedCells = [];
let internalBoardState = Array(8).fill().map(() => Array(8).fill(null));
let lastFirstTurn = 'white'; // 마지막 게임의 첫 턴 추적

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
    'K': 0, 'k': 0
};

// 기물 위치 가중치 (중앙을 선호, 단순화된 예시)
const pawnPositionValues = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
    [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.2, 0.2, 0.0, 0.0, 0.0],
    [0.1, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
];

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
    span.style.fontSize = '40px';
    span.style.lineHeight = '60px';
    return span;
};

// 기물 생성 (이미지 사용)
// const createPiece = (char) => {
// const img = document.createElement('img');
// const color = char === char.toUpperCase() ? 'w' : 'b'; // 대문자(백), 소문자(흑)
// img.src = `images/<span class="math-inline">\{color\}</span>{pieceNames[char]}.png`; // 예: "images/wK.png"
// img.dataset.piece = char;
// img.classList.add('piece');
// return img;
// };

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
    setup.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            if (piece) {
                const cell = cells[rowIndex * 8 + colIndex];
                cell.appendChild(createPiece(piece));
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
    if (!boardState) {
        const cell = getCell(row, col);
        return cell && cell.firstChild ? cell.firstChild.dataset.piece : null;
    }
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return boardState[row][col];
};

// 기물별 이동 가능 위치 계산 (캐슬링과 앙파상 수정)
const getValidMoves = (piece, row, col, boardState = null, skipCastlingCheck = false) => {
    const moves = [];
    const isWhite = piece === piece.toUpperCase();
    if (!boardState) boardState = getBoardState();

    switch (piece.toUpperCase()) {
        case 'P': // 폰
            const direction = isWhite ? -1 : 1;
            const startRow = isWhite ? 6 : 1;

            if (getPieceAt(row + direction, col, boardState) === null) {
                moves.push([row + direction, col]);
                if (row === startRow && getPieceAt(row + 2 * direction, col, boardState) === null) {
                    moves.push([row + 2 * direction, col]);
                }
            }
            if (getPieceAt(row + direction, col - 1, boardState) && 
                (isWhite !== (getPieceAt(row + direction, col - 1, boardState) === getPieceAt(row + direction, col - 1, boardState).toUpperCase()))) {
                moves.push([row + direction, col - 1]);
            }
            if (getPieceAt(row + direction, col + 1, boardState) && 
                (isWhite !== (getPieceAt(row + direction, col + 1, boardState) === getPieceAt(row + direction, col + 1, boardState).toUpperCase()))) {
                moves.push([row + direction, col + 1]);
            }
            // 앙파상
            const enPassantRow = isWhite ? 3 : 4;
            if (row === enPassantRow && moveHistory.length > 0) {
                const lastMove = moveHistory[moveHistory.length - 1];
                const [fromRow, fromCol] = [parseInt(lastMove.from.dataset.row), parseInt(lastMove.from.dataset.col)];
                const [toRow, toCol] = [parseInt(lastMove.to.dataset.row), parseInt(lastMove.to.dataset.col)];
                const lastPiece = lastMove.to.firstChild.dataset.piece;
                if (lastPiece.toUpperCase() === 'P' && Math.abs(fromRow - toRow) === 2 && toRow === row && Math.abs(toCol - col) === 1) {
                    moves.push([row + direction, toCol, 'enPassant']);
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
                        if (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase())) {
                            moves.push([newRow, newCol]);
                        }
                        break;
                    }
                    moves.push([newRow, newCol]);
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
                if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) {
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

        case 'K': // 킹 (캐슬링 수정)
            const kingMoves = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            for (let [dr, dc] of kingMoves) {
                const newRow = row + dr, newCol = col + dc;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
                const pieceAtPos = getPieceAt(newRow, newCol, boardState);
                if (!pieceAtPos || (isWhite !== (pieceAtPos === pieceAtPos.toUpperCase()))) {
                    moves.push([newRow, newCol]);
                }
            }
            // 캐슬링 (재귀 방지)
            if (!skipCastlingCheck) {
                const kingStartRow = isWhite ? 7 : 0;
                if (row === kingStartRow && col === 4) {
                    const hasKingMoved = moveHistory.some(m => m.from.piece === piece);
                    if (!hasKingMoved && !isInCheck(isWhite ? 'white' : 'black', boardState)) {
                        // 킹사이드 캐슬링
                        const rookColKingSide = 7;
                        const hasRookMovedKingSide = moveHistory.some(m => 
                            m.from.row === kingStartRow && 
                            m.from.col === rookColKingSide && 
                            m.from.piece.toUpperCase() === 'R'
                        );
                        if (!hasRookMovedKingSide && !getPieceAt(row, 5, boardState) && !getPieceAt(row, 6, boardState)) {
                            let pathSafe = true;
                            for (let c = 5; c <= 6; c++) {
                                if (isSquareAttacked(row, c, isWhite ? 'white' : 'black', boardState)) {
                                    pathSafe = false;
                                    break;
                                }
                            }
                            if (pathSafe) moves.push([row, 6, 'castling']);
                        }
                        // 퀸사이드 캐슬링
                        const rookColQueenSide = 0;
                        const hasRookMovedQueenSide = moveHistory.some(m => 
                            m.from.row === kingStartRow && 
                            m.from.col === rookColQueenSide && 
                            m.from.piece.toUpperCase() === 'R'
                        );
                        if (!hasRookMovedQueenSide && !getPieceAt(row, 3, boardState) && !getPieceAt(row, 2, boardState) && !getPieceAt(row, 1, boardState)) {
                            let pathSafe = true;
                            for (let c = 2; c <= 3; c++) {
                                if (isSquareAttacked(row, c, isWhite ? 'white' : 'black', boardState)) {
                                    pathSafe = false;
                                    break;
                                }
                            }
                            if (pathSafe) moves.push([row, 2, 'castling']);
                        }
                    }
                }
            }
            break;
    }

    return moves;
};

// 초기화 시 internalBoardState 설정
const initInternalBoardState = () => {
    const setup = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [], [], [], [],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            internalBoardState[row][col] = setup[row][col] || null;
        }
    }
};

// 이동 시 internalBoardState 업데이트
const updateInternalBoardState = (fromRow, fromCol, toRow, toCol, piece, capturedPiece = null) => {
    internalBoardState[toRow][toCol] = piece;
    internalBoardState[fromRow][fromCol] = null;
    if (capturedPiece && capturedPiece.special === 'enPassant') {
        internalBoardState[fromRow][toCol] = null;
    }
};

const transpositionTable = new Map();

const zobristKeys = Array(8).fill().map(() =>
    Array(8).fill().map(() =>
        Array(12).fill().map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    )
);

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
                hash ^= zobristKeys[row][col][pieceToIndex(piece)];
            }
        }
    }
    return hash;
};

const killerMoves = Array(10).fill().map(() => []); // 최대 깊이 10
const historyTable = {};

const getMovePriority = (move, boardState, depth) => {
    let priority = 0;
    const capturedPiece = boardState[move.to[0]][move.to[1]];
    if (capturedPiece) {
        priority += pieceValues[capturedPiece] * 10;
    }
    if (killerMoves[depth]?.some(m => m.from[0] === move.from[0] && m.from[1] === move.from[1] && m.to[0] === move.to[0] && m.to[1] === move.to[1])) {
        priority += 50;
    }
    const historyKey = `${move.piece}_${move.from[0]}_${move.from[1]}_${move.to[0]}_${move.to[1]}`;
    if (historyTable[historyKey]) {
        priority += historyTable[historyKey];
    }
    return priority;
};

const sortMoves = (moves, boardState, depth) => {
    return moves.sort((a, b) => {
        const aScore = getMovePriority(a, boardState, depth);
        const bScore = getMovePriority(b, boardState, depth);
        return bScore - aScore;
    });
};

// 가능한 모든 이동 생성 (재귀 방지)
const getPossibleMoves = (boardState, color) => {
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((color === 'white' && piece === piece.toUpperCase()) ||
                          (color === 'black' && piece === piece.toLowerCase()))) {
                const validMoves = getValidMoves(piece, row, col, boardState, true); // 캐슬링 체크 생략
                validMoves.forEach(move => {
                    moves.push({ from: [row, col], to: move, piece });
                });
            }
        }
    }
    return moves;
};

// 수정된 isSquareAttacked
const isSquareAttacked = (row, col, byColor, boardState) => {
    const opponentColor = byColor === 'white' ? 'black' : 'white';
    const opponentMoves = getPossibleMoves(boardState, opponentColor);

    return opponentMoves.some(move => {
        const [toRow, toCol] = move.to;
        const [fromRow, fromCol] = move.from;
        const piece = move.piece;

        // 폰의 직진 이동은 공격으로 간주하지 않음
        if (piece.toUpperCase() === 'P' && toCol === fromCol) {
            return false; // 직진 이동 제외
        }

        return toRow === row && toCol === col;
    });
};

// 킹의 위치 찾기
const findKing = (color, boardState) => {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.toUpperCase() === 'K' && 
                ((color === 'white' && piece === piece.toUpperCase()) || 
                 (color === 'black' && piece === piece.toLowerCase()))) {
                return [row, col];
            }
        }
    }
    return null;
};

// 체크 상태 확인
const isInCheck = (color, boardState) => {
    const kingPos = findKing(color, boardState);
    if (!kingPos) return false;
    const [kingRow, kingCol] = kingPos;
    return isSquareAttacked(kingRow, kingCol, color, boardState);
};

// 특정 이동이 유효한지 확인
const isMoveValid = (fromRow, fromCol, toRow, toCol, piece, color, boardState) => {
    if (!piece) return false;

    const newBoard = boardState.map(row => [...row]);
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = null;

    const inCheck = isInCheck(color, newBoard);
    //console.log(`Move ${fromRow},${fromCol} -> ${toRow},${toCol}: inCheck = ${inCheck}`);

    if (inCheck) return false;

    if (piece.toUpperCase() === 'K') {
        const attacked = isSquareAttacked(toRow, toCol, color, boardState);
        //console.log(`King move to ${toRow},${toCol}: attacked = ${attacked}`);
        if (attacked) return false;
    }

    return true;
};

// 가능한 모든 유효한 이동 생성
const getLegalMoves = (boardState, color) => {
    const moves = getPossibleMoves(boardState, color);
    const legalMoves = [];
    for (const move of moves) {
        if (isMoveValid(move.from[0], move.from[1], move.to[0], move.to[1], move.piece, color, boardState)) {
            legalMoves.push(move);
        }
    }
    return legalMoves;
};

// 가능한 이동 표시
const highlightValidMoves = (piece, row, col) => {
    clearHighlightedMoves();
    const boardState = getBoardState();
    const moves = getValidMoves(piece, row, col, boardState);
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    moves.forEach(([r, c, special]) => {
        if (isMoveValid(row, col, r, c, piece, color, boardState)) {
            const cell = getCell(r, c);
            if (cell) {
                cell.classList.add('highlight');
                highlightedCells.push(cell);
            }
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
    if (gameOver) return;

    if (selectedStorageCell) {
        if (!cell.firstChild) {
            const pieceToPlace = selectedStorageCell.firstChild;
            if (pieceToPlace) {
                cell.appendChild(pieceToPlace);
                selectedStorageCell.textContent = '';
                clearStorageSelection();
            }
        } else {
            clearStorageSelection();
        }
        return;
    }

    const targetPiece = cell.firstChild ? cell.firstChild.dataset.piece : null;
    if (selectedCell) {
        const fromRow = parseInt(selectedCell.dataset.row);
        const fromCol = parseInt(selectedCell.dataset.col);
        const toRow = parseInt(cell.dataset.row);
        const toCol = parseInt(cell.dataset.col);
        const piece = selectedCell.firstChild ? selectedCell.firstChild.dataset.piece : null;
        const boardState = getBoardState();
        const color = currentTurn;

        if (!piece) {
            console.error('handleCellClick: No piece in selectedCell', { selectedCell });
            clearSelection();
            clearHighlightedMoves();
            return;
        }

        const validMoves = getValidMoves(piece, fromRow, fromCol, boardState);
        const targetMove = validMoves.find(([r, c, special]) => r === toRow && c === toCol);
        if (targetMove && isMoveValid(fromRow, fromCol, toRow, toCol, piece, color, boardState)) {
            movePiece(cell, targetMove[2]); // 특수 이동 플래그 전달
        }
        clearSelection();
        clearHighlightedMoves();
    } else if (targetPiece && ((currentTurn === 'white' && targetPiece === targetPiece.toUpperCase()) ||
                              (currentTurn === 'black' && targetPiece === targetPiece.toLowerCase()))) {
        selectPiece(cell);
        highlightValidMoves(targetPiece, parseInt(cell.dataset.row), parseInt(cell.dataset.col));
    }
};

// 클릭 핸들러 (보관소 셀)
const handleStorageCellClick = (cell) => {
    if (gameOver) return;
    if (selectedStorageCell === cell) {
        clearStorageSelection();
        return;
    }
    if (selectedStorageCell) {
        clearStorageSelection();
    }
    if (cell.firstChild) {
        selectStorageCell(cell);
    }
};

// 기물 선택 (체스판)
const selectPiece = (cell) => {
    selectedCell = cell;
    cell.classList.add('selected');
};

// 기물 선택 (보관소)
const selectStorageCell = (cell) => {
    selectedStorageCell = cell;
    cell.classList.add('selected');
};

// 기물 이동 (캐슬링과 앙파상 처리)
const movePiece = (targetCell, specialMove = null) => {
    if (!selectedCell || selectedCell === targetCell) {
        clearSelection();
        return;
    }

    const fromRow = parseInt(selectedCell.dataset.row);
    const fromCol = parseInt(selectedCell.dataset.col);
    const toRow = parseInt(targetCell.dataset.row);
    const toCol = parseInt(targetCell.dataset.col);

    const piece = selectedCell.firstChild.dataset.piece;
    let capturedPiece = targetCell.firstChild ? targetCell.firstChild.dataset.piece : null;

    if (targetCell.firstChild && specialMove !== 'enPassant') {
        const capturedPieceColor = capturedPiece === capturedPiece.toUpperCase() ? 'white' : 'black';
        const storage = capturedPieceColor === 'white' ? whiteCapturedStorage : blackCapturedStorage;
        const emptyStorageCell = storage.querySelector('.storage-cell:not(:has(*))');
        if (emptyStorageCell) {
            emptyStorageCell.appendChild(targetCell.firstChild);
        } else {
            targetCell.removeChild(targetCell.firstChild);
        }
    }

    if (specialMove === 'castling') {
        targetCell.appendChild(selectedCell.firstChild);
        const isWhite = piece === 'K';
        const rookFromCol = toCol === 6 ? 7 : 0;
        const rookToCol = toCol === 6 ? 5 : 3;
        const rookCell = getCell(fromRow, rookFromCol);
        const rookTargetCell = getCell(toRow, rookToCol);
        rookTargetCell.appendChild(rookCell.firstChild);
        updateInternalBoardState(fromRow, fromCol, toRow, toCol, piece);
        updateInternalBoardState(fromRow, rookFromCol, toRow, rookToCol, isWhite ? 'R' : 'r');
    } else if (specialMove === 'enPassant') {
        targetCell.appendChild(selectedCell.firstChild);
        const capturedPawnCell = getCell(fromRow, toCol);
        capturedPiece = capturedPawnCell.firstChild.dataset.piece;
        const capturedPieceColor = capturedPiece === capturedPiece.toUpperCase() ? 'white' : 'black';
        const storage = capturedPieceColor === 'white' ? whiteCapturedStorage : blackCapturedStorage;
        const emptyStorageCell = storage.querySelector('.storage-cell:not(:has(*))');
        if (emptyStorageCell) {
            emptyStorageCell.appendChild(capturedPawnCell.firstChild);
        } else {
            capturedPawnCell.removeChild(capturedPawnCell.firstChild);
        }
        updateInternalBoardState(fromRow, fromCol, toRow, toCol, piece, { special: 'enPassant' });
    } else {
        targetCell.appendChild(selectedCell.firstChild);
        updateInternalBoardState(fromRow, fromCol, toRow, toCol, piece);
    }

    moveHistory.push({ from: { dataset: { row: fromRow, col: fromCol }, piece }, to: targetCell });

    checkPromotion(targetCell);
    clearSelection();

    const opponentColor = currentTurn === 'white' ? 'black' : 'white';
    if (isInCheck(opponentColor, internalBoardState)) {
        statusDisplay.style.display = 'block';
        statusDisplay.textContent = `${opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)} is in check!`;
    } else {
        statusDisplay.style.display = 'none';
    }

    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    if (currentTurn === 'black' && !gameOver) {
        setTimeout(aiMove, 500);
    }
};

// 폰 승급 체크
const checkPromotion = (cell) => {
    const piece = cell.firstChild;
    if (!piece) return;

    const row = parseInt(cell.dataset.row);
    const isWhitePawn = piece.dataset.piece === 'P' && row === 0;
    const isBlackPawn = piece.dataset.piece === 'p' && row === 7;

    if (isWhitePawn || isBlackPawn) {
        openPromotionPopup(cell, isWhitePawn ? 'white' : 'black');
    }
};

// 승급 팝업 창
const openPromotionPopup = (cell, color) => {
    const promotionPieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    const popup = document.createElement('div');
    popup.classList.add('promotion-popup');

    const message = document.createElement('p');
    message.textContent = '승급할 기물을 선택하세요';
    popup.appendChild(message);

    promotionPieces.forEach((piece) => {
        const pieceElem = createPiece(piece);
        pieceElem.addEventListener('click', () => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            cell.removeChild(cell.firstChild);
            cell.appendChild(createPiece(piece));
            internalBoardState[row][col] = piece; // internalBoardState 업데이트
            document.body.removeChild(popup);

            const opponentColor = currentTurn === 'white' ? 'black' : 'white';
            if (isInCheck(opponentColor, internalBoardState)) {
                statusDisplay.style.display = 'block';
                statusDisplay.textContent = `${opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)} is in check!`;
            } else {
                statusDisplay.style.display = 'none';
            }

            currentTurn = currentTurn === 'white' ? 'black' : 'white';
            if (currentTurn === 'black' && !gameOver) {
                setTimeout(aiMove, 500);
            }
        });
        popup.appendChild(pieceElem);
    });

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

// 게임 초기화 (첫 턴 전환 로직 추가)
const resetGame = () => {
    createBoard();
    initPieces();
    initStorageAreas();
    initInternalBoardState();
    moveHistory = [];
    clearStorageSelection();
    gameOver = false;
    clearHighlightedMoves();
    statusDisplay.style.display = 'none';
    statusDisplay.textContent = 'AI Thinking...';

    // 첫 턴을 이전 게임과 반대로 설정
    currentTurn = lastFirstTurn === 'white' ? 'black' : 'white';
    lastFirstTurn = currentTurn; // 다음 리셋을 위해 저장
    console.log(`Game reset: First turn is ${currentTurn}`);

    // 첫 턴이 흑이면 AI 즉시 실행
    if (currentTurn === 'black' && !gameOver) {
        setTimeout(aiMove, 500);
    }
};

const evaluateBoard = (boardState) => {
    let score = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const pieceValue = pieceValues[piece];
                const isWhite = piece === piece.toUpperCase();
                let positionBonus = 0;
                if (piece.toUpperCase() === 'P') {
                    positionBonus = isWhite ? pawnPositionValues[row][col] : pawnPositionValues[7 - row][col];
                }
                score += isWhite ? -pieceValue : pieceValue;
                score += isWhite ? -positionBonus : positionBonus;
            }
        }
    }

    if (isInCheck('white', boardState)) score += 5;
    if (isInCheck('black', boardState)) score -= 5;

    const whiteThreats = getPossibleMoves(boardState, 'white');
    const blackThreats = getPossibleMoves(boardState, 'black');
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const isWhite = piece === piece.toUpperCase();
                const opponentThreats = isWhite ? blackThreats : whiteThreats;
                const isThreatened = opponentThreats.some(move => move.to[0] === row && move.to[1] === col);
                if (isThreatened) {
                    const threatPenalty = pieceValues[piece] * 0.5;
                    score += isWhite ? threatPenalty : -threatPenalty;
                }
            }
        }
    }

    score += evaluateOpenFiles(boardState, 'black');
    score += evaluateOpenFiles(boardState, 'white');
    score += evaluateCenterControl(boardState, 'black');
    score += evaluateCenterControl(boardState, 'white');
    score += evaluatePiecePairs(boardState, 'black');
    score += evaluatePiecePairs(boardState, 'white');
    score += evaluatePassedPawns(boardState, 'black');
    score += evaluatePassedPawns(boardState, 'white');

    return score;
};

const evaluatePieceActivity = (boardState, color) => {
    let activityScore = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((color === 'black' && piece === piece.toLowerCase()) || 
                          (color === 'white' && piece === piece.toUpperCase()))) {
                if (piece.toUpperCase() !== 'P' && piece.toUpperCase() !== 'K') {
                    const moves = getValidMoves(piece, row, col, boardState);
                    const moveCount = moves.length;
                    activityScore += Math.min(moveCount * 0.1, 2);
                }
            }
        }
    }
    return color === 'black' ? activityScore : -activityScore;
};

const evaluatePawnStructure = (boardState, color) => {
    let pawnScore = 0;
    const pawns = Array(8).fill(0);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.toUpperCase() === 'P' && 
                ((color === 'black' && piece === 'p') || (color === 'white' && piece === 'P'))) {
                pawns[col]++;
            }
        }
    }

    for (let col = 0; col < 8; col++) {
        if (pawns[col] > 0) {
            const left = col > 0 ? pawns[col - 1] : 0;
            const right = col < 7 ? pawns[col + 1] : 0;
            if (left > 0 || right > 0) {
                pawnScore += 0.5 * pawns[col];
            }
            if (left === 0 && right === 0) {
                pawnScore -= 0.5 * pawns[col];
            }
            if (pawns[col] > 1) {
                pawnScore -= 0.5 * (pawns[col] - 1);
            }
        }
    }

    return color === 'black' ? pawnScore : -pawnScore;
};

const evaluateKingSafety = (boardState, color) => {
    let safetyScore = 0;
    const kingPiece = color === 'black' ? 'k' : 'K';
    let kingRow, kingCol;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (boardState[row][col] === kingPiece) {
                kingRow = row;
                kingCol = col;
                break;
            }
        }
    }

    const direction = color === 'black' ? 1 : -1;
    for (let dr = 0; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = kingRow + dr * direction;
            const c = kingCol + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = boardState[r][c];
                if (piece && piece.toUpperCase() === 'P' && 
                    ((color === 'black' && piece === 'p') || (color === 'white' && piece === 'P'))) {
                    safetyScore += 1;
                }
            }
        }
    }

    const opponentColor = color === 'black' ? 'white' : 'black';
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            const r = kingRow + dr;
            const c = kingCol + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = boardState[r][c];
                if (piece && ((opponentColor === 'white' && piece === piece.toUpperCase()) || 
                              (opponentColor === 'black' && piece === piece.toLowerCase()))) {
                    safetyScore -= pieceValues[piece] * 0.2;
                }
            }
        }
    }

    let openFile = true;
    for (let r = 0; r < 8; r++) {
        if (boardState[r][kingCol] && boardState[r][kingCol].toUpperCase() === 'P') {
            openFile = false;
            break;
        }
    }
    if (openFile) safetyScore -= 1;

    return color === 'black' ? safetyScore : -safetyScore;
};

const evaluateBackupSupport = (boardState, color) => {
    let backupScore = 0;
    const myColor = color === 'black' ? 'black' : 'white';
    const opponentColor = color === 'black' ? 'white' : 'black';

    const myMoves = getPossibleMoves(boardState, myColor);
    const opponentThreats = getPossibleMoves(boardState, opponentColor);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((myColor === 'black' && piece === piece.toLowerCase()) || 
                          (myColor === 'white' && piece === piece.toUpperCase()))) {
                const isThreatened = opponentThreats.some(move => move.to[0] === row && move.to[1] === col);
                if (isThreatened) {
                    const backupCount = myMoves.filter(move => 
                        move.to[0] === row && move.to[1] === col && 
                        move.piece !== piece
                    ).length;
                    if (backupCount > 0) {
                        const pieceValue = pieceValues[piece];
                        const bonusPerBackup = pieceValue * 0.2;
                        const totalBonus = Math.min(bonusPerBackup * backupCount, pieceValue * 0.5);
                        backupScore += totalBonus;
                    }
                }
            }
        }
    }

    return color === 'black' ? backupScore : -backupScore;
};

const evaluateOpenFiles = (boardState, color) => {
    let fileScore = 0;
    const pawnCounts = Array(8).fill(0).map(() => ({ white: 0, black: 0 }));

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.toUpperCase() === 'P') {
                if (piece === 'P') pawnCounts[col].white++;
                else pawnCounts[col].black++;
            }
        }
    }

    for (let col = 0; col < 8; col++) {
        const isOpen = pawnCounts[col].white === 0 && pawnCounts[col].black === 0;
        const isSemiOpen = (color === 'black' && pawnCounts[col].black === 0 && pawnCounts[col].white > 0) ||
                           (color === 'white' && pawnCounts[col].white === 0 && pawnCounts[col].black > 0);

        for (let row = 0; row < 8; row++) {
            const piece = boardState[row][col];
            if (piece && ((color === 'black' && piece === piece.toLowerCase()) || 
                          (color === 'white' && piece === piece.toUpperCase()))) {
                if (piece.toUpperCase() === 'R') {
                    if (isOpen) fileScore += 0.5;
                    else if (isSemiOpen) fileScore += 0.25;
                } else if (piece.toUpperCase() === 'Q' && isOpen) {
                    fileScore += 0.3;
                }
            }
        }
    }

    return color === 'black' ? fileScore : -fileScore;
};

const evaluateCenterControl = (boardState, color) => {
    let centerScore = 0;
    const centerSquares = [[3, 3], [3, 4], [4, 3], [4, 4]];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((color === 'black' && piece === piece.toLowerCase()) || 
                          (color === 'white' && piece === piece.toUpperCase()))) {
                const moves = getValidMoves(piece, row, col, boardState);
                if (centerSquares.some(([r, c]) => r === row && c === col)) {
                    if (piece.toUpperCase() === 'P') centerScore += 0.5;
                    else if (piece.toUpperCase() === 'N' || piece.toUpperCase() === 'B') centerScore += 0.3;
                }
                const controlCount = moves.filter(move => 
                    centerSquares.some(([r, c]) => r === move[0] && c === move[1])
                ).length;
                centerScore += controlCount * 0.1;
            }
        }
    }

    return color === 'black' ? centerScore : -centerScore;
};

const evaluatePiecePairs = (boardState, color) => {
    let pairScore = 0;
    let bishopCount = 0, knightCount = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && ((color === 'black' && piece === piece.toLowerCase()) || 
                          (color === 'white' && piece === piece.toUpperCase()))) {
                if (piece.toUpperCase() === 'B') bishopCount++;
                else if (piece.toUpperCase() === 'N') knightCount++;
            }
        }
    }

    if (bishopCount >= 2) pairScore += 0.5;
    if (knightCount >= 2) pairScore += 0.3;

    return color === 'black' ? pairScore : -pairScore;
};

const evaluatePassedPawns = (boardState, color) => {
    let passedScore = 0;
    const pawnDirection = color === 'black' ? 1 : -1;
    const kingPiece = color === 'black' ? 'k' : 'K';
    let kingRow, kingCol;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (boardState[row][col] === kingPiece) {
                kingRow = row;
                kingCol = col;
                break;
            }
        }
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece && piece.toUpperCase() === 'P' && 
                ((color === 'black' && piece === 'p') || (color === 'white' && piece === 'P'))) {
                let isPassed = true;
                for (let r = row + pawnDirection; r >= 0 && r < 8; r += pawnDirection) {
                    if (boardState[r][col] || (col > 0 && boardState[r][col - 1]) || 
                        (col < 7 && boardState[r][col + 1])) {
                        isPassed = false;
                        break;
                    }
                }
                if (isPassed) {
                    const baseScore = 1 + (color === 'black' ? row / 6 : (7 - row) / 6) * 0.5;
                    const kingDistance = Math.max(Math.abs(row - kingRow), Math.abs(col - kingCol));
                    passedScore += baseScore + (8 - kingDistance) * 0.2;
                }
            }
        }
    }

    return color === 'black' ? passedScore : -passedScore;
};

const evaluateThreatRemovalBonus = (boardState, move) => {
    let bonus = 0;
    const { from, to, piece } = move;
    const isWhite = piece === piece.toUpperCase();
    const opponentColor = isWhite ? 'black' : 'white';

    const opponentMovesBefore = getPossibleMoves(boardState, opponentColor);
    const newBoard = boardState.map(row => [...row]);
    const capturedPiece = newBoard[to[0]][to[1]];
    newBoard[to[0]][to[1]] = piece;
    newBoard[from[0]][from[1]] = null;
    const opponentMovesAfter = getPossibleMoves(newBoard, opponentColor);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const myPiece = boardState[row][col];
            if (myPiece && (myPiece === myPiece.toUpperCase()) !== isWhite) {
                const wasThreatened = opponentMovesBefore.some(m => m.to[0] === row && m.to[1] === col);
                const isThreatened = opponentMovesAfter.some(m => m.to[0] === row && m.to[1] === col);
                if (wasThreatened && !isThreatened) {
                    const protectedValue = pieceValues[myPiece];
                    bonus += protectedValue * 0.5;
                }
            }
        }
    }

    if (capturedPiece) {
        const captureValue = pieceValues[capturedPiece];
        bonus += captureValue + 1;
    }

    return isWhite ? -bonus : bonus;
};

const alphaBeta = (boardState, depth, alpha, beta, maximizingPlayer) => {
    const hash = computeZobristHash(boardState);
    if (transpositionTable.has(hash)) {
        const entry = transpositionTable.get(hash);
        if (entry.depth >= depth) {
            return entry.score;
        }
    }

    if (depth === 0) return evaluateBoard(boardState);

    const color = maximizingPlayer ? 'black' : 'white';
    let legalMoves = getLegalMoves(boardState, color);
    legalMoves = sortMoves(legalMoves, boardState);

    if (legalMoves.length === 0) {
        return evaluateBoard(boardState);
    }

    let score;
    if (maximizingPlayer) {
        score = -Infinity;
        for (const move of legalMoves) {
            const newBoard = boardState.map(row => [...row]);
            newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
            newBoard[move.from[0]][move.from[1]] = null;

            const evalScore = alphaBeta(newBoard, depth - 1, alpha, beta, false);
            score = Math.max(score, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
    } else {
        score = Infinity;
        for (const move of legalMoves) {
            const newBoard = boardState.map(row => [...row]);
            newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
            newBoard[move.from[0]][move.from[1]] = null;

            const evalScore = alphaBeta(newBoard, depth - 1, alpha, beta, true);
            score = Math.min(score, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
    }

    transpositionTable.set(hash, { depth, score });
    return score;
};

const aiMove = () => {
    if (gameOver) return;

    statusDisplay.style.display = 'block';
    statusDisplay.textContent = 'AI Thinking...';

    const legalMoves = getLegalMoves(internalBoardState, 'black');
    if (legalMoves.length === 0) {
        statusDisplay.style.display = 'block';
        statusDisplay.textContent = 'AI has no legal moves!';
        return;
    }

    // 이동별 점수를 저장할 배열
    const moveScores = [];

    // 모든 가능한 이동 평가
    for (const move of legalMoves) {
        const newBoard = internalBoardState.map(row => [...row]);
        const capturedPiece = newBoard[move.to[0]][move.to[1]];
        newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
        newBoard[move.from[0]][move.from[1]] = null;

        const score = alphaBeta(newBoard, 2, -Infinity, Infinity, false);
        console.log(`Move [${move.from}] -> [${move.to}] with piece ${move.piece}, Score: ${score}${capturedPiece ? ` (Captures ${capturedPiece})` : ''}`);
        moveScores.push({ move, score, capturedPiece });
    }

    // 점수 기준으로 정렬 (내림차순, 높은 점수가 위로)
    moveScores.sort((a, b) => b.score - a.score);

    // 상위 N개(예: 1개) 선택, 초기 몇 수에만 적용
    const N = moveHistory.length < 4 ? 1 : 1;
    const topMoves = moveScores.slice(0, Math.min(N, moveScores.length));

    // 상위 이동 중 랜덤 선택
    const selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];

    if (selectedMove) {
        console.log(`AI chose move [${selectedMove.move.from}] -> [${selectedMove.move.to}] with score ${selectedMove.score}`);
        const fromCell = document.querySelector(`.cell[data-row="${selectedMove.move.from[0]}"][data-col="${selectedMove.move.from[1]}"]`);
        const toCell = document.querySelector(`.cell[data-row="${selectedMove.move.to[0]}"][data-col="${selectedMove.move.to[1]}"]`);
        selectedCell = fromCell;
        movePiece(toCell, selectedMove.move.to[2]);
    } else {
        statusDisplay.style.display = 'block';
        statusDisplay.textContent = 'AI has no legal moves!';
    }
};

resetButton.addEventListener('click', resetGame);
resetGame();
