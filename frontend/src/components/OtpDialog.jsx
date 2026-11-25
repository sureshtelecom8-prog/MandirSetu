import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { tw } from '../lib/tw';

export function OtpDialog({
    email,
    code,
    error,
    notice,
    loading,
    onChangeCode,
    onVerify,
    onResend,
    onClose,
}) {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog)
            return;
        if (!dialog.open)
            dialog.showModal();
        return () => {
            if (dialog.open)
                dialog.close();
        };
    }, []);

    return (
      <dialog
        ref={dialogRef}
        aria-labelledby="otp-dialog-title"
        onCancel={(event) => {
            event.preventDefault();
            onClose();
        }}
        style={{
            boxSizing: 'border-box',
            background: 'transparent',
            border: 0,
            inset: 0,
            margin: 'auto',
            maxHeight: 'calc(100vh - 32px)',
            maxWidth: 'calc(100vw - 32px)',
            overflowY: 'auto',
            padding: 0,
            position: 'fixed',
            width: 'min(430px, calc(100vw - 32px))',
        }}
      >
        <div
          className={tw("auth-card")}
          style={{
              background: '#fff',
              border: '1px solid #eae8e1',
              borderRadius: '16px',
              boxShadow: '0 16px 55px rgba(48, 42, 30, .18)',
              boxSizing: 'border-box',
              padding: '32px',
              width: '100%',
          }}
        >
          <span className={tw("eyebrow")}>Email verification</span>
          <h2 id="otp-dialog-title">Enter your 6-digit code</h2>
          <p className={tw("muted auth-intro")}>We sent a one-time code to <strong>{email}</strong>.</p>
          <form onSubmit={onVerify} className={tw("form-stack")}>
            <label className={tw("field")}>
              <span>One-time code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => onChangeCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                aria-label="Six-digit email verification code"
                required
              />
            </label>
            {error && <p className={tw("form-message error-message")} role="alert">{error}</p>}
            {notice && <p className={tw("form-message success-message")} role="status">{notice}</p>}
            <button type="submit" className={tw("button button-primary full-button")} disabled={loading || code.length !== 6}>
              {loading ? 'Verifying…' : 'Verify and continue'}
              {!loading && <ArrowRight size={17}/>}
            </button>
          </form>
          <div className={tw("auth-switch")}>
            <button type="button" className={tw("text-button")} onClick={onClose}>Change email</button>
            <button type="button" className={tw("text-button")} onClick={onResend} disabled={loading}>Resend code</button>
          </div>
        </div>
      </dialog>
    );
}
