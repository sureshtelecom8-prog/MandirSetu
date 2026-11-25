import { useEffect, useState } from 'react';
import { Flower2, ShieldCheck } from 'lucide-react';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { tw } from './lib/tw';
function App() {
    const [session, setSession] = useState(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const client = supabase;
    useEffect(() => {
        if (!client)
            return;
        void client.auth.getSession().then(({ data, error }) => {
            if (error)
                console.error('Unable to restore the Supabase session:', error.message);
            setSession(data.session);
            setCheckingSession(false);
        });
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
        });
        return () => subscription.unsubscribe();
    }, [client]);
    if (!isSupabaseConfigured || !client) {
        return (<main className={tw("setup-screen")}>
        <div className={tw("setup-card")}>
          <div className={tw("auth-brand")}><span className={tw("brand-mark")}><Flower2 size={21}/></span> MandirSetu</div>
          <span className={tw("setup-icon")}><ShieldCheck size={23}/></span>
          <span className={tw("eyebrow")}>ONE LAST SETUP STEP</span>
          <h1>Connect your Supabase project</h1>
          <p>Authentication and private profile data are intentionally unavailable until you configure the project URL and public anon key.</p>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
            <li>Add your Supabase project URL and anon key.</li>
            <li>Apply the migration and follow the setup guide.</li>
          </ol>
          <p className={"setup-warning"}>Never add a service-role key to frontend environment variables.</p>
        </div>
      </main>);
    }
    const activeClient = client;
    if (checkingSession)
        return <main className={tw("loading-screen")}><span className={tw("loader")}/>Restoring your secure session…</main>;
    if (session && !session.user.email) {
        return <main className={tw("loading-screen")}><div className={tw("error-card")}><h2>Email sign-in required</h2><p>This phone-only account cannot sign in to the email-based app. Sign out and create an account with an email address.</p><button className={tw("button button-outline")} onClick={() => { void activeClient.auth.signOut(); }}>Sign out</button></div></main>;
    }
    if (!session)
        return <AuthForm client={activeClient}/>;
    return (<Dashboard client={activeClient} userId={session.user.id} onSignOut={() => { void activeClient.auth.signOut(); }}/>);
}
export default App;
