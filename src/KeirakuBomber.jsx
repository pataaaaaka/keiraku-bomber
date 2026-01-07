import React, { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 32;
const CELL_SIZE = 18;
const MOXA_TIMER = 2000;
const EXPLOSION_DURATION = 500;
const NEEDLE_SPEED = 30; // 鍼の移動速度（msごとに1マス）

// 🔊 サウンドシステム
const SOUND_CONFIG = {
  enabled: true, // 音のON/OFF
  useExternalAudio: false, // true = 外部音源、false = Web Audio API
  volume: 0.3, // 音量 (0.0 - 1.0)
  
  // 外部音源のURL（後で変更可能）
  externalSounds: {
    needle: null, // 例: '/sounds/needle.mp3'
    moxa: null,
    explosion: null,
    enemyDefeat: null,
    itemGet: null,
    tsuboOpen: null,
    stageClear: null,
    gameOver: null,
    bgm: null,
  }
};

// Web Audio APIで効果音を生成
const playBeep = (frequency, duration, type = 'sine') => {
  if (!SOUND_CONFIG.enabled) return;
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.value = SOUND_CONFIG.volume;
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    // クリーンアップ
    setTimeout(() => {
      audioContext.close();
    }, duration * 1000 + 100);
  } catch (error) {
    console.warn('Audio playback failed:', error);
  }
};

// 複数音を連続再生
const playSequence = (notes) => {
  if (!SOUND_CONFIG.enabled) return;
  
  let time = 0;
  notes.forEach(({ frequency, duration, delay = 0 }) => {
    setTimeout(() => playBeep(frequency, duration), time);
    time += delay;
  });
};

// 外部音源を再生
const playExternalAudio = (soundKey) => {
  if (!SOUND_CONFIG.enabled || !SOUND_CONFIG.useExternalAudio) return;
  
  const url = SOUND_CONFIG.externalSounds[soundKey];
  if (!url) return;
  
  try {
    const audio = new Audio(url);
    audio.volume = SOUND_CONFIG.volume;
    audio.play().catch(err => console.warn('Audio play failed:', err));
  } catch (error) {
    console.warn('External audio failed:', error);
  }
};

// 🎵 効果音定義
const SoundEffects = {
  needle: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('needle');
    } else {
      playBeep(800, 0.05, 'square'); // ピュー
    }
  },
  
  moxa: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('moxa');
    } else {
      playBeep(150, 0.08, 'sine'); // コン
    }
  },
  
  explosion: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('explosion');
    } else {
      playBeep(80, 0.2, 'sawtooth'); // ドーン
    }
  },
  
  enemyDefeat: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('enemyDefeat');
    } else {
      // ピロリン（上昇音階）
      playSequence([
        { frequency: 523, duration: 0.08, delay: 0 },
        { frequency: 659, duration: 0.08, delay: 80 },
        { frequency: 784, duration: 0.12, delay: 160 },
      ]);
    }
  },
  
  itemGet: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('itemGet');
    } else {
      playBeep(1200, 0.15, 'sine'); // ピコーン
    }
  },
  
  tsuboOpen: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('tsuboOpen');
    } else {
      // キラーン
      playSequence([
        { frequency: 1047, duration: 0.1, delay: 0 },
        { frequency: 1319, duration: 0.15, delay: 100 },
      ]);
    }
  },
  
  stageClear: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('stageClear');
    } else {
      // ファンファーレ
      playSequence([
        { frequency: 523, duration: 0.15, delay: 0 },
        { frequency: 659, duration: 0.15, delay: 150 },
        { frequency: 784, duration: 0.15, delay: 300 },
        { frequency: 1047, duration: 0.3, delay: 450 },
      ]);
    }
  },
  
  gameOver: () => {
    if (SOUND_CONFIG.useExternalAudio) {
      playExternalAudio('gameOver');
    } else {
      // 下降音階
      playSequence([
        { frequency: 523, duration: 0.2, delay: 0 },
        { frequency: 392, duration: 0.2, delay: 200 },
        { frequency: 294, duration: 0.3, delay: 400 },
      ]);
    }
  },
};

// セルタイプ
const CELL_TYPES = {
  EMPTY: 0,
  WALL_BREAK: 1,
  WALL_SOLID: 2,
  TSUBO_NORMAL: 3,
  TSUBO_SPECIAL: 4,
  TSUBO_HIDDEN: 5,
  TREASURE_BOX: 6,  // 宝箱
};

// 生薬タイプ
const HERB_TYPES = {
  MUGWORT: 'mugwort',     // 艾葉（基本）
  GINGER: 'ginger',       // 生姜灸（六方向）
  SALT: 'salt',           // 塩灸（八方向）
  ACONITE: 'aconite',     // 附子（距離+2）
  EPHEDRA: 'ephedra',     // 麻黄（速度UP）
  ANGELICA: 'angelica',   // 当帰（設置数+1）
  HIDDEN: 'hidden',       // 隠し生薬（全能力MAX）
};

// 生薬情報（宝箱表示用）
const HERB_INFO = {
  mugwort: { name: '艾葉', effect: '爆発範囲強化', color: '#ffeb3b', char: '艾' },
  ginger: { name: '生姜灸', effect: '爆発範囲強化', color: '#ff9800', char: '姜' },
  salt: { name: '塩灸', effect: '爆発範囲強化', color: '#f44336', char: '塩' },
  aconite: { name: '附子', effect: '爆発距離+2', color: '#9c27b0', char: '附' },
  ephedra: { name: '麻黄', effect: '速度UP', color: '#2196f3', char: '麻' },
  angelica: { name: '当帰', effect: '設置数+1', color: '#e91e63', char: '当' },
  hidden: { name: '隠し生薬', effect: '全能力MAX', color: '#ffd700', char: '宝' },
};

// 爆発パターン定義
const EXPLOSION_PATTERNS = {
  CROSS: 'cross',         // 十字4方向
  HEXAGON: 'hexagon',     // 六方向
  OCTAGON: 'octagon',     // 八方向
};

// 特効ツボ名
const SPECIAL_TSUBO_NAMES = [
  '中府', '雲門', '太淵', '合谷', '曲池', '迎香',
  '足三里', '天枢', '承泣', '太白', '陰陵泉', '血海',
  '神門', '少海', '極泉', '百会', '風池', '天柱',
  '関元', '気海', '中脘',
];

