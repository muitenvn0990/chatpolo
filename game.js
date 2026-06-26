// ============================================================================
// KHỞI ĐỘNG HỆ THỐNG KIỂM TRA (DIAGNOSTIC LOGS)
// ============================================================================
console.log("🚀 [Bombanana] File game.js đã được tải và thực thi thành công!");

const GRID_SIZE = 11;
const CELL_SIZE = 2;
const WALL_HEIGHT = 2;

const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1]
];

let scene, camera, renderer;
let localPlayer, remotePlayer;
let walls = [];
let bombs = [];
let explosions = [];
let isHost = false;
let peer, connection;
let gameActive = false;

const moveDirection = { up: false, down: false, left: false, right: false };
const playerSpeed = 0.07;
const playerRadius = 0.4;

const startPositions = {
    host: { x: 1, z: 1, color: 0x007bff },
    guest: { x: 9, z: 9, color: 0xdc3545 }
};

// Đón các phần tử UI từ HTML
const lobbyContainer = document.getElementById('lobby-container');
const btnHost = document.getElementById('btn-host');
const hostInfo = document.getElementById('host-info');
const peerIdDisplay = document.getElementById('peer-id');
const joinIdInput = document.getElementById('join-id');
const btnJoin = document.getElementById('btn-join');
const statusMessage = document.getElementById('status-message');
const gameUi = document.getElementById('game-ui');
const announcement = document.getElementById('announcement');
const myStatusText = document.getElementById('my-status');
const oppStatusText = document.getElementById('opp-status');

console.log("🔗 [Bombanana] Đã liên kết thành công các phần tử giao diện UI.");

// ============================================================================
// KHỞI TẠO ĐỒ HỌA THREE.JS
// ============================================================================
function init3DGame() {
    console.log("🎨 [Bombanana] Đang khởi tạo màn chơi 3D với Three.js...");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    scene.fog = new THREE.FogExp2(0x222222, 0.03);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 20, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    buildMap3D();
    setupPlayers();

    window.addEventListener('resize', onWindowResize, false);
    setupControls();
    
    gameActive = true;
    animate();
    console.log("🎮 [Bombanana] Trận đấu đã kích hoạt! Vòng lặp đồ họa bắt đầu chạy.");
}

function gridToWorld(gridX, gridZ) {
    const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;
    return { x: gridX * CELL_SIZE - offset, z: gridZ * CELL_SIZE - offset };
}

function worldToGrid(worldX, worldZ) {
    const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;
    return { x: Math.round((worldX + offset) / CELL_SIZE), z: Math.round((worldZ + offset) / CELL_SIZE) };
}

function buildMap3D() {
    const wallGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    
    const floorGeo = new THREE.PlaneGeometry(GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (MAP[r][c] === 1) {
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                const wPos = gridToWorld(c, r);
                wallMesh.position.set(wPos.x, WALL_HEIGHT / 2, wPos.z);
                scene.add(wallMesh);
                walls.push(new THREE.Box3().setFromObject(wallMesh));
            }
        }
    }
}

function setupPlayers() {
    const localCfg = isHost ? startPositions.host : startPositions.guest;
    const remoteCfg = isHost ? startPositions.guest : startPositions.host;

    const pLocalGeo = new THREE.SphereGeometry(playerRadius, 32, 32);
    const pLocalMat = new THREE.MeshStandardMaterial({ color: localCfg.color, roughness: 0.4 });
    localPlayer = new THREE.Mesh(pLocalGeo, pLocalMat);
    const posL = gridToWorld(localCfg.x, localCfg.z);
    localPlayer.position.set(posL.x, playerRadius, posL.z);
    scene.add(localPlayer);

    const pRemoteGeo = new THREE.SphereGeometry(playerRadius, 32, 32);
    const pRemoteMat = new THREE.MeshStandardMaterial({ color: remoteCfg.color, roughness: 0.4 });
    remotePlayer = new THREE.Mesh(pRemoteGeo, pRemoteMat);
    const posR = gridToWorld(remoteCfg.x, remoteCfg.z);
    remotePlayer.position.set(posR.x, playerRadius, posR.z);
    scene.add(remotePlayer);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// HỆ THỐNG ĐIỀU KHIỂN
// ============================================================================
function setupControls() {
    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': moveDirection.up = true; break;
            case 'KeyS': case 'ArrowDown': moveDirection.down = true; break;
            case 'KeyA': case 'ArrowLeft': moveDirection.left = true; break;
            case 'KeyD': case 'ArrowRight': moveDirection.right = true; break;
            case 'Space': placeBombLocal(); break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': moveDirection.up = false; break;
            case 'KeyS': case 'ArrowDown': moveDirection.down = false; break;
            case 'KeyA': case 'ArrowLeft': moveDirection.left = false; break;
            case 'KeyD': case 'ArrowRight': moveDirection.right = false; break;
        }
    });

    const bindMobileBtn = (id, dir) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveDirection[dir] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveDirection[dir] = false; });
    };

    bindMobileBtn('ctrl-up', 'up');
    bindMobileBtn('ctrl-down', 'down');
    bindMobileBtn('ctrl-left', 'left');
    bindMobileBtn('ctrl-right', 'right');

    const bombBtn = document.getElementById('ctrl-bomb');
    if (bombBtn) {
        bombBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            placeBombLocal();
        });
    }
    
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }
}

