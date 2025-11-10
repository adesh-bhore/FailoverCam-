import React, { useState } from 'react';
import { Lock, Check, LockKeyhole, X } from 'lucide-react';

export default function Locker() {
  const [code, setCode] = useState('');
  const [rotation, setRotation] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [shake, setShake] = useState(false);
  
  const correctCode = '1234';
  const maxDigits = 4;

  const handleNumberClick = (num) => {
    if (code.length < maxDigits && !isUnlocked) {
      const newCode = code + num;
      setCode(newCode);
      setRotation(prev => prev + 90);
      
      if (newCode.length === maxDigits) {
        setTimeout(() => checkCode(newCode), 300);
      }
    }
  };

  const checkCode = (enteredCode) => {
    if (enteredCode === correctCode) {
      setIsUnlocked(true);
      setTimeout(() => setDoorOpen(true), 500);
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setCode('');
        setRotation(0);
      }, 500);
    }
  };

  const reset = () => {
    setCode('');
    setRotation(0);
    setIsUnlocked(false);
    setDoorOpen(false);
  };

  const clearCode = () => {
    if (!isUnlocked) {
      setCode('');
      setRotation(0);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Locker Container */}
        <div 
          className={`relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl shadow-2xl border-4 border-gray-700 p-8 transition-all duration-500 ${
            shake ? 'animate-shake' : ''
          }`}
          style={{
            minHeight: '600px',
            perspective: '1200px'
          }}
        >
          {/* Door */}
          <div 
            className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900 rounded-3xl transition-all duration-1000 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
              transform: doorOpen ? 'rotateY(-120deg)' : 'rotateY(0deg)',
              zIndex: doorOpen ? 5 : 10
            }}
          >
            {/* Door Handle */}
            <div className="absolute top-1/2 right-8 transform -translate-y-1/2 w-4 h-20 bg-gradient-to-r from-yellow-600 to-yellow-800 rounded-full shadow-lg"></div>
            
            {/* Door Content */}
            <div className="h-full flex flex-col items-center justify-start p-8 space-y-6">
              {/* Header */}
              <div className="flex items-center gap-2">
                <LockKeyhole className="w-6 h-6 text-cyan-400" />
                <h3 className="text-xl font-bold text-gray-200 tracking-wider">SECURE VAULT</h3>
              </div>

              {/* Digital Display */}
              <div className="w-full bg-black rounded-xl p-4 border-4 border-cyan-500 shadow-lg shadow-cyan-500/30">
                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-12 h-16 flex items-center justify-center text-4xl font-bold rounded-lg transition-all duration-300 ${
                        code[i] 
                          ? 'text-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-500/50' 
                          : 'text-gray-700 bg-gray-900'
                      }`}
                    >
                      {code[i] ? '●' : '○'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ship Wheel */}
              <div className="relative w-22 h-22 my-4">
                <div 
                  className="w-full h-full transition-transform duration-500"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  {/* Outer Ring */}
                  <div className="absolute inset-0 rounded-full border-8 border-gray-600 bg-gradient-to-br from-gray-500 to-gray-800 shadow-2xl"></div>
                  
                  {/* Ship Wheel Spokes */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i}>
                      {/* Main Spoke */}
                      <div 
                        className="absolute bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 shadow-lg"
                        style={{
                          width: '8px',
                          height: '50%',
                          top: '50%',
                          left: '50%',
                          transformOrigin: 'top center',
                          transform: `translateX(-50%) rotate(${i * 45}deg)`,
                          borderRadius: '4px'
                        }}
                      />
                      {/* Handle at end of spoke */}
                      <div 
                        className="absolute w-6 h-3 bg-gradient-to-br from-gray-500 to-gray-700 rounded-full shadow-md border-2 border-gray-600"
                        style={{
                          top: '8%',
                          left: '50%',
                          transformOrigin: '50% 58px',
                          transform: `translate(-50%, 0) rotate(${i * 45}deg) translateY(-4px)`
                        }}
                      />
                    </div>
                  ))}
                  
                  {/* Red Indicator Spoke */}
                  <div 
                    className="absolute w-2 h-16 bg-gradient-to-b from-red-500 to-red-700 rounded-full shadow-lg shadow-red-500/50"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -100%)',
                      transformOrigin: 'bottom center'
                    }}
                  />
                  
                  {/* Center Hub */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border-4 shadow-xl ${
                      isUnlocked 
                        ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' 
                        : 'bg-gradient-to-br from-gray-700 to-gray-900 border-gray-600'
                    }`}>
                      <Lock className={`w-8 h-8 ${isUnlocked ? 'text-white' : 'text-gray-300'}`} />
                    </div>
                  </div>
                </div>
                
                {/* Top Marker */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full shadow-lg shadow-red-500/50 border-2 border-red-700"></div>
              </div>

              {/* Number Pad */}
              <div className="w-full space-y-3">
                {/* Numbers 1-9 */}
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumberClick(num.toString())}
                      disabled={isUnlocked}
                      className="h-14 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 hover:from-cyan-600 hover:to-cyan-800 text-white font-bold text-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 border-2 border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-400"
                    >
                      {num}
                    </button>
                  ))}
                </div>
                
                {/* Bottom Row */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={clearCode}
                    disabled={isUnlocked}
                    className="h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold text-sm shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 border-2 border-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleNumberClick('0')}
                    disabled={isUnlocked}
                    className="h-14 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 hover:from-cyan-600 hover:to-cyan-800 text-white font-bold text-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 border-2 border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-400"
                  >
                    0
                  </button>
                  <div className="h-14"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Success Content Behind Door */}
          <div 
            className={`absolute inset-0 flex items-center justify-center p-8 transition-all duration-700 ${
              doorOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
            style={{ zIndex: 1 }}
          >
            <div className="text-center space-y-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-50 animate-pulse"></div>
                <div className="relative w-32 h-32 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
                  <Check className="w-20 h-20 text-white" strokeWidth={3} />
                </div>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-5xl font-bold text-green-400">
                  Access Granted!
                </h2>
                <p className="text-gray-300 text-xl">🔓 Vault Unlocked</p>
              </div>
              
              <button
                onClick={reset}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-bold text-lg shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
              >
                🔒 Lock Again
              </button>
            </div>
          </div>
        </div>

        {/* Hint */}
        {!isUnlocked && (
          <div className="text-center mt-6 space-y-1">
            <p className="text-gray-400 text-sm">Enter the 4-digit code to unlock</p>
            <p className="text-gray-500 text-xs">
              Try: <span className="text-cyan-400 font-mono font-bold">1234</span>
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}