// 臓器ステージ定義
const STAGE_TEMPLATES = {
  heart: {
    name: '心臓',
    difficulty: 1,
    shape: [
      "################################",
      "################################",
      "################################",
      "######....########....##########",
      "#####..XXXX......XXXX..#########",
      "####..XXXXXXXX..XXXXXXXX..######",
      "###..XXXXXXXXXXXXXXXXXX..#######",
      "###.XXXXXXXXXXXXXXXXXXXX..######",
      "##..XXXXXXXXXXXXXXXXXXXX..######",
      "##..XXXXXXXXXXXXXXXXXXXX..######",
      "##..XXXXXXXXXXXXXXXXXXXX...#####",
      "##..XXXXXXXXXXXXXXXXXXXX...#####",
      "##...XXXXXXXXXXXXXXXXXXXXXX.####",
      "###..XXXXXXXXXXXXXXXXXXXXXX.####",
      "###..XXXXXXXXXXXXXXXXXXXXX..####",
      "####..XXXXXXXXXXXXXXXXXXXX..####",
      "####..XXXXXXXXXXXXXXXXXXX...####",
      "#####..XXXXXXXXXXXXXXXXXX...####",
      "#####...XXXXXXXXXXXXXXXXX..#####",
      "######..XXXXXXXXXXXXXXXX...#####",
      "######...XXXXXXXXXXXXXX...######",
      "#######..XXXXXXXXXXXXX....######",
      "########..XXXXXXXXXXX....#######",
      "#########..XXXXXXXXX....########",
      "##########..XXXXXXX....#########",
      "###########..XXXXX....##########",
      "############..XXX....###########",
      "#############..X....############",
      "##############.....#############",
      "################################",
      "################################",
      "################################",
    ]
  },
  lung: {
    name: '肺',
    difficulty: 2,
    shape: [
      "################################",
      "################################",
      "#########........###############",
      "########..XXXXXX..##############",
      "#######..XXXXXXXX..#############",
      "######..XXXXXXXXXX..############",
      "######.XXXXXXXXXXXX.############",
      "#####..XXXXXXXXXXXX..###########",
      "#####.XXXXXXXXXXXXXX.###########",
      "####..XXXXXXXXXXXXXX..##########",
      "####.XXXXXXXXXXXXXXXX.##########",
      "####.XXXXXXXXXXXXXXXX.##########",
      "###..XXXXXXXXXXXXXXXX..#########",
      "###.XXXXXXXXXXXXXXXXXX.#########",
      "###.XXXXXXXXXXXXXXXXXX.#########",
      "###.XXXXXXXXXXXXXXXXXX.#########",
      "###.XXXXXXXXXXXXXXXXXX.#########",
      "###.XXXXXXXXXXXXXXXXXX.#########",
      "###..XXXXXXXXXXXXXXXX..#########",
      "####.XXXXXXXXXXXXXXXX.##########",
      "####.XXXXXXXXXXXXXXXX.##########",
      "####..XXXXXXXXXXXXXX..##########",
      "#####.XXXXXXXXXXXXXX.###########",
      "#####..XXXXXXXXXXXX..###########",
      "######.XXXXXXXXXXXX.############",
      "######..XXXXXXXXXX..############",
      "#######.XXXXXXXXXX.#############",
      "#######..XXXXXXXX..#############",
      "########..XXXXXX..##############",
      "#########........###############",
      "################################",
      "################################",
    ]
  },
  stomach: {
    name: '胃',
    difficulty: 3,
    shape: [
      "################################",
      "################################",
      "###########..........###########",
      "##########..XXXXXXXX..##########",
      "#########..XXXXXXXXXX..#########",
      "########..XXXXXXXXXXXX..########",
      "########.XXXXXXXXXXXXXX.########",
      "#######..XXXXXXXXXXXXXX..#######",
      "#######.XXXXXXXXXXXXXXXX.#######",
      "######..XXXXXXXXXXXXXXXX..######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######.XXXXXXXXXXXXXXXXXX.######",
      "######..XXXXXXXXXXXXXXXX..######",
      "#######.XXXXXXXXXXXXXXXX.#######",
      "#######..XXXXXXXXXXXXXX..#######",
      "########.XXXXXXXXXXXXXX.########",
      "########..XXXXXXXXXXXX..########",
      "#########.XXXXXXXXXXXX.#########",
      "#########..XXXXXXXXXX..#########",
      "##########.XXXXXXXXXX.##########",
      "##########..XXXXXXXX..##########",
      "###########.XXXXXXXX.###########",
      "###########..XXXXXX..###########",
      "############.XXXXXX.############",
      "#############......#############",
      "################################",
      "################################",
      "################################",
    ]
  },
  kidney: {
    name: '腎臓',
    difficulty: 4,
    shape: [
      "################################",
      "################################",
      "################################",
      "########........####........####",
      "#######..XXXXXX..##..XXXXXX..###",
      "######..XXXXXXXX....XXXXXXXX..##",
      "#####..XXXXXXXXXX..XXXXXXXXXX..#",
      "#####.XXXXXXXXXXXXXXXXXXXX..####",
      "####..XXXXXXXXXXXXXXXXXXX..#####",
      "####.XXXXXXXXXXXXXXXXXXXX..#####",
      "####.XXXXXXXXXXX.....XXXX..#####",
      "###..XXXXXXXXXX.......XXX..#####",
      "###.XXXXXXXXXXX.......XXX..#####",
      "###.XXXXXXXXXXX.......XXX.######",
      "###.XXXXXXXXXXX.......XXX.######",
      "###.XXXXXXXXXXX.......XXX.######",
      "###.XXXXXXXXXXX.......XXX.######",
      "###.XXXXXXXXXXX.......XXX.######",
      "###..XXXXXXXXXX.......XXX..#####",
      "####.XXXXXXXXXX.......XXX..#####",
      "####.XXXXXXXXXXX.....XXXX..#####",
      "####..XXXXXXXXXXXXXXXXXXXX..####",
      "#####.XXXXXXXXXXXXXXXXXXXX..####",
      "#####..XXXXXXXXXX..XXXXXXXXX..##",
      "######.XXXXXXXXX....XXXXXXXX..##",
      "#######..XXXXXX..##..XXXXXX..###",
      "########........####........####",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ]
  },
  brain: {
    name: '脳',
    difficulty: 5,
    shape: [
      "################################",
      "################################",
      "########..............##########",
      "#######..XXXXXXXXXXXX..#########",
      "######..XXXXXXXXXXXXXX..########",
      "#####..XXXXXXXXXXXXXXXX..#######",
      "####..XXXXXXXXXX..XXXXXX..######",
      "####.XXXXXXXXXXX..XXXXXXX.######",
      "###..XXXXXXXXXXX..XXXXXXXX..####",
      "###.XXXXXXXXXXXXXXXXXXXX.XX.####",
      "###.XXXXXXXXXXXXXXXXXXXX.XX.####",
      "##..XXXXXXXXXXXXXXXXXXXXXXX..###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##.XXXXXXXXXXXXXXXXXXXXXXXXX.###",
      "##..XXXXXXXXXXXXXXXXXXXXXXX..###",
      "###.XXXXXXXXXXXXXXXXXXXXXXX.####",
      "###.XXXXXXXXXXXXXXXXXXXXXXX.####",
      "###..XXXXXXXXXXXXXXXXXXXXX..####",
      "####.XXXXXXXXXXXXXXXXXXXXX.#####",
      "####..XXXXXXXXXXXXXXXXXXX..#####",
      "#####.XXXXXXXXXXXXXXXXXXX.######",
      "#####..XXXXXXXXXXXXXXXXX..######",
      "######.XXXXXXXXXXXXXXXXX.#######",
      "######..XXXXXXXXXXXXXXX..#######",
      "#######..XXXXXXXXXXXXX..########",
      "########..............##########",
      "################################",
      "################################",
    ]
  },
  gourd: {
    name: '瓢箪',
    difficulty: 2,
    shape: [
      "################################",
      "################################",
      "###########........#############",
      "##########..XXXXXX..############",
      "#########..XXXXXXXX..###########",
      "########..XXXXXXXXXX..##########",
      "########.XXXXXXXXXXXX.##########",
      "########.XXXXXXXXXXXX.##########",
      "########..XXXXXXXXXX..##########",
      "#########..XXXXXXXX..###########",
      "##########..XXXXXX..############",
      "###########........#############",
      "###########........#############",
      "##########..XXXXXX..############",
      "#########..XXXXXXXX..###########",
      "########..XXXXXXXXXX..##########",
      "#######..XXXXXXXXXXXX..#########",
      "######..XXXXXXXXXXXXXX..########",
      "######.XXXXXXXXXXXXXXXX.########",
      "######.XXXXXXXXXXXXXXXX.########",
      "######.XXXXXXXXXXXXXXXX.########",
      "######..XXXXXXXXXXXXXX..########",
      "#######..XXXXXXXXXXXX..#########",
      "########..XXXXXXXXXX..##########",
      "#########..XXXXXXXX..###########",
      "##########..XXXXXX..############",
      "###########........#############",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ]
  },
  star: {
    name: '星',
    difficulty: 3,
    shape: [
      "################################",
      "################################",
      "##############XX################",
      "#############XXXX###############",
      "############XXXXXX##############",
      "###########XXXXXXXX#############",
      "##########XXXXXXXXXX############",
      "#########XXXXXXXXXXXX###########",
      "########.XXXXXXXXXXXX.##########",
      "#######..XXXXXXXXXXXX..#########",
      "######...XXXXXXXXXXXX...########",
      "#####....XXXXXXXXXXXX....#######",
      "####.....XXXXXXXXXXXX.....######",
      "###......XXXXXXXXXXXX......#####",
      "###XXXXXXXXXXXXXXXXXXXXXX...####",
      "###.XXXXXXXXXXXXXXXXXXXX....####",
      "####..XXXXXXXXXXXXXXXXX.....####",
      "####...XXXXXXXXXXXXXXX......####",
      "#####...XXXXXXXXXXXXX.......####",
      "######...XXXXXXXXXXX........####",
      "#######..XXXXXXXXXX.........####",
      "########.XXXXXXXXX..........####",
      "########..XXXXXXXX..........####",
      "#########.XXXXXXX...........####",
      "#########..XXXXX............####",
      "##########..XXX.............####",
      "###########.X...............####",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ]
  },
  yinyang: {
    name: '陰陽',
    difficulty: 4,
    shape: [
      "################################",
      "################################",
      "###########........#############",
      "#########..XXXXXXXX..###########",
      "########..XXXXXXXXXX..##########",
      "#######..XXXXXXXXXXXX..#########",
      "######..XXXXXXXXXXXXXX..########",
      "#####..XXXXXXXXXXXXXXXX..#######",
      "#####.XXXXXXXXXXXXXXXXXX.#######",
      "####..XXXXXXXXX##XXXXXXXX.######",
      "####.XXXXXXXXX####XXXXXXX.######",
      "###..XXXXXXXX######XXXXXXX.#####",
      "###.XXXXXXXX########XXXXXX..####",
      "###.XXXXXXX##########XXXXX..####",
      "###.XXXXXX############XXXX..####",
      "###.XXXXX..XXXX########XXX..####",
      "###.XXXX..XXXXXX########XX..####",
      "###.XXXX.XXXXXXXX########X..####",
      "###..XXX.XXXXXXXXX########..####",
      "####.XXX.XXXXXXXXXX######...####",
      "####..XXXXXXXXXXXXXXXXX.....####",
      "#####..XXXXXXXXXXXXXXX......####",
      "######..XXXXXXXXXXXXX.......####",
      "#######..XXXXXXXXXXX........####",
      "########..XXXXXXXXX.........####",
      "#########..XXXXXXX..........####",
      "###########......###############",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ]
  },
  hexagon: {
    name: '六角形',
    difficulty: 3,
    shape: [
      "################################",
      "################################",
      "################################",
      "############XXXXXXXX############",
      "###########XXXXXXXXXX###########",
      "##########XXXXXXXXXXXX##########",
      "#########XXXXXXXXXXXXXX#########",
      "########XXXXXXXXXXXXXXXX########",
      "#######XXXXXXXXXXXXXXXXXX#######",
      "######XXXXXXXXXXXXXXXXXXXX######",
      "#####XXXXXXXXXXXXXXXXXXXXXX#####",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "###XXXXXXXXXXXXXXXXXXXXXXXXXX###",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "#####XXXXXXXXXXXXXXXXXXXXXX#####",
      "######XXXXXXXXXXXXXXXXXXXX######",
      "#######XXXXXXXXXXXXXXXXXX#######",
      "########XXXXXXXXXXXXXXXX########",
      "#########XXXXXXXXXXXXXX#########",
      "##########XXXXXXXXXXXX##########",
      "###########XXXXXXXXXX###########",
      "############XXXXXXXX############",
      "################################",
      "################################",
      "################################",
    ]
  },
  spiral: {
    name: '渦巻',
    difficulty: 5,
    shape: [
      "################################",
      "################################",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "####XXXXXXXXXXXXXXXXXXXXXXXX####",
      "####XXXX################XXXX####",
      "####XXXX################XXXX####",
      "####XXXX################XXXX####",
      "####XXXX################XXXX####",
      "####XXXX####XXXXXXXX####XXXX####",
      "####XXXX####XXXXXXXX####XXXX####",
      "####XXXX####XXXXXXXX####XXXX####",
      "####XXXX####XXXX##XX####XXXX####",
      "####XXXX####XXXX##XX####XXXX####",
      "####XXXX####XXXX##XX####XXXX####",
      "####XXXX####XXXX##XXXXXXXXXX####",
      "####XXXX####XXXX##XXXXXXXXXX####",
      "####XXXX####XXXX################",
      "####XXXX####XXXX################",
      "####XXXX####XXXXXXXXXXXX########",
      "####XXXX####XXXXXXXXXXXX########",
      "####XXXX########################",
      "####XXXX########################",
      "####XXXXXXXXXXXXXXXXXXXX########",
      "####XXXXXXXXXXXXXXXXXXXX########",
      "####XXXXXXXXXXXXXXXXXXXX########",
      "####XXXXXXXXXXXXXXXXXXXX########",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ]
  },
};