function updateMovement() {
    if (!gameActive) return;

    let moveX = 0;
    let moveZ = 0;

    if (moveDirection.up) moveZ -= playerSpeed;
    if (moveDirection.down) moveZ += playerSpeed;
    if (moveDirection.left) moveX -= playerSpeed;
    if (moveDirection.right) moveX += playerSpeed;

    if (moveX === 0 && moveZ === 0) return;

    const oldX = localPlayer.position.x;
    const oldZ = localPlayer.position.z;

    localPlayer.position.x += moveX;
    if (checkWallCollision()) localPlayer.position.x = oldX;

    localPlayer.position.z += moveZ;
    if (checkWallCollision()) localPlayer.position.z = oldZ;

    broadcastData({
        type: 'move',
        x: localPlayer.position.x,
        z: localPlayer.position.z
    });
}

function checkWallCollision() {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        localPlayer.position, 
        new THREE.Vector3(playerRadius * 2, playerRadius * 2, playerRadius * 2)
    );
    for (let i = 0; i < walls.length; i++) {
        if (playerBox.intersectsBox(walls[i])) return true;
    }
    return false;
}

function placeBombLocal() {
    const grid = worldToGrid(localPlayer.position.x, localPlayer.position.z);
    const bombExists = bombs.some(b => b.grid.x === grid.x && b.grid.z === grid.z);
    if (bombExists) return;

    const bombId = Math.random().toString(36).substring(2, 9);
    spawnBombMesh(grid.x, grid.z, bombId);

    broadcastData({
        type: 'bomb',
        gridX: grid.x,
        gridZ: grid.z,
        id: bombId
    });
}

function spawnBombMesh(gx, gz, id) {
    const bombGeo = new THREE.SphereGeometry(0.4, 16, 16);
    bombGeo.scale(1, 1.4, 1);
    const bombMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3 });
    const bombMesh = new THREE.Mesh(bombGeo, bombMat);
    
    const wPos = gridToWorld(gx, gz);
    bombMesh.position.set(wPos.x, 0.5, wPos.z);
    scene.add(bombMesh);

    bombs.push({ id: id, grid: { x: gx, z: gz }, mesh: bombMesh, timer: 2000 });
}

function updateBombs(deltaTime) {
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.timer -= deltaTime;
        const scaleProgress = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        b.mesh.scale.set(scaleProgress, scaleProgress * 1.4, scaleProgress);

        if (b.timer <= 0) {
            explodeBomb(b);
            bombs.splice(i, 1);
        }
    }
}

function explodeBomb(bomb) {
    scene.remove(bomb.mesh);
    const gx = bomb.grid.x;
    const gz = bomb.grid.z;
    const range = 2;

    const directions = [
        { x: 0, z: 0 },
        { x: 1, z: 0 }, { x: -1, z: 0 },
        { x: 0, z: 1 }, { x: 0, z: -1 }
    ];

    const expMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff0000 });
    const expGeo = new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.8, CELL_SIZE * 0.9);

    directions.forEach(dir => {
        if (dir.x === 0 && dir.z === 0) {
            createExplosionCell(gx, gz, expGeo, expMat);
            return;
        }
        for (let r = 1; r <= range; r++) {
            const targetX = gx + dir.x * r;
            const targetZ = gz + dir.z * r;
            if (MAP[targetZ] && MAP[targetZ][targetX] === 1) break;
            createExplosionCell(targetX, targetZ, expGeo, expMat);
        }
    });
}

function createExplosionCell(gx, gz, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    const wPos = gridToWorld(gx, gz);
    mesh.position.set(wPos.x, 0.4, wPos.z);
    scene.add(mesh);

    explosions.push({
        mesh: mesh,
        box: new THREE.Box3().setFromObject(mesh),
        duration: 500
    });
}

function updateExplosions(deltaTime) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.duration -= deltaTime;

        if (gameActive) {
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                localPlayer.position, 
                new THREE.Vector3(playerRadius, playerRadius, playerRadius)
            );
            if (playerBox.intersectsBox(exp.box)) {
                triggerGameOver(false);
            }
        }

        if (exp.duration <= 0) {
            scene.remove(exp.mesh);
            explosions.splice(i, 1);
        }
    }
}

