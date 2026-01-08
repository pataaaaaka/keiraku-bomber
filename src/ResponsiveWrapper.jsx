import React, { useState, useEffect } from 'react';
import KeirakuBomber from './KeirakuBomber';

// 仮想ゲームパッドコンポーネント
const VirtualGamepad = ({ onButtonPress }) => {
  const [activeButton, setActiveButton] = useState(null);

  const handleButton = (key, label) => {
    setActiveButton(label);
    onButtonPress(key);
    setTimeout(() => setActiveButton(null), 100);
  };

  const buttonStyle = (label) => ({
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: '3px solid #4ecdc4',
    backgroundColor: activeButton === label ? '#4ecdc4' : 'rgba(78, 205, 196, 0.3)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    userSelect: 'none',
    transition: 'all 0.1s',
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '0',
      right: '0',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0 20px',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      {/* 十字キー */}
      <div style={{ pointerEvents: 'auto', position: 'relative', width: '180px', height: '180px' }}>
        <div 
          onTouchStart={() => handleButton('ArrowUp', '↑')}
          onClick={() => handleButton('ArrowUp', '↑')}
          style={{ ...buttonStyle('↑'), position: 'absolute', top: '0', left: '60px' }}
        >
          ↑
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowLeft', '←')}
          onClick={() => handleButton('ArrowLeft', '←')}
          style={{ ...buttonStyle('←'), position: 'absolute', top: '60px', left: '0' }}
        >
          ←
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowRight', '→')}
          onClick={() => handleButton('ArrowRight', '→')}
          style={{ ...buttonStyle('→'), position: 'absolute', top: '60px', left: '120px' }}
        >
          →
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowDown', '↓')}
          onClick={() => handleButton('ArrowDown', '↓')}
          style={{ ...buttonStyle('↓'), position: 'absolute', top: '120px', left: '60px' }}
        >
          ↓
        </div>
      </div>

      {/* アクションボタン */}
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div 
            onTouchStart={() => handleButton('z', 'Z')}
            onClick={() => handleButton('z', 'Z')}
            style={buttonStyle('Z')}
          >
            Z<br/>↑
          </div>
          <div 
            onTouchStart={() => handleButton('c', 'C')}
            onClick={() => handleButton('c', 'C')}
            style={buttonStyle('C')}
          >
            C<br/>←
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div 
            onTouchStart={() => handleButton('x', 'X')}
            onClick={() => handleButton('x', 'X')}
            style={buttonStyle('X')}
          >
            X<br/>↓
          </div>
          <div 
            onTouchStart={() => handleButton('v', 'V')}
            onClick={() => handleButton('v', 'V')}
            style={buttonStyle('V')}
          >
            V<br/>→
          </div>
        </div>
      </div>

      {/* お灸ボタン */}
      <div style={{ pointerEvents: 'auto' }}>
        <div 
          onTouchStart={() => handleButton(' ', 'お灸')}
          onClick={() => handleButton(' ', 'お灸')}
          style={{
            ...buttonStyle('お灸'),
            width: '80px',
            height: '80px',
            fontSize: '16px',
            backgroundColor: activeButton === 'お灸' ? '#ff6b6b' : 'rgba(255, 107, 107, 0.3)',
            border: '3px solid #ff6b6b',
          }}
        >
          🔥<br/>お灸
        </div>
      </div>
    </div>
  );
};

// レスポンシブラッパー
const ResponsiveKeirakuBomber = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // ゲームエリアのスケール計算
      const gameWidth = 32 * 18; // GRID_SIZE * CELL_SIZE
      const gameHeight = 32 * 18 + 100; // +UIの高さ
      const windowWidth = window.innerWidth - 40;
      const windowHeight = mobile ? window.innerHeight - 240 : window.innerHeight - 100;
      
      const scaleX = windowWidth / gameWidth;
      const scaleY = windowHeight / gameHeight;
      const newScale = Math.min(scaleX, scaleY, 1.2);
      
      setScale(newScale);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // 仮想キーボードイベント送信
  const handleVirtualButton = (key) => {
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: isMobile ? 'flex-start' : 'center',
      padding: isMobile ? '10px 0 200px 0' : '20px',
      overflow: isMobile ? 'auto' : 'hidden',
    }}>
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
        transition: 'transform 0.3s ease',
      }}>
        <KeirakuBomber />
      </div>
      
      {isMobile && <VirtualGamepad onButtonPress={handleVirtualButton} />}
      
      <style>{`
        @media (max-width: 767px) {
          body {
            overflow-x: hidden;
            touch-action: pan-y;
          }
        }
        
        /* PWAインストール時のフルスクリーン対応 */
        @media (display-mode: standalone) {
          body {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
};

export default ResponsiveKeirakuBomber;