const KeirakuBomber = () => {
  // ゲームモード
  const [gameMode, setGameMode] = useState(null); // null, 'story', 'free'
  const [gameStarted, setGameStarted] = useState(false); // ゲーム開始フラグ
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const stageKeys = Object.keys(STAGE_TEMPLATES);
  const currentStageKey = stageKeys[currentStageIndex];
  
  // プレイヤー状態
  const [player, setPlayer] = useState({ x: 5, y: 5 });
  const [enemies, setEnemies] = useState([]);
  const [map, setMap] = useState([]);
  const [moxas, setMoxas] = useState([]);
  const [needles, setNeedles] = useState([]);
  const [items, setItems] = useState([]);
  const [treasureBoxes, setTreasureBoxes] = useState([]); // 宝箱
  const [explosions, setExplosions] = useState([]);
  
  // ゲーム状態
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [combo, setCombo] = useState(0);
  const [specialTsuboEffect, setSpecialTsuboEffect] = useState(null);
  const [herbMessage, setHerbMessage] = useState(null); // 生薬取得メッセージ
  const [openedTsuboList, setOpenedTsuboList] = useState([]); // 開放済みツボ
  const [acquiredHerbs, setAcquiredHerbs] = useState([]); // 取得した生薬リスト
  const [paused, setPaused] = useState(false); // 一時停止
  
  // パワーアップ（ストーリーモードで持ち越し）
  const [needleRange, setNeedleRange] = useState(2); // 鍼の射程
  const [mugwortCount, setMugwortCount] = useState(0); // 艾葉取得回数（爆発方向を決定）
  const [moxaDistance, setMoxaDistance] = useState(2); // 爆発距離
  const [speedLevel, setSpeedLevel] = useState(1); // 移動速度
  const [maxMoxas, setMaxMoxas] = useState(1); // 同時設置数
  
  const moveDelayRef = useRef(0);

  // 鍼の名前取得
  const getNeedleName = (range) => {
    if (range <= 3) return '豪鍼';
    if (range <= 6) return '銀鍼';
    if (range <= 10) return '金鍼';
    return '九頭鍼';
  };

  // お灸の名前取得
  const getMoxaName = (count) => {
    if (count === 0) return '艾葉灸';
    if (count === 1) return '艾葉灸';
    if (count === 2) return '艾葉灸★';
    if (count === 3) return '艾葉灸★★';
    return '艾葉灸MAX';
  };

  // 爆発パターン取得（艾葉取得回数による）
  const getMoxaPattern = (count) => {
    if (count === 0) return EXPLOSION_PATTERNS.CROSS; // 初期：4方向
    if (count === 1) return EXPLOSION_PATTERNS.CROSS; // 1個：4方向
    if (count === 2) return EXPLOSION_PATTERNS.HEXAGON; // 2個：6方向
    return EXPLOSION_PATTERNS.OCTAGON; // 3個以上：8方向
  };

  // アイテム・ツボリストを集約（重複カウント）
  const aggregateList = (list) => {
    const counts = {};
    list.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => 
      count > 1 ? `${name}×${count}` : name
    ).join(' ');
  };

  // ステージマップ生成
  const createStageMap = useCallback((stageKey) => {
    const template = STAGE_TEMPLATES[stageKey];
    const shape = template.shape;
    const map = [];
    const emptySpaces = [];
    const treasurePositions = []; // 宝箱配置位置
    
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const char = shape[y]?.[x] || '#';
        
        if (char === '#') {
          row.push(CELL_TYPES.WALL_SOLID);
        } else if (char === 'X') {
          const rand = Math.random();
          if (rand < 0.01) {
            row.push(CELL_TYPES.TSUBO_HIDDEN); // 隠しツボ 1%
          } else if (rand < 0.03) {
            row.push(CELL_TYPES.TSUBO_SPECIAL); // 特効ツボ 2%
          } else if (rand < 0.06) {
            row.push(CELL_TYPES.TSUBO_NORMAL); // 通常ツボ 3%
          } else if (rand < 0.11) {
            // 宝箱 5%（破壊可能壁の代わり）
            row.push(CELL_TYPES.EMPTY);
            emptySpaces.push({ x, y });
            treasurePositions.push({ x, y });
          } else if (rand < 0.46) {
            row.push(CELL_TYPES.WALL_BREAK); // 破壊可能壁 35%
          } else {
            row.push(CELL_TYPES.EMPTY);
            emptySpaces.push({ x, y });
          }
        } else {
          row.push(CELL_TYPES.EMPTY);
          emptySpaces.push({ x, y });
        }
      }
      map.push(row);
    }
    
    return { map, emptySpaces, treasurePositions };
  }, []);

  // ステージ開始
  const startStage = useCallback((stageKey, resetPower = false) => {
    setGameStarted(true); // ゲーム開始
    setPaused(false); // 一時停止解除
    const { map: newMap, emptySpaces, treasurePositions } = createStageMap(stageKey);
    setMap(newMap);
    
    if (emptySpaces.length < 6) return;
    
    // プレイヤー位置（より広い場所を選ぶ）
    const openSpaces = emptySpaces.map(space => {
      // 周囲8方向の空きマス数をカウント
      let openCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = space.x + dx;
          const ny = space.y + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            if (newMap[ny][nx] === CELL_TYPES.EMPTY) {
              openCount++;
            }
          }
        }
      }
      return { ...space, openCount };
    });
    
    // 開放度が高い場所（周囲に空きマスが多い）を優先
    const sortedSpaces = openSpaces.sort((a, b) => b.openCount - a.openCount);
    const playerStart = sortedSpaces[Math.floor(Math.random() * Math.min(10, sortedSpaces.length))];
    setPlayer({ x: playerStart.x, y: playerStart.y });
    
    // 敵配置（難易度で数が増える）
    const difficulty = STAGE_TEMPLATES[stageKey].difficulty;
    const enemyCount = 3 + difficulty;
    const enemyTypes = ['wind', 'heat', 'plague', 'cold', 'wet'];
    const newEnemies = [];
    
    for (let i = 0; i < enemyCount; i++) {
      const farSpaces = emptySpaces.filter(space => {
        const dx = space.x - playerStart.x;
        const dy = space.y - playerStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > 10 && !newEnemies.some(e => e.x === space.x && e.y === space.y);
      });
      
      if (farSpaces.length > 0) {
        const enemyPos = farSpaces[Math.floor(Math.random() * farSpaces.length)];
        newEnemies.push({
          id: i + 1,
          x: enemyPos.x,
          y: enemyPos.y,
          type: enemyTypes[i % enemyTypes.length],
          moveTimer: 0,
        });
      }
    }
    
    setEnemies(newEnemies);
    
    // 宝箱配置
    const newTreasureBoxes = treasurePositions.map((pos, i) => {
      const herbTypes = [
        HERB_TYPES.MUGWORT,
        HERB_TYPES.GINGER,
        HERB_TYPES.SALT,
        HERB_TYPES.ACONITE,
        HERB_TYPES.EPHEDRA,
        HERB_TYPES.ANGELICA,
      ];
      const weights = [0.3, 0.2, 0.15, 0.15, 0.1, 0.08];
      const rand = Math.random();
      let cumulative = 0;
      let selectedType = herbTypes[0];
      
      for (let j = 0; j < herbTypes.length; j++) {
        cumulative += weights[j];
        if (rand < cumulative) {
          selectedType = herbTypes[j];
          break;
        }
      }
      
      // 2%で隠し生薬
      if (Math.random() < 0.02) {
        selectedType = HERB_TYPES.HIDDEN;
      }
      
      return {
        id: `treasure-${i}`,
        x: pos.x,
        y: pos.y,
        herbType: selectedType,
      };
    });
    setTreasureBoxes(newTreasureBoxes);
    
    setMoxas([]);
    setNeedles([]);
    setItems([]);
    setExplosions([]);
    setGameOver(false);
    setGameWon(false);
    setCombo(0);
    setSpecialTsuboEffect(null);
    setHerbMessage(null);
    setOpenedTsuboList([]);
    setAcquiredHerbs([]);
    
    // フリーモードならパワーアップリセット
    if (resetPower) {
      setNeedleRange(2);
      setMugwortCount(0);
      setMoxaDistance(2);
      setSpeedLevel(1);
      setMaxMoxas(1);
    }
  }, [createStageMap]);

  // ゲームモード選択
  const selectMode = (mode) => {
    setGameMode(mode);
    setScore(0);
    setCurrentStageIndex(0);
    if (mode === 'story') {
      startStage(stageKeys[0], true);
    } else {
      setGameStarted(false); // フリーモードはステージ選択画面へ
    }
  };

  // プレイヤー移動
  const movePlayer = useCallback((dx, dy) => {
    if (gameOver || gameWon || !gameMode || paused) return;
    
    const now = Date.now();
    const cooldown = speedLevel === 3 ? 50 : speedLevel === 2 ? 100 : 150;
    if (now - moveDelayRef.current < cooldown) return;
    moveDelayRef.current = now;
    
    setPlayer(prev => {
      const newX = prev.x + dx;
      const newY = prev.y + dy;
      
      const cell = map[newY]?.[newX];
      if (cell === CELL_TYPES.WALL_SOLID || 
          cell === CELL_TYPES.WALL_BREAK ||
          cell === CELL_TYPES.TSUBO_NORMAL ||
          cell === CELL_TYPES.TSUBO_SPECIAL ||
          cell === CELL_TYPES.TSUBO_HIDDEN) {
        return prev;
      }
      
      if (moxas.some(m => m.x === newX && m.y === newY)) {
        return prev;
      }
      
      if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
        return prev;
      }
      
      // アイテム取得
      setItems(prevItems => {
        const pickedItem = prevItems.find(item => item.x === newX && item.y === newY);
        if (pickedItem) {
          // アイテム取得音
          SoundEffects.itemGet();
          
          switch(pickedItem.type) {
            case HERB_TYPES.MUGWORT:
              setMoxaDistance(prev => Math.min(prev + 1, 8));
              setMugwortCount(prev => prev + 1);
              setScore(prev => prev + 300);
              break;
            case HERB_TYPES.GINGER:
              setMoxaDistance(prev => Math.min(prev + 1, 8));
              setMugwortCount(prev => prev + 1);
              setScore(prev => prev + 500);
              break;
            case HERB_TYPES.SALT:
              setMoxaDistance(prev => Math.min(prev + 1, 8));
              setMugwortCount(prev => prev + 1);
              setScore(prev => prev + 800);
              break;
            case HERB_TYPES.ACONITE:
              setMoxaDistance(prev => Math.min(prev + 2, 8));
              setScore(prev => prev + 600);
              break;
            case HERB_TYPES.EPHEDRA:
              setSpeedLevel(prev => Math.min(prev + 1, 3));
              setScore(prev => prev + 400);
              break;
            case HERB_TYPES.ANGELICA:
              setMaxMoxas(prev => Math.min(prev + 1, 3));
              setScore(prev => prev + 700);
              break;
            case HERB_TYPES.HIDDEN:
              setNeedleRange(15);
              setMugwortCount(10); // 8方向確定
              setMoxaDistance(8);
              setSpeedLevel(3);
              setMaxMoxas(3);
              setScore(prev => prev + 5000);
              break;
          }
          return prevItems.filter(item => item !== pickedItem);
        }
        return prevItems;
      });
      
      // 宝箱取得（通るだけ）
      setTreasureBoxes(prevBoxes => {
        const pickedBox = prevBoxes.find(box => box.x === newX && box.y === newY);
        if (pickedBox) {
          // アイテム取得音
          SoundEffects.itemGet();
          
          // メッセージ表示
          const herbInfo = HERB_INFO[pickedBox.herbType];
          if (herbInfo) {
            setHerbMessage({ name: herbInfo.name, effect: herbInfo.effect, color: herbInfo.color });
            setTimeout(() => setHerbMessage(null), 1500);
          }
          
          // 効果適用
          setTimeout(() => {
            switch(pickedBox.herbType) {
              case HERB_TYPES.MUGWORT:
                setMoxaDistance(prev => Math.min(prev + 1, 8));
                setMugwortCount(prev => prev + 1);
                setAcquiredHerbs(prev => [...prev, '艾葉']);
                setScore(prev => prev + 300);
                break;
              case HERB_TYPES.GINGER:
                setMoxaDistance(prev => Math.min(prev + 1, 8));
                setMugwortCount(prev => prev + 1);
                setAcquiredHerbs(prev => [...prev, '生姜灸']);
                setScore(prev => prev + 500);
                break;
              case HERB_TYPES.SALT:
                setMoxaDistance(prev => Math.min(prev + 1, 8));
                setMugwortCount(prev => prev + 1);
                setAcquiredHerbs(prev => [...prev, '塩灸']);
                setScore(prev => prev + 800);
                break;
              case HERB_TYPES.ACONITE:
                setMoxaDistance(prev => Math.min(prev + 2, 8));
                setAcquiredHerbs(prev => [...prev, '附子']);
                setScore(prev => prev + 600);
                break;
              case HERB_TYPES.EPHEDRA:
                setSpeedLevel(prev => Math.min(prev + 1, 3));
                setAcquiredHerbs(prev => [...prev, '麻黄']);
                setScore(prev => prev + 400);
                break;
              case HERB_TYPES.ANGELICA:
                setMaxMoxas(prev => Math.min(prev + 1, 3));
                setAcquiredHerbs(prev => [...prev, '当帰']);
                setScore(prev => prev + 700);
                break;
              case HERB_TYPES.HIDDEN:
                setNeedleRange(15);
                setMugwortCount(10);
                setMoxaDistance(8);
                setSpeedLevel(3);
                setMaxMoxas(3);
                setAcquiredHerbs(prev => [...prev, '隠し生薬']);
                setScore(prev => prev + 10000);
                break;
            }
          }, 0);
          
          return prevBoxes.filter(box => box !== pickedBox);
        }
        return prevBoxes;
      });
      
      return { x: newX, y: newY };
    });
  }, [map, moxas, gameOver, gameWon, gameMode, speedLevel, paused]);

  // お灸設置
  const placeMoxa = useCallback(() => {
    if (gameOver || gameWon || !gameMode || paused) return;
    
    setMoxas(prev => {
      if (prev.some(m => m.x === player.x && m.y === player.y)) return prev;
      if (prev.length >= maxMoxas) return prev;
      
      // 効果音再生
      SoundEffects.moxa();
      
      return [...prev, {
        id: Date.now(),
        x: player.x,
        y: player.y,
        timer: MOXA_TIMER,
      }];
    });
  }, [player, gameOver, gameWon, gameMode, maxMoxas, paused]);

  // 鍼発射
  const shootNeedle = useCallback((direction) => {
    if (gameOver || gameWon || !gameMode || paused) return;
    
    const directions = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };
    
    const { dx, dy } = directions[direction];
    
    // 効果音再生
    SoundEffects.needle();
    
    setNeedles(prev => [...prev, {
      id: Date.now() + Math.random(),
      x: player.x,
      y: player.y,
      dx,
      dy,
      distance: 0,
    }]);
  }, [player, gameOver, gameWon, gameMode, paused]);

  // キーボード操作
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          movePlayer(0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          movePlayer(0, 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          movePlayer(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          movePlayer(1, 0);
          break;
        case ' ':
          e.preventDefault();
          placeMoxa();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          shootNeedle('up');
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          shootNeedle('down');
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          shootNeedle('left');
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          shootNeedle('right');
          break;
        case 'Escape':
          e.preventDefault();
          setPaused(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePlayer, placeMoxa, shootNeedle]);

  // 鍼の移動
  useEffect(() => {
    if (needles.length === 0 || paused) return;
    
    const interval = setInterval(() => {
      setNeedles(prev => {
        const updated = [];
        
        prev.forEach(needle => {
          const newX = needle.x + needle.dx;
          const newY = needle.y + needle.dy;
          const newDistance = needle.distance + 1;
          
          if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return;
          
          const cell = map[newY]?.[newX];
          
          // 壁に当たったら消滅（破壊不可）
          if (cell === CELL_TYPES.WALL_SOLID || cell === CELL_TYPES.WALL_BREAK) return;
          
          // ツボに当たったら破壊
          if (cell === CELL_TYPES.TSUBO_NORMAL || 
              cell === CELL_TYPES.TSUBO_SPECIAL ||
              cell === CELL_TYPES.TSUBO_HIDDEN) {
            
            // ツボ開放音
            SoundEffects.tsuboOpen();
            
            setMap(prevMap => {
              const newMap = prevMap.map(row => [...row]);
              const cellType = newMap[newY][newX];
              newMap[newY][newX] = CELL_TYPES.EMPTY;
              
              if (cellType === CELL_TYPES.TSUBO_HIDDEN) {
                // 隠しツボ
                setOpenedTsuboList(prev => [...prev, '隠しツボ']);
                setNeedleRange(prev => Math.min(prev + 5, 15));
                setScore(prev => prev + 10000);
                setSpecialTsuboEffect({ name: '隠しツボ', x: newX, y: newY });
                setTimeout(() => setSpecialTsuboEffect(null), 1500);
                
                // 虹色生薬ドロップ
                if (Math.random() < 0.5) {
                  setItems(prevItems => [...prevItems, {
                    id: Date.now() + Math.random(),
                    x: newX,
                    y: newY,
                    type: HERB_TYPES.HIDDEN,
                  }]);
                }
              } else if (cellType === CELL_TYPES.TSUBO_SPECIAL) {
                // 特効ツボ
                const tsuboName = SPECIAL_TSUBO_NAMES[Math.floor(Math.random() * SPECIAL_TSUBO_NAMES.length)];
                setOpenedTsuboList(prev => [...prev, tsuboName]);
                setNeedleRange(prev => Math.min(prev + 3, 15));
                setScore(prev => prev + 5000);
                setSpecialTsuboEffect({ name: tsuboName, x: newX, y: newY });
                setTimeout(() => setSpecialTsuboEffect(null), 1000);
              } else if (cellType === CELL_TYPES.TSUBO_NORMAL) {
                // 通常ツボ
                const tsuboName = SPECIAL_TSUBO_NAMES[Math.floor(Math.random() * SPECIAL_TSUBO_NAMES.length)];
                setOpenedTsuboList(prev => [...prev, tsuboName]);
                setNeedleRange(prev => Math.min(prev + 1, 15));
                setScore(prev => prev + 100);
              }
              
              // アイテムドロップ（ツボのみ）
              if (Math.random() < 0.1) {
                const herbTypes = [
                  HERB_TYPES.MUGWORT,
                  HERB_TYPES.GINGER,
                  HERB_TYPES.SALT,
                  HERB_TYPES.ACONITE,
                  HERB_TYPES.EPHEDRA,
                  HERB_TYPES.ANGELICA,
                ];
                const weights = [0.35, 0.25, 0.15, 0.12, 0.08, 0.05];
                const rand = Math.random();
                let cumulative = 0;
                let selectedType = herbTypes[0];
                
                for (let i = 0; i < herbTypes.length; i++) {
                  cumulative += weights[i];
                  if (rand < cumulative) {
                    selectedType = herbTypes[i];
                    break;
                  }
                }
                
                setItems(prevItems => [...prevItems, {
                  id: Date.now() + Math.random(),
                  x: newX,
                  y: newY,
                  type: selectedType,
                }]);
              }
              
              return newMap;
            });
            return;
          }
          
          // 宝箱破壊（中身消失）
          setTreasureBoxes(prevBoxes => {
            const hitBox = prevBoxes.find(box => box.x === newX && box.y === newY);
            if (hitBox) {
              return prevBoxes.filter(box => box !== hitBox);
            }
            return prevBoxes;
          });
          
          // 敵に当たったら消滅
          const hitEnemy = enemies.some(e => e.x === newX && e.y === newY);
          if (hitEnemy) {
            setEnemies(prevEnemies => prevEnemies.filter(e => !(e.x === newX && e.y === newY)));
            setScore(prev => prev + 100);
            return;
          }
          
          if (newDistance >= needleRange) return;
          
          updated.push({
            ...needle,
            x: newX,
            y: newY,
            distance: newDistance,
          });
        });
        
        return updated;
      });
    }, NEEDLE_SPEED);
    
    return () => clearInterval(interval);
  }, [needles, map, enemies, needleRange, paused]);

  // お灸の爆発
  useEffect(() => {
    if (paused) return;
    
    const interval = setInterval(() => {
      setMoxas(prev => {
        const updated = prev.map(m => ({ ...m, timer: m.timer - 100 }));
        let exploding = updated.filter(m => m.timer <= 0);
        let allExplosions = [];
        
        // 連鎖爆発処理（爆発に巻き込まれたお灸も即座に爆発）
        const processedIds = new Set();
        
        while (exploding.length > 0) {
          const currentBatch = exploding.filter(m => !processedIds.has(m.id));
          if (currentBatch.length === 0) break;
          
          currentBatch.forEach(m => {
            processedIds.add(m.id);
            const newExplosions = [{ x: m.x, y: m.y }];
            
            // 爆発パターンによって方向を決定（艾葉取得回数による）
            let currentPattern;
            if (mugwortCount === 0 || mugwortCount === 1) {
              currentPattern = EXPLOSION_PATTERNS.CROSS; // 4方向
            } else if (mugwortCount === 2) {
              currentPattern = EXPLOSION_PATTERNS.HEXAGON; // 6方向
            } else {
              currentPattern = EXPLOSION_PATTERNS.OCTAGON; // 8方向
            }
            
            let directions = [];
            if (currentPattern === EXPLOSION_PATTERNS.CROSS) {
              directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            } else if (currentPattern === EXPLOSION_PATTERNS.HEXAGON) {
              directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]];
            } else if (currentPattern === EXPLOSION_PATTERNS.OCTAGON) {
              directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            }
            
            directions.forEach(([dx, dy]) => {
              for (let i = 1; i <= moxaDistance; i++) {
                const nx = m.x + dx * i;
                const ny = m.y + dy * i;
                
                if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) break;
                
                const cell = map[ny][nx];
                if (cell === CELL_TYPES.WALL_SOLID) break;
                
                newExplosions.push({ x: nx, y: ny });
                
                if (cell === CELL_TYPES.WALL_BREAK || 
                    cell === CELL_TYPES.TSUBO_NORMAL || 
                    cell === CELL_TYPES.TSUBO_SPECIAL ||
                    cell === CELL_TYPES.TSUBO_HIDDEN) {
                  
                  setMap(prevMap => {
                    const newMap = prevMap.map(row => [...row]);
                    const cellType = newMap[ny][nx];
                    newMap[ny][nx] = CELL_TYPES.EMPTY;
                    
                    if (cellType === CELL_TYPES.TSUBO_HIDDEN) {
                      setNeedleRange(prev => Math.min(prev + 5, 15));
                      setScore(prev => prev + 10000);
                      setSpecialTsuboEffect({ name: '隠しツボ', x: nx, y: ny });
                      setTimeout(() => setSpecialTsuboEffect(null), 1500);
                    } else if (cellType === CELL_TYPES.TSUBO_SPECIAL) {
                      const tsuboName = SPECIAL_TSUBO_NAMES[Math.floor(Math.random() * SPECIAL_TSUBO_NAMES.length)];
                      setNeedleRange(prev => Math.min(prev + 3, 15));
                      setScore(prev => prev + 5000);
                      setSpecialTsuboEffect({ name: tsuboName, x: nx, y: ny });
                      setTimeout(() => setSpecialTsuboEffect(null), 1000);
                    } else if (cellType === CELL_TYPES.TSUBO_NORMAL) {
                      setNeedleRange(prev => Math.min(prev + 1, 15));
                      setScore(prev => prev + 100);
                    } else {
                      setScore(prev => prev + 10);
                    }
                    
                    return newMap;
                  });
                  break;
                }
              }
            });
            
            allExplosions.push(...newExplosions);
          });
          
          // 爆発範囲内にある他のお灸を見つけて連鎖爆発リストに追加
          const chainMoxas = updated.filter(m => 
            !processedIds.has(m.id) && 
            allExplosions.some(exp => exp.x === m.x && exp.y === m.y)
          );
          
          exploding = chainMoxas;
        }
        
        setExplosions(prev => {
          const now = Date.now();
          return [...prev, ...allExplosions.map(exp => ({ ...exp, timestamp: now }))];
        });
        
        // 爆発音
        if (allExplosions.length > 0) {
          SoundEffects.explosion();
        }
        
        // 宝箱破壊（中身消失）
        setTreasureBoxes(prevBoxes => 
          prevBoxes.filter(box => 
            !allExplosions.some(exp => exp.x === box.x && exp.y === box.y)
          )
        );
        
        // プレイヤー自爆判定
        const playerHit = allExplosions.some(exp => 
          exp.x === player.x && exp.y === player.y
        );
        if (playerHit) {
          SoundEffects.gameOver();
          setGameOver(true);
        }
        
        // 敵へのダメージ
        setEnemies(prevEnemies => {
          const hitEnemies = prevEnemies.filter(enemy => 
            allExplosions.some(exp => exp.x === enemy.x && exp.y === enemy.y)
          );
          
          // 敵撃破音
          if (hitEnemies.length > 0) {
            SoundEffects.enemyDefeat();
          }
          
          const remaining = prevEnemies.filter(enemy => {
            const hit = allExplosions.some(exp => exp.x === enemy.x && exp.y === enemy.y);
            if (hit) setScore(prev => prev + 100);
            return !hit;
          });
          return remaining;
        });
        
        // 爆発したお灸を除外
        return updated.filter(m => !processedIds.has(m.id));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [map, mugwortCount, moxaDistance, player, paused]);

  // 爆発エフェクト削除
  useEffect(() => {
    if (explosions.length === 0) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setExplosions(prev => {
        const remaining = prev.filter(exp => now - exp.timestamp < EXPLOSION_DURATION);
        if (remaining.length === 0) {
          setCombo(0);
        }
        return remaining;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [explosions.length]);

  // 敵の移動（改善版）
  useEffect(() => {
    if (gameOver || gameWon || !gameMode || paused) return;
    
    const interval = setInterval(() => {
      setEnemies(prev => prev.map(enemy => {
        // 移動タイマー更新
        const newMoveTimer = (enemy.moveTimer || 0) + 1;
        
        // 敵タイプごとの移動間隔
        let moveInterval = 5; // デフォルト
        if (enemy.type === 'wind') moveInterval = 2; // 風邪：超速
        else if (enemy.type === 'heat') moveInterval = 3; // 熱邪：速い
        else if (enemy.type === 'plague') moveInterval = 4; // 疫邪：普通
        else if (enemy.type === 'cold') moveInterval = 6; // 寒邪：遅い
        else if (enemy.type === 'wet') moveInterval = 8; // 湿邪：超遅い
        
        if (newMoveTimer < moveInterval) {
          return { ...enemy, moveTimer: newMoveTimer };
        }
        
        const directions = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ];
        
        const validMoves = directions.filter(({ dx, dy }) => {
          const nx = enemy.x + dx;
          const ny = enemy.y + dy;
          const cell = map[ny]?.[nx];
          return nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE &&
                 cell !== CELL_TYPES.WALL_SOLID &&
                 cell !== CELL_TYPES.WALL_BREAK &&
                 cell !== CELL_TYPES.TSUBO_NORMAL &&
                 cell !== CELL_TYPES.TSUBO_SPECIAL &&
                 cell !== CELL_TYPES.TSUBO_HIDDEN &&
                 !moxas.some(m => m.x === nx && m.y === ny);
        });
        
        if (validMoves.length === 0) return { ...enemy, moveTimer: 0 };
        
        let move;
        
        // 敵タイプごとの動き
        if (enemy.type === 'heat') {
          // 熱邪：プレイヤーを追尾
          move = validMoves.reduce((best, current) => {
            const newX = enemy.x + current.dx;
            const newY = enemy.y + current.dy;
            const dist = Math.abs(player.x - newX) + Math.abs(player.y - newY);
            const bestX = enemy.x + best.dx;
            const bestY = enemy.y + best.dy;
            const bestDist = Math.abs(player.x - bestX) + Math.abs(player.y - bestY);
            return dist < bestDist ? current : best;
          }, validMoves[0]);
        } else if (enemy.type === 'plague') {
          // 疫邪：仲間に寄る
          const nearbyPlague = prev.filter(e => 
            e.type === 'plague' && e.id !== enemy.id &&
            Math.abs(e.x - enemy.x) <= 3 && Math.abs(e.y - enemy.y) <= 3
          );
          
          if (nearbyPlague.length > 0 && Math.random() < 0.7) {
            const target = nearbyPlague[0];
            move = validMoves.reduce((best, current) => {
              const newX = enemy.x + current.dx;
              const newY = enemy.y + current.dy;
              const dist = Math.abs(target.x - newX) + Math.abs(target.y - newY);
              const bestX = enemy.x + best.dx;
              const bestY = enemy.y + best.dy;
              const bestDist = Math.abs(target.x - bestX) + Math.abs(target.y - bestY);
              return dist < bestDist ? current : best;
            }, validMoves[0]);
          } else {
            move = validMoves[Math.floor(Math.random() * validMoves.length)];
          }
        } else {
          // その他：ランダム移動
          move = validMoves[Math.floor(Math.random() * validMoves.length)];
        }
        
        return { 
          ...enemy, 
          x: enemy.x + move.dx, 
          y: enemy.y + move.dy,
          moveTimer: 0 
        };
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [map, moxas, gameOver, gameWon, gameMode, player, enemies, paused]);

  // 衝突判定
  useEffect(() => {
    const hit = enemies.some(e => e.x === player.x && e.y === player.y);
    if (hit) {
      SoundEffects.gameOver();
      setGameOver(true);
    }
  }, [enemies, player]);

  // 勝利判定
  useEffect(() => {
    if (enemies.length === 0 && !gameOver && !gameWon && gameMode && gameStarted) {
      SoundEffects.stageClear();
      setGameWon(true);
      setScore(prev => prev + 10000);
    }
  }, [enemies, gameOver, gameWon, gameMode, gameStarted]);

  // 次のステージへ
  const nextStage = () => {
    if (currentStageIndex < stageKeys.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      startStage(stageKeys[nextIndex], false); // パワーアップ持ち越し
    } else {
      // 全ステージクリア
      setGameMode(null);
      setGameStarted(false);
      alert('全ステージクリア！おめでとうございます！');
    }
  };

  // モード選択画面
  if (!gameMode) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px',
        backgroundColor: '#000',
        minHeight: '100vh',
        fontFamily: '"Press Start 2P", monospace',
        color: '#fff',
      }}>
        <div style={{
          fontSize: '28px',
          marginBottom: '60px',
          color: '#ff6b6b',
          textShadow: '4px 4px 0 #000',
        }}>
          経絡ボンバー
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
        }}>
          <button
            onClick={() => selectMode('story')}
            style={{
              padding: '30px 60px',
              fontSize: '16px',
              backgroundColor: '#4ecdc4',
              color: '#000',
              border: '4px solid #fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            📖 ストーリーモード
            <div style={{ fontSize: '10px', marginTop: '10px' }}>
              順番にクリア・レベル持ち越し
            </div>
          </button>
          
          <button
            onClick={() => selectMode('free')}
            style={{
              padding: '30px 60px',
              fontSize: '16px',
              backgroundColor: '#ffd700',
              color: '#000',
              border: '4px solid #fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🎯 フリーモード
            <div style={{ fontSize: '10px', marginTop: '10px' }}>
              ステージ選択・毎回リセット
            </div>
          </button>
        </div>
      </div>
    );
  }

  // フリーモードのステージ選択
  if (gameMode === 'free' && !gameStarted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px',
        backgroundColor: '#000',
        minHeight: '100vh',
        fontFamily: '"Press Start 2P", monospace',
        color: '#fff',
      }}>
        <div style={{
          fontSize: '20px',
          marginBottom: '40px',
          color: '#ffd700',
        }}>
          ステージ選択
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}>
          {Object.entries(STAGE_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => {
                setCurrentStageIndex(stageKeys.indexOf(key));
                startStage(key, true);
              }}
              style={{
                padding: '30px',
                fontSize: '14px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '3px solid #ffd700',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {template.name}
              <div style={{ fontSize: '10px', marginTop: '10px', color: '#888' }}>
                難易度: {'★'.repeat(template.difficulty)}
              </div>
            </button>
          ))}
        </div>
        
        <button
          onClick={() => {
            setGameMode(null);
            setGameStarted(false);
          }}
          style={{
            marginTop: '40px',
            padding: '15px 30px',
            fontSize: '12px',
            backgroundColor: '#666',
            color: '#fff',
            border: '2px solid #fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          戻る
        </button>
      </div>
    );
  }

  // ゲーム画面
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      backgroundColor: '#000',
      minHeight: '100vh',
      fontFamily: '"Press Start 2P", monospace',
      color: '#fff',
    }}>
      <div style={{
        fontSize: '18px',
        marginBottom: '5px',
        color: '#ff6b6b',
      }}>
        経絡ボンバー {gameMode === 'story' ? '📖' : '🎯'}
      </div>
      
      <div style={{
        fontSize: '10px',
        marginBottom: '5px',
        color: '#4ecdc4',
      }}>
        {STAGE_TEMPLATES[currentStageKey]?.name} (Stage {currentStageIndex + 1}/{stageKeys.length})
      </div>

      <div style={{
        fontSize: '9px',
        marginBottom: '5px',
        display: 'flex',
        gap: '15px',
        justifyContent: 'space-between',
        width: GRID_SIZE * CELL_SIZE,
      }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div>SCORE: {score}</div>
          <div>敵: {enemies.length}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setPaused(!paused)}
            style={{
              padding: '3px 8px',
              fontSize: '8px',
              backgroundColor: paused ? '#4caf50' : '#ff9800',
              color: '#fff',
              border: '1px solid #fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {paused ? '▶再開' : '⏸一時停止'}
          </button>
          <button
            onClick={() => {
              setGameMode(null);
              setGameStarted(false);
              setCurrentStageIndex(0);
              setPaused(false);
            }}
            style={{
              padding: '3px 8px',
              fontSize: '8px',
              backgroundColor: '#666',
              color: '#fff',
              border: '1px solid #fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🏠戻る
          </button>
        </div>
      </div>
      
      <div style={{
        fontSize: '8px',
        marginBottom: '3px',
        display: 'flex',
        gap: '10px',
        color: '#4ecdc4',
      }}>
        <div>鍼:{getNeedleName(needleRange)}({needleRange}m)</div>
        <div>灸:{getMoxaName(mugwortCount)}({moxaDistance}m{mugwortCount < 2 ? '┼' : mugwortCount === 2 ? '⬡' : '※'}×{maxMoxas})</div>
        <div>速:Lv{speedLevel}</div>
      </div>

      {openedTsuboList.length > 0 && (
        <div style={{
          fontSize: '7px',
          marginBottom: '3px',
          color: '#ffd700',
          maxWidth: GRID_SIZE * CELL_SIZE,
          maxHeight: '40px',
          overflow: 'auto',
          whiteSpace: 'normal',
          lineHeight: '1.4',
          padding: '2px 4px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '3px',
        }}>
          開放ツボ: {aggregateList(openedTsuboList)}
        </div>
      )}

      {acquiredHerbs.length > 0 && (
        <div style={{
          fontSize: '7px',
          marginBottom: '5px',
          color: '#4ecdc4',
          maxWidth: GRID_SIZE * CELL_SIZE,
          maxHeight: '40px',
          overflow: 'auto',
          whiteSpace: 'normal',
          lineHeight: '1.4',
          padding: '2px 4px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '3px',
        }}>
          取得生薬: {aggregateList(acquiredHerbs)}
        </div>
      )}

      <div style={{
        position: 'relative',
        width: GRID_SIZE * CELL_SIZE,
        height: GRID_SIZE * CELL_SIZE,
        border: '3px solid #fff',
        backgroundColor: '#1a1a1a',
      }}>
        {/* マップ */}
        {map.map((row, y) => row.map((cell, x) => {
          if (cell === CELL_TYPES.EMPTY) return null;
          
          let bgColor = 'transparent';
          if (cell === CELL_TYPES.WALL_SOLID) bgColor = '#555';
          else if (cell === CELL_TYPES.WALL_BREAK) bgColor = '#8b4513';
          else if (cell === CELL_TYPES.TSUBO_NORMAL) bgColor = '#ffeb3b'; // 通常ツボ：黄色
          else if (cell === CELL_TYPES.TSUBO_SPECIAL) {
            // 特効ツボ：虹色点滅
            const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
            const colorIndex = Math.floor(Date.now() / 200) % colors.length;
            bgColor = colors[colorIndex];
          }
          else if (cell === CELL_TYPES.TSUBO_HIDDEN) bgColor = '#8b4513'; // 隠しツボ：茶色（壁と同じ）
          
          return (
            <div
              key={`${x}-${y}`}
              style={{
                position: 'absolute',
                left: x * CELL_SIZE,
                top: y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: bgColor,
              }}
            />
          );
        }))}

        {/* プレイヤー */}
        <div style={{
          position: 'absolute',
          left: player.x * CELL_SIZE,
          top: player.y * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor: '#4ecdc4',
          border: '1px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
        }}>
          針
        </div>

        {/* 敵 */}
        {enemies.map(enemy => (
          <div
            key={enemy.id}
            style={{
              position: 'absolute',
              left: enemy.x * CELL_SIZE,
              top: enemy.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: 
                enemy.type === 'wind' ? '#64b5f6' :
                enemy.type === 'heat' ? '#ff6b6b' :
                enemy.type === 'plague' ? '#9c27b0' :
                enemy.type === 'cold' ? '#90caf9' :
                '#4db6ac',
              border: '1px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
            }}
          >
            {enemy.type === 'wind' ? '風' :
             enemy.type === 'heat' ? '熱' :
             enemy.type === 'plague' ? '疫' :
             enemy.type === 'cold' ? '寒' : '湿'}
          </div>
        ))}

        {/* お灸 */}
        {moxas.map(moxa => (
          <div
            key={moxa.id}
            style={{
              position: 'absolute',
              left: moxa.x * CELL_SIZE,
              top: moxa.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: '#ff9800',
              border: '1px solid #fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              animation: moxa.timer < 500 ? 'blink 0.2s infinite' : 'none',
            }}
          >
            灸
          </div>
        ))}

        {/* 鍼 */}
        {needles.map(needle => (
          <div
            key={needle.id}
            style={{
              position: 'absolute',
              left: needle.x * CELL_SIZE,
              top: needle.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: '#fff',
              border: '1px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              color: '#000',
            }}
          >
            鍼
          </div>
        ))}

        {/* アイテム */}
        {items.map(item => {
          let bgColor = '#fff';
          let text = '?';
          
          if (item.type === HERB_TYPES.MUGWORT) {
            bgColor = '#ffeb3b';
            text = '艾';
          } else if (item.type === HERB_TYPES.GINGER) {
            bgColor = '#ff9800';
            text = '姜';
          } else if (item.type === HERB_TYPES.SALT) {
            bgColor = '#f44336';
            text = '塩';
          } else if (item.type === HERB_TYPES.ACONITE) {
            bgColor = '#9c27b0';
            text = '附';
          } else if (item.type === HERB_TYPES.EPHEDRA) {
            bgColor = '#2196f3';
            text = '麻';
          } else if (item.type === HERB_TYPES.ANGELICA) {
            bgColor = '#e91e63';
            text = '当';
          } else if (item.type === HERB_TYPES.HIDDEN) {
            // 虹色点滅
            const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
            const colorIndex = Math.floor(Date.now() / 100) % colors.length;
            bgColor = colors[colorIndex];
            text = '宝';
          }
          
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: item.x * CELL_SIZE,
                top: item.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: bgColor,
                border: '2px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold',
                color: '#000',
                animation: 'blink 0.5s infinite',
              }}
            >
              {text}
            </div>
          );
        })}

        {/* 宝箱 */}
        {treasureBoxes.map(box => {
          const herbInfo = HERB_INFO[box.herbType];
          let boxColor;
          
          // 虹色生薬の場合は虹色点滅
          if (box.herbType === HERB_TYPES.HIDDEN) {
            const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
            const colorIndex = Math.floor(Date.now() / 200) % colors.length;
            boxColor = colors[colorIndex];
          } else {
            // 通常は金色点滅
            const colors = ['#ffd700', '#ffed4e'];
            const colorIndex = Math.floor(Date.now() / 300) % colors.length;
            boxColor = colors[colorIndex];
          }
          
          return (
            <div
              key={box.id}
              style={{
                position: 'absolute',
                left: box.x * CELL_SIZE,
                top: box.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: boxColor,
                border: '2px solid #fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '6px',
                fontWeight: 'bold',
                color: '#000',
              }}
            >
              <div style={{ fontSize: '10px' }}>💎</div>
              {herbInfo && (
                <div style={{ fontSize: '7px', marginTop: '-2px' }}>
                  {herbInfo.char}
                </div>
              )}
            </div>
          );
        })}

        {/* 爆発 */}
        {explosions.map((exp, i) => (
          <div
            key={`${exp.x}-${exp.y}-${exp.timestamp}`}
            style={{
              position: 'absolute',
              left: exp.x * CELL_SIZE,
              top: exp.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: '#ffd700',
              border: '1px solid #fff',
              animation: 'explosion 0.5s',
            }}
          />
        ))}

        {/* 特効ツボ演出 */}
        {specialTsuboEffect && (
          <div style={{
            position: 'absolute',
            left: specialTsuboEffect.x * CELL_SIZE - 20,
            top: specialTsuboEffect.y * CELL_SIZE - 30,
            fontSize: '14px',
            color: '#ffd700',
            fontWeight: 'bold',
            textShadow: '2px 2px 0 #000',
            animation: 'float 1s',
            pointerEvents: 'none',
          }}>
            {specialTsuboEffect.name}！
          </div>
        )}

        {/* 生薬取得メッセージ */}
        {herbMessage && (
          <div style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: `3px solid ${herbMessage.color}`,
            padding: '15px 25px',
            borderRadius: '8px',
            textAlign: 'center',
            animation: 'popup 1.5s',
            pointerEvents: 'none',
            zIndex: 100,
          }}>
            <div style={{
              fontSize: '16px',
              color: herbMessage.color,
              fontWeight: 'bold',
              marginBottom: '8px',
            }}>
              {herbMessage.name} 取得！
            </div>
            <div style={{
              fontSize: '10px',
              color: '#fff',
            }}>
              {herbMessage.effect}
            </div>
          </div>
        )}

        {/* 一時停止メニュー */}
        {paused && (
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              padding: '30px',
              border: '3px solid #4ecdc4',
              textAlign: 'center',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '20px', color: '#4ecdc4' }}>
                ⏸ 一時停止
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => setPaused(false)}
                  style={{
                    padding: '12px 30px',
                    fontSize: '12px',
                    backgroundColor: '#4caf50',
                    color: '#fff',
                    border: '2px solid #fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ▶ 再開
                </button>
                <button
                  onClick={() => {
                    setPaused(false);
                    startStage(currentStageKey, gameMode === 'free');
                  }}
                  style={{
                    padding: '12px 30px',
                    fontSize: '12px',
                    backgroundColor: '#ff9800',
                    color: '#fff',
                    border: '2px solid #fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  🔄 リトライ
                </button>
                <button
                  onClick={() => {
                    setPaused(false);
                    setGameMode(null);
                    setGameStarted(false);
                    setCurrentStageIndex(0);
                  }}
                  style={{
                    padding: '12px 30px',
                    fontSize: '12px',
                    backgroundColor: '#666',
                    color: '#fff',
                    border: '2px solid #fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  🏠 スタート画面へ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ゲームオーバー */}
        {gameOver && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            padding: '30px',
            border: '3px solid #ff6b6b',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '18px', marginBottom: '15px', color: '#ff6b6b' }}>
              気虚...
            </div>
            <div style={{ fontSize: '14px', marginBottom: '25px' }}>
              SCORE: {score}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => startStage(currentStageKey, gameMode === 'free')}
                style={{
                  padding: '10px 20px',
                  fontSize: '10px',
                  backgroundColor: '#4ecdc4',
                  color: '#fff',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                リトライ
              </button>
              <button
                onClick={() => {
                  setGameMode(null);
                  setGameStarted(false);
                  setCurrentStageIndex(0);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '10px',
                  backgroundColor: '#666',
                  color: '#fff',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                戻る
              </button>
            </div>
          </div>
        )}

        {/* ゲームクリア */}
        {gameWon && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            padding: '30px',
            border: '3px solid #ffd700',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '18px', marginBottom: '15px', color: '#ffd700' }}>
              経絡開通！
            </div>
            <div style={{ fontSize: '14px', marginBottom: '25px' }}>
              SCORE: {score}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {gameMode === 'story' && currentStageIndex < stageKeys.length - 1 && (
                <button
                  onClick={nextStage}
                  style={{
                    padding: '10px 20px',
                    fontSize: '10px',
                    backgroundColor: '#4caf50',
                    color: '#fff',
                    border: '2px solid #fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  次のステージ
                </button>
              )}
              <button
                onClick={() => startStage(currentStageKey, gameMode === 'free')}
                style={{
                  padding: '10px 20px',
                  fontSize: '10px',
                  backgroundColor: '#4ecdc4',
                  color: '#fff',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                もう一度
              </button>
              <button
                onClick={() => {
                  setGameMode(null);
                  setGameStarted(false);
                  setCurrentStageIndex(0);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '10px',
                  backgroundColor: '#666',
                  color: '#fff',
                  border: '2px solid #fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                戻る
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 操作説明 */}
      <div style={{
        marginTop: '12px',
        fontSize: '8px',
        textAlign: 'center',
        lineHeight: '1.5',
      }}>
        <div>↑↓←→:移動 | SPACE:お灸 | Z↑X↓C←V→:鍼</div>
        <div style={{ marginTop: '5px', color: '#ffd700' }}>
          虹色ツボ&生薬で超強化！
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.5; }
        }
        
        @keyframes explosion {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        @keyframes float {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        
        @keyframes popup {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default KeirakuBomber;
