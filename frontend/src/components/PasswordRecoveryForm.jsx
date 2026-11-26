import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { tw } from '../lib/tw';

export function PasswordRecoveryForm({ client, onComplete }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await client.auth.updateUser({ password });
            if (updateError)
                throw updateError;
            onComplete();
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : 'The password could not be updated. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };

    return (
      <main className={tw("auth-page grid min-h-screen")}>
        <section className={tw("auth-panel")}>
          <div className={tw("auth-card")}>
            <span className={tw("eyebrow")}>Account security</span>
            <h2>Choose a new password</h2>
            <p className={tw("muted auth-intro")}>Use at least 8 characters for your password.</p>
            <form onSubmit={submit} className={tw("form-stack")}>
              <label className={tw("field")}>
                <span>New password</span>
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8}/>
              </label>
              <label className={tw("field")}>
                <span>Confirm new password</span>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8}/>
              </label>
              {error && <p className={tw("form-message error-message")} role="alert">{error}</p>}
              <button type="submit" className={tw("button button-primary full-button")} disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
                {!loading && <ArrowRight size={17}/>}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
}
