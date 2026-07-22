 const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const statusElement = document.getElementById('status');

// Parametri Griglia
const rows = 15;
const cols = 15;
const cellSize = 30; // Dimensione cella in pixel

canvas.width = cols * cellSize;
canvas.height = rows * cellSize;

let grid = [];
let player = { x: 0, y: 0 };
let enemy = { x: cols - 1, y: rows - 1 };
let goal = { x: cols - 1, y: rows - 1 };

let timeLeft = 80;
let timerInterval = null;
let gameLoopInterval = null;
let gameOver = false;

// Struttura Cella per Recursive Backtracker
class Cell {
    constructor(r, c) {
        this.r = r;
        this.c = c;
        // Muri: [Nord, Est, Sud, Ovest]
        this.walls = [true, true, true, true];
        this.visited = false;
    }
}

// 1. GENERAZIONE LABIRINTO (con Vie Alternative e Scorciatoie)
function generateMaze() {
    grid = [];
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < cols; c++) {
            row.push(new Cell(r, c));
        }
        grid.push(row);
    }

    let stack = [];
    let current = grid[0][0];
    current.visited = true;

    // FASE A: Generazione base (Recursive Backtracker)
    do {
        let next = getUnvisitedNeighbor(current);
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        }
    } while (stack.length > 0);

    // FASE B: Creazione di percorsi alternativi (Abbattimento muri extra)
    let extraPaths = Math.floor((rows * cols) * 0.15); // Rimuove ~15% dei muri interni
    
    for (let i = 0; i < extraPaths; i++) {
        let randomRow = Math.floor(Math.random() * (rows - 2)) + 1;
        let randomCol = Math.floor(Math.random() * (cols - 2)) + 1;
        let cellA = grid[randomRow][randomCol];

        if (Math.random() > 0.5 && randomRow < rows - 1) {
            let cellB = grid[randomRow + 1][randomCol];
            removeWalls(cellA, cellB);
        } else if (randomCol < cols - 1) {
            let cellB = grid[randomRow][randomCol + 1];
            removeWalls(cellA, cellB);
        }
    }
}

function getUnvisitedNeighbor(cell) {
    let neighbors = [];
    let { r, c } = cell;

    if (r > 0 && !grid[r - 1][c].visited) neighbors.push(grid[r - 1][c]);
    if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push(grid[r][c + 1]);
    if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push(grid[r + 1][c]);
    if (c > 0 && !grid[r][c - 1].visited) neighbors.push(grid[r][c - 1]);

    if (neighbors.length > 0) {
        let randIndex = Math.floor(Math.random() * neighbors.length);
        return neighbors[randIndex];
    }
    return undefined;
}

function removeWalls(a, b) {
    let x = a.c - b.c;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }

    let y = a.r - b.r;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

// 2. PATHFINDING NEMICO (BFS per percorso più breve)
function getPathToPlayer() {
    let queue = [[ { x: enemy.x, y: enemy.y } ]];
    let visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    visited[enemy.y][enemy.x] = true;

    while (queue.length > 0) {
        let path = queue.shift();
        let curr = path[path.length - 1];

        if (curr.x === player.x && curr.y === player.y) {
            return path;
        }

        let cell = grid[curr.y][curr.x];
        let moves = [
            { dx: 0, dy: -1, wall: 0 }, // Nord
            { dx: 1, dy: 0, wall: 1 },  // Est
            { dx: 0, dy: 1, wall: 2 },  // Sud
            { dx: -1, dy: 0, wall: 3 }  // Ovest
        ];

        for (let move of moves) {
            if (!cell.walls[move.wall]) {
                let nx = curr.x + move.dx;
                let ny = curr.y + move.dy;

                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push([...path, { x: nx, y: ny }]);
                }
            }
        }
    }
    return [];
}

function moveEnemy() {
    if (gameOver) return;

    let path = getPathToPlayer();
    // Il nemico avanza inseguendo lungo il percorso calcolato
    let stepsToMove = Math.floor((path.length - 1) / 2);

    if (stepsToMove > 0 && path[1]) {
        enemy.x = path[1].x;
        enemy.y = path[1].y;
    }

    checkCollision();
    draw();
}

// 3. LOGICA GIOCATORE E CONTROLLI
function movePlayer(dir) {
    if (gameOver) return;

    let cell = grid[player.y][player.x];
    if (dir === 'UP' && !cell.walls[0]) player.y--;
    if (dir === 'RIGHT' && !cell.walls[1]) player.x++;
    if (dir === 'DOWN' && !cell.walls[2]) player.y++;
    if (dir === 'LEFT' && !cell.walls[3]) player.x--;

    checkCollision();
    draw();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') movePlayer('UP');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movePlayer('RIGHT');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') movePlayer('DOWN');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movePlayer('LEFT');
});

// 4. VERIFICA VITTORIA / SCONFITTA
function checkCollision() {
    if (player.x === enemy.x && player.y === enemy.y) {
        endGame("CATTURATO! Il nemico ti ha preso.", "#ff2e63");
    } else if (player.x === goal.x && player.y === goal.y) {
        endGame("VITTORIA! Sei fuggito dal labirinto!", "#00adb5");
    }
}

function endGame(message, color) {
    gameOver = true;
    statusElement.innerText = message;
    statusElement.style.color = color;
    clearInterval(timerInterval);
    clearInterval(gameLoopInterval);
}

// 5. RENDERING GRAFICO
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disegna Muri Labirinto
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let x = c * cellSize;
            let y = r * cellSize;
            let cell = grid[r][c];

            if (cell.walls[0]) drawLine(x, y, x + cellSize, y);
            if (cell.walls[1]) drawLine(x + cellSize, y, x + cellSize, y + cellSize);
            if (cell.walls[2]) drawLine(x + cellSize, y + cellSize, x, y + cellSize);
            if (cell.walls[3]) drawLine(x, y + cellSize, x, y);
        }
    }

    // Disegna Arrivo (Verde)
    ctx.fillStyle = "#00adb5";
    ctx.fillRect(goal.x * cellSize + 4, goal.y * cellSize + 4, cellSize - 8, cellSize - 8);

    // Disegna Nemico (Rosso)
    ctx.fillStyle = "#ff2e63";
    ctx.beginPath();
    ctx.arc(enemy.x * cellSize + cellSize / 2, enemy.y * cellSize + cellSize / 2, cellSize / 3, 0, Math.PI * 2);
    ctx.fill();

    // Disegna Giocatore (Giallo)
    ctx.fillStyle = "#f9ed69";
    ctx.beginPath();
    ctx.arc(player.x * cellSize + cellSize / 2, player.y * cellSize + cellSize / 2, cellSize / 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// 6. GESTIONE TIMER E CAMBIO LABIRINTO (80s)
function startTimer() {
    timeLeft = 80;
    timerElement.innerText = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerElement.innerText = timeLeft;

        if (timeLeft <= 0) {
            generateMaze();
            timeLeft = 80;
            statusElement.innerText = "IL LABIRINTO È CAMBIATO!";
            setTimeout(() => {
                if (!gameOver) statusElement.innerText = "Raggiungi l'uscita verde!";
            }, 2000);
            draw();
        }
    }, 1000);
}

// INIZIALIZZAZIONE GIOCO
function init() {
    generateMaze();
    player = { x: 0, y: 0 };
    enemy = { x: cols - 1, y: rows - 1 };
    goal = { x: cols - 1, y: rows - 1 };
    gameOver = false;

    startTimer();
    // Il nemico si muove ogni 600 ms
    gameLoopInterval = setInterval(moveEnemy, 600);
    draw();
}

init();
