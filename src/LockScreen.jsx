import { useState } from 'react';

export const LockScreen = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your Master Password.');
      return;
    }
    setError('');
    onUnlock(password);
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 8px 0' }}>🔒 Vault Locked</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
          Enter your Master Password to decrypt and access NoteFlow.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master Password"
            autoFocus
            style={inputStyle}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px 0' }}>{error}</p>}
          <button type="submit" style={buttonStyle}>
            Unlock Vault
          </button>
        </form>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  padding: '32px',
  borderRadius: '12px',
  width: 'min(380px, 90%)',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
  textAlign: 'center',
  fontFamily: 'sans-serif',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: '16px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '15px',
  boxSizing: 'border-box',
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: '#0f172a',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
};