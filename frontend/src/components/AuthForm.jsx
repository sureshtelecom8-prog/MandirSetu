import { useState } from 'react';
import { ArrowRight, Flower2, ShieldCheck } from 'lucide-react';
import { OtpDialog } from './OtpDialog';
import { tw } from '../lib/tw';

function getErrorMessage(caught) {
    const message = caught instanceof Error ? caught.message : 'The request could not be completed. Please try again.';
    if (/email signups are disabled|signups? (are )?not allowed|signup is disabled/i.test(message)) {
        return 'Email signups are disabled in this Supabase project. Enable new user signups and the Email provider in Authentication settings.';
    }
    return message;
}

export function AuthForm({ client }) {
    const [mode, setMode] = useState('login');
    const [role, setRole] = useState('PRIEST');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [otpOpen, setOtpOpen] = useState(false);
    const [otpEmail, setOtpEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpNotice, setOtpNotice] = useState('');

    const setView = (nextMode) => {
        setMode(nextMode);
        setError('');
        setNotice('');
    };

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setNotice('');
        const normalizedEmail = email.trim().toLowerCase();
        if (mode === 'register') {
            if (name.trim().length < 2) {
                setError('Enter your full name.');
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
            if (!consent) {
                setError('Please acknowledge the privacy notice and consent to profile information being used for this service.');
                return;
            }
        }

        setLoading(true);
        try {
            if (mode === 'register') {
                const { data, error: signUpError } = await client.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        data: {
                            full_name: name.trim(),
                            account_type: role,
                            privacy_consent: true,
                            privacy_notice_version: '2026-11-25',
                        },
                    },
                });
                if (signUpError)
                    throw signUpError;
                setEmail(normalizedEmail);
                if (!data.session) {
                    setOtpEmail(normalizedEmail);
                    setOtpCode('');
                    setOtpError('');
                    setOtpNotice('');
                    setOtpOpen(true);
                }
            }
            else {
                const { error: signInError } = await client.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });
                if (signInError)
                    throw signInError;
            }
        }
        catch (caught) {
            setError(getErrorMessage(caught));
        }
        finally {
            setLoading(false);
        }
    };

    const resendCode = async () => {
        setLoading(true);
        setOtpError('');
        setOtpNotice('');
        try {
            const { error: requestError } = await client.auth.resend({
                type: 'signup',
                email: otpEmail,
            });
            if (requestError)
                throw requestError;
            setOtpCode('');
            setOtpNotice('A new code has been sent.');
        }
        catch (caught) {
            setOtpError(getErrorMessage(caught));
        }
        finally {
            setLoading(false);
        }
    };

    const verifyCode = async (event) => {
        event.preventDefault();
        setLoading(true);
        setOtpError('');
        setOtpNotice('');
        try {
            const { error: verifyError } = await client.auth.verifyOtp({
                email: otpEmail,
                token: otpCode,
                type: 'signup',
            });
            if (verifyError)
                throw verifyError;
            setOtpOpen(false);
        }
        catch (caught) {
            setOtpError(getErrorMessage(caught));
        }
        finally {
            setLoading(false);
        }
    };

    const requestPasswordReset = async () => {
        setError('');
        setNotice('');
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError('Enter your email address first.');
            return;
        }
        setLoading(true);
        try {
            const { error: resetError } = await client.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: window.location.origin,
            });
            if (resetError)
                throw resetError;
            setNotice('If an account exists for this email, a password reset link has been sent.');
        }
        catch (caught) {
            setError(getErrorMessage(caught));
        }
        finally {
            setLoading(false);
        }
    };

    const closeOtp = () => {
        setOtpOpen(false);
        setOtpCode('');
        setOtpEmail('');
        setOtpError('');
        setOtpNotice('');
    };

    const isRegister = mode === 'register';
    return (<>
      <main className={tw("auth-page grid min-h-screen")}>
        <section className={tw("auth-story")}>
          <div className={tw("auth-brand")}><span className={tw("brand-mark")}><Flower2 size={21}/></span> MandirSetu</div>
          <div className={tw("auth-story-copy")}>
            <span className={tw("eyebrow light-eyebrow")}>A community rooted in seva</span>
            <h1>Where devotion<br />finds its calling.</h1>
            <p>Bringing temples and dedicated priests together to serve communities with care.</p>
          </div>
          <div className={tw("story-foot")}><ShieldCheck size={17}/> Human-led review. Documents always optional.</div>
        </section>

        <section className={tw("auth-panel")}>
          <div className={tw("mobile-brand")}><span className={tw("brand-mark")}><Flower2 size={19}/></span> MandirSetu</div>
          <div className={tw("auth-card")}>
            <span className={tw("eyebrow")}>{isRegister ? 'Join the community' : 'Welcome back'}</span>
            <h2>{isRegister ? 'Create your account' : 'Sign in to MandirSetu'}</h2>
            <p className={tw("muted auth-intro")}>
              {isRegister
                ? 'Create your account with an email address and password.'
                : 'Sign in with the email address and password for your account.'}
            </p>

            <form onSubmit={submit} className={tw("form-stack")}>
              {isRegister && (<>
                  <label className={tw("field")}>
                    <span>Full name</span>
                    <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required minLength={2} maxLength={120}/>
                  </label>
                  <fieldset className={tw("role-picker")}>
                    <legend>I'm here as</legend>
                    <label className={(role === 'PRIEST' ? tw("role-option selected") : tw("role-option"))}>
                      <input type="radio" name="role" checked={role === 'PRIEST'} onChange={() => setRole('PRIEST')}/>
                      <span><strong>Priest</strong><small>Explore seva opportunities</small></span>
                    </label>
                    <label className={(role === 'TEMPLE_MANAGEMENT' ? tw("role-option selected") : tw("role-option"))}>
                      <input type="radio" name="role" checked={role === 'TEMPLE_MANAGEMENT'} onChange={() => setRole('TEMPLE_MANAGEMENT')}/>
                      <span><strong>Temple management</strong><small>Build your temple profile</small></span>
                    </label>
                  </fieldset>
                </>)}

              <label className={tw("field")}>
                <span>Email address</span>
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/>
              </label>

              <label className={tw("field")}>
                <span>{isRegister ? 'Password (at least 8 characters)' : 'Password'}</span>
                <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isRegister ? 8 : undefined}/>
              </label>

              {isRegister && <label className={tw("field")}>
                <span>Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8}/>
              </label>}

              {isRegister && (<label className={tw("consent-row")}>
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>
                  <span>I have read the <a href="/privacy.html" target="_blank" rel="noreferrer">privacy notice</a> and consent to the use of my profile information for this service.</span>
                </label>)}

              {error && <p className={tw("form-message error-message")} role="alert">{error}</p>}
              {notice && <p className={tw("form-message success-message")} role="status">{notice}</p>}

              <button type="submit" className={tw("button button-primary full-button")} disabled={loading}>
                {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
                {!loading && <ArrowRight size={17}/>}
              </button>
            </form>

            {!isRegister && <div className={tw("auth-switch")}>
              <button type="button" className={tw("text-button")} onClick={() => void requestPasswordReset()} disabled={loading}>Forgot password?</button>
            </div>}

            <div className={tw("auth-switch")}>
              {isRegister
                ? <>Already a member? <button type="button" className={tw("text-button")} onClick={() => setView('login')}>Sign in</button></>
                : <span>New to MandirSetu? <button type="button" className={tw("text-button")} onClick={() => setView('register')}>Create an account</button></span>}
            </div>
            <p className={tw("auth-disclaimer")}>Email confirmation verifies access to your inbox, not your identity. Manual platform review is not government certification.</p>
          </div>
        </section>
      </main>
      {otpOpen && <OtpDialog
        email={otpEmail}
        code={otpCode}
        error={otpError}
        notice={otpNotice}
        loading={loading}
        onChangeCode={setOtpCode}
        onVerify={verifyCode}
        onResend={resendCode}
        onClose={closeOtp}
      />}
    </>);
}
