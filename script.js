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

// CARICAMENTO IMMAGINI
let goalLoaded = false;
const imgGoal = new Image();
imgGoal.src = 'arrivo.png';
imgGoal.onload = () => {
    goalLoaded = true;
    if (grid.length > 0) draw();
};
imgGoal.onerror = () => console.error("Errore: Impossibile caricare 'arrivo.png'");

let playerLoaded = false;
const imgPlayer = new Image();
imgPlayer.src = 'giocatore.webp';
imgPlayer.onload = () => {
    playerLoaded = true;
    if (grid.length > 0) draw();
};
imgPlayer.onerror = () => console.error("Errore: Impossibile caricare 'giocatore.webp'");

let enemyLoaded = false;
const imgEnemy = new Image();
imgEnemy.src = 'nemico.webp';
imgEnemy.onload = () => {
    enemyLoaded = true;
    if (grid.length > 0) draw();
};
imgEnemy.onerror = () => console.error("Errore: Impossibile caricare 'nemico.webp'");

let grid = [];
let player = { x: 0, y: 0 };
let playerAngle = 0; // Rotazione progressiva per "rotolare"

let enemy = { x: cols - 1, y: rows - 1 };
let enemyAngle = Math.PI * 0.5; // Angolo direzionale del nemico

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
        this.walls = [true, true, true, true];
        this.visited = false;
    }
}

// 1. FUNZIONI DI SUPPORTO PER IL LABIRINTO
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

// 2. GENERAZIONE LABIRINTO (con Vie Alternative)
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

    let extraPaths = Math.floor((rows * cols) * 0.15);
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

// 3. PATHFINDING NEMICO (BFS) CON ORIENTAMENTO CORRETTO
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
            { dx: 0, dy: -1, wall: 0 },
            { dx: 1, dy: 0, wall: 1 },
            { dx: 0, dy: 1, wall: 2 },
            { dx: -1, dy: 0, wall: 3 }
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

    if (path.length > 1 && path[1]) {
        let nextX = path[1].x;
        let nextY = path[1].y;

        // Nemico: orienta la testa verso la direzione di movimento
        if (nextX > enemy.x) enemyAngle = Math.PI;             // Destra
        else if (nextX < enemy.x) enemyAngle = 0;              // Sinistra
        else if (nextY > enemy.y) enemyAngle = Math.PI * 1.5;  // Basso
        else if (nextY < enemy.y) enemyAngle = Math.PI * 0.5;  // Alto

        enemy.x = nextX;
        enemy.y = nextY;
    }

    checkCollision();
    draw();
}

// 4. MOVIMENTO GIOCATORE CON EFFETTO "ROTOLAMENTO"
function movePlayer(dir) {
    if (gameOver) return;

    let cell = grid[player.y][player.x];
    let moved = false;

    if (dir === 'UP' && !cell.walls[0]) {
        player.y--;
        moved = true;
    }
    if (dir === 'RIGHT' && !cell.walls[1]) {
        player.x++;
        moved = true;
    }
    if (dir === 'DOWN' && !cell.walls[2]) {
        player.y++;
        moved = true;
    }
    if (dir === 'LEFT' && !cell.walls[3]) {
        player.x--;
        moved = true;
    }

    // Se si è mosso, ruota l'immagine ad ogni passo per simularne il rotolamento
    if (moved) {
        playerAngle += Math.PI * 0.5; // Ruota continuamente di 90°
    }

    checkCollision();
    draw();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') movePlayer('UP');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movePlayer('RIGHT');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') movePlayer('DOWN');
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movePlayer('LEFT');
});

// 5. CONTROLLO COLLISIONI E VITTORIA
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

// 6. GRAFICA E DISEGNO
function draw() {
    // 1. SFONDO
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if ((r + c) % 2 === 0) {
                ctx.fillStyle = "#335124";
            } else {
                ctx.fillStyle = "#3a5a29";
            }
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
    }

    // 2. MURI
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let x = c * cellSize;
            let y = r * cellSize;
            let cell = grid[r][c];

            if (cell.walls[0]) drawProceduralHedge(x, y, x + cellSize, y);
            if (cell.walls[1]) drawProceduralHedge(x + cellSize, y, x + cellSize, y + cellSize);
            if (cell.walls[2]) drawProceduralHedge(x + cellSize, y + cellSize, x, y + cellSize);
            if (cell.walls[3]) drawProceduralHedge(x, y + cellSize, x, y);
        }
    }

    // 3. USCITA
    if (goalLoaded) {
        ctx.drawImage(imgGoal, goal.x * cellSize + 2, goal.y * cellSize + 2, cellSize - 4, cellSize - 4);
    } else {
        ctx.fillStyle = "#00adb5";
        ctx.fillRect(goal.x * cellSize + 4, goal.y * cellSize + 4, cellSize - 8, cellSize - 8);
    }

    // 4. NEMICO CON ROTAZIONE DIREZIONALE
    let ex = enemy.x * cellSize + cellSize / 2;
    let ey = enemy.y * cellSize + cellSize / 2;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(enemyAngle);

    if (enemyLoaded) {
        ctx.drawImage(imgEnemy, -(cellSize - 4) / 2, -(cellSize - 4) / 2, cellSize - 4, cellSize - 4);
    } else {
        ctx.fillStyle = "#ff2e63";
        ctx.beginPath();
        ctx.arc(0, 0, cellSize / 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // 5. GIOCATORE CHE ROTOLA
    let px = player.x * cellSize + cellSize / 2;
    let py = player.y * cellSize + cellSize / 2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(playerAngle); // Ruota in continuo ad ogni passo

    if (playerLoaded) {
        ctx.drawImage(imgPlayer, -(cellSize - 4) / 2, -(cellSize - 4) / 2, cellSize - 4, cellSize - 4);
    } else {
        ctx.fillStyle = "#9b59b6";
        ctx.fillRect(-(cellSize - 8) / 2, -(cellSize - 8) / 2, cellSize - 8, cellSize - 8);
    }
    ctx.restore();
}

function drawProceduralHedge(x1, y1, x2, y2) {
    const thickness = 12; 
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    ctx.fillStyle = '#11240e'; 
    ctx.fillRect(0, -thickness / 2, length, thickness);

    for (let i = 0; i <= length; i += 4) {
        let offsetY = Math.sin(i * 0.7) * 2.5; 
        
        ctx.fillStyle = '#204519';
        ctx.beginPath();
        ctx.arc(i, offsetY, thickness * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#346b2a';
        ctx.beginPath();
        ctx.arc(i - 1.5, offsetY - 1.5, thickness * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// 7. TIMER
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
                if (!gameOver) statusElement.innerText = "Raggiungi l'uscita!";
            }, 2000);
            draw();
        }
    }, 1000);
}

// 8. AVVIO DEL GIOCO
function init() {
    generateMaze();
    player = { x: 0, y: 0 };
    playerAngle = 0;
    enemy = { x: cols - 1, y: rows - 1 };
    enemyAngle = Math.PI * 0.5;
    goal = { x: cols - 1, y: rows - 1 };
    gameOver = false;

    startTimer();
    gameLoopInterval = setInterval(moveEnemy, 600);
    draw();
}

init();