function triggerGameOver(didIWin) {
    if (!gameActive) return;
    gameActive = false;

    if (!didIWin) {
        broadcastData({ type: 'gameover', winner: 'peer' });
        announcement.innerText = "💥 BẠN ĐÃ BỊ THIÊU RỤI!";
        myStatusText.innerText = "Tử trận";
    } else {
        announcement.innerText = "🍌 CHIẾN THẮNG BANANA!";
        oppStatusText.innerText = "Tử trận";
    }

    announcement.classList.remove('hidden');
    setTimeout(() => { resetMatch(); }, 4000);
}

function resetMatch() {
    bombs.forEach(b => scene.remove(b.mesh));
    explosions.forEach(e => scene.remove(e.mesh));
    bombs = [];
    explosions = [];

    const localCfg = isHost ? startPositions.host : startPositions.guest;
    const remoteCfg = isHost ? startPositions.guest : startPositions.host;

    const posL = gridToWorld(localCfg.x, localCfg.z);
    localPlayer.position.set(posL.x, playerRadius, posL.z);

    const posR = gridToWorld(remoteCfg.x, remoteCfg.z);
    remotePlayer.position.set(posR.x, playerRadius, posR.z);

    myStatusText.innerText = "Sống";
    oppStatusText.innerText = "Sống";
    announcement.classList.add('hidden');
    gameActive = true;
}

// ============================================================================
// MẠNG MULTIPLAYER P2P (PEERJS)
// ============================================================================
function setupPeerJS() {
    console.log("🌐 [Bombanana] Đang kết nối tới máy chủ PeerJS Cloud...");
    peer = new Peer();

    peer.on('open', (id) => {
        console.log("✅ [Bombanana] Đã lấy được ID phòng từ mạng P2P: " + id);
        peerIdDisplay.innerText = id;
    });

    peer.on('error', (err) => {
        console.error("❌ [Bombanana] Lỗi kết nối PeerJS: ", err);
        statusMessage.innerText = "Lỗi kết nối: " + err.type;
    });

    peer.on('connection', (conn) => {
        if (connection) return;
        connection = conn;
        isHost = true;
        handleNetworkDataEvents();
    });
}

function handleNetworkDataEvents() {
    console.log("📨 [Bombanana] Thiết lập cổng lắng nghe dữ liệu P2P...");
    statusMessage.innerText = "Đã kết nối! Đang tải đấu trường 3D...";
    
    connection.on('open', () => {
        console.log("🤝 [Bombanana] Hai người chơi đã bắt tay (Handshake) thành công!");
        setTimeout(() => {
            lobbyContainer.classList.add('hidden');
            gameUi.classList.remove('hidden');
            init3DGame();
        }, 1000);
    });

    connection.on('data', (data) => {
        if (!data || typeof data !== 'object') return;
        switch (data.type) {
            case 'move':
                if (remotePlayer) {
                    remotePlayer.position.x = data.x;
                    remotePlayer.position.z = data.z;
                }
                break;
            case 'bomb':
                spawnBombMesh(data.gridX, data.gridZ, data.id);
                break;
            case 'gameover':
                triggerGameOver(true);
                break;
        }
    });

    connection.on('close', () => {
        console.log("🔌 [Bombanana] Đối thủ mất kết nối.");
        alert("Đối thủ đã rời phòng!");
        window.location.reload();
    });
}

function broadcastData(data) {
    if (connection && connection.open) {
        connection.send(data);
    }
}

// Gắn sự kiện click
if (btnHost) {
    btnHost.addEventListener('click', () => {
        console.log("🔘 [Bombanana] Người dùng đã click nút 'Tạo Phòng (Host)'");
        btnHost.disabled = true;
        btnJoin.disabled = true;
        joinIdInput.disabled = true;
        hostInfo.classList.remove('hidden');
        isHost = true;
        setupPeerJS();
    });
}

if (btnJoin) {
    btnJoin.addEventListener('click', () => {
        const targetId = joinIdInput.value.trim();
        console.log("🔘 [Bombanana] Người dùng đã click nút 'Vào Phòng (Guest)'. Mã hướng tới: " + targetId);
        if (!targetId) {
            alert("Vui lòng điền Mã phòng (Peer ID) để liên kết!");
            return;
        }

        btnHost.disabled = true;
        btnJoin.disabled = true;
        statusMessage.innerText = "Đang bắt tay kết nối P2P...";
        
        isHost = false;
        peer = new Peer();
        
        peer.on('open', () => {
            connection = peer.connect(targetId);
            handleNetworkDataEvents();
        });

        peer.on('error', (err) => {
            console.error("❌ Lỗi khi Guest kết nối:", err);
            statusMessage.innerText = "Kết nối thất bại. Hãy kiểm tra lại ID!";
            btnHost.disabled = false;
            btnJoin.disabled = false;
        });
    });
}

// ============================================================================
// GAME LOOP
// ============================================================================
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const deltaTime = time - lastTime;
    lastTime = time;

    updateMovement();
    updateBombs(deltaTime);
    updateExplosions(deltaTime);

    renderer.render(scene, camera);
}
