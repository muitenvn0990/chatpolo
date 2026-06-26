// ============================================================================
// HẰNG SỐ & KHỞI TẠO CẤU HÌNH CƠ BẢN
// ============================================================================
const GRID_SIZE = 11;
const CELL_SIZE = 2;
const WALL_HEIGHT = 2;

// Bản đồ 11x11: 1 là Tường không thể phá hủy, 0 là đường đi trống
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

// Biến điều khiển trạng thái Game
let scene, camera, renderer;
let localPlayer, remotePlayer;
let walls = [];
let bombs = [];
let explosions = [];
let isHost = false;
let peer, connection;
let gameActive = false;

// Trạng thái nút bấm (Dùng chung cho cả Bàn phím và Mobile Touch)
const moveDirection = { up: false, down: false, left: false, right: false };
const playerSpeed = 0.07;
const playerRadius = 0.4;

// Vị trí xuất phát mặc định (Tọa độ Grid)
const startPositions = {
    host: { x: 1, z: 1, color: 0x007bff },     // Xanh lam
    guest: { x: 9, z: 9, color: 0xdc3545 }    // Đỏ
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

// ============================================================================
// KHỞI TẠO ĐỒ HỌA THREE.JS
// ============================================================================
function init3DGame() {
    // 1. Tạo Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    scene.fog = new THREE.FogExp2(0x222222, 0.03);

    // 2. Tạo Camera (Góc nhìn từ trên xuống xéo - Isometric View)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 12);
    camera.lookAt(0, 0, 0);

    // 3. Tạo Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 4. Ánh sáng (Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 20, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. Dựng Sàn và Tường từ Ma trận MAP
    buildMap3D();

    // 6. Khởi tạo người chơi
    setupPlayers();

    // Lắng nghe sự kiện co giãn màn hình
    window.addEventListener('resize', onWindowResize, false);
    
    // Kích hoạt hệ thống nhận diện điều khiển
    setupControls();
    
    // Bật vòng lặp render chính
    gameActive = true;
    animate();
}

// Chuyển đổi tọa độ Grid (0->10) thành Tọa độ Không