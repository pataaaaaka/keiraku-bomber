import React, { useState, useEffect } from 'react';
import KeirakuBomber from './KeirakuBomber';

// 仮想ゲームパッドコンポーネント（改善版）
const VirtualGamepad = ({ onButtonPress }) => {
  const [activeButton, setActiveButton] = useState(null);

  const handleButton = (key, label) => {
    setActiveButton(label);
    onButtonPress(key);
    setTimeout(() => setActiveButton(null), 100);
  };

  const buttonStyle = (label) => ({
    width: '55px',
    height: '55px',
    borderRadius: '50%',
    border: '2px solid #4ecdc4',
    backgroundColor: activeButton === label ? '#4ecdc4' : 'rgba(78, 205, 196, 0.2)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    userSelect: 'none',
    transition: 'all 0.1s',
    cursor: 'pointer',
    boxShadow: activeButton === label ? '0 0 10px rgba(78, 205, 196, 0.5)' : 'none',
  });

  return (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      backgroundColor: 'rgba(26, 26, 46, 0.95)',
      padding: '15px 10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      zIndex: 1000,
      borderTop: '2px solid rgba(78, 205, 196, 0.3)',
    }}>
      {/* 左側：十字キー */}
      <div style={{ 
        position: 'relative', 
        width: '165px', 
        height: '165px',
        flexShrink: 0,
      }}>
        <div 
          onTouchStart={() => handleButton('ArrowUp', '↑')}
          onClick={() => handleButton('ArrowUp', '↑')}
          style={{ ...buttonStyle('↑'), position: 'absolute', top: '0', left: '55px' }}
        >
          ↑
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowLeft', '←')}
          onClick={() => handleButton('ArrowLeft', '←')}
          style={{ ...buttonStyle('←'), position: 'absolute', top: '55px', left: '0' }}
        >
          ←
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowRight', '→')}
          onClick={() => handleButton('ArrowRight', '→')}
          style={{ ...buttonStyle('→'), position: 'absolute', top: '55px', left: '110px' }}
        >
          →
        </div>
        <div 
          onTouchStart={() => handleButton('ArrowDown', '↓')}
          onClick={() => handleButton('ArrowDown', '↓')}
          style={{ ...buttonStyle('↓'), position: 'absolute', top: '110px', left: '55px' }}
        >
          ↓
        </div>
      </div>

      {/* 中央：お灸ボタン */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div 
          onTouchStart={() => handleButton(' ', 'お灸')}
          onClick={() => handleButton(' ', 'お灸')}
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            border: '3px solid #ff6b6b',
            backgroundColor: activeButton === 'お灸' ? '#ff6b6b' : 'rgba(255, 107, 107, 0.2)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
            userSelect: 'none',
            cursor: 'pointer',
            boxShadow: activeButton === 'お灸' ? '0 0 15px rgba(255, 107, 107, 0.5)' : 'none',
            transition: 'all 0.1s',
          }}
        >
          🔥<br/>お灸
        </div>
      </div>

      {/* 右側：鍼ボタン（2x2グリッド） */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '55px 55px',
        gridTemplateRows: '55px 55px',
        gap: '10px',
        flexShrink: 0,
      }}>
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
      const windowWidth = window.innerWidth - 20;
      // モバイルの場合、仮想パッド分の高さ（195px）を引く
      const windowHeight = mobile ? window.innerHeight - 195 : window.innerHeight - 100;
      
      const scaleX = windowWidth / gameWidth;
      const scaleY = windowHeight / gameHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      
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
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: isMobile ? 'flex-start' : 'center',
      paddingTop: isMobile ? '10px' : '0',
      paddingBottom: isMobile ? '195px' : '0', // 仮想パッドの高さ分
      overflow: 'hidden',
      position: 'relative',
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
            overflow: hidden;
            touch-action: none;
            position: fixed;
            width: 100%;
            height: 100%;
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

