import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api';
import type { User } from './api';

const plansFallback = [
  {
    id: 1,
    name: 'Plano Mensal',
    price: 59.9,
    period: 'mês',
    description: 'Treinos e acompanhamento pela plataforma.',
  },
  {
    id: 2,
    name: 'Plano Trimestral',
    price: 161.7,
    period: 'trimestre',
    description: 'Economia e acompanhamento por 3 meses.',
  },
  {
    id: 999999,
    name: 'Plano Teste',
    price: 0,
    period: '20 dias',
    description: 'Teste gratuito da plataforma por 20 dias, sem cobrança.',
    duration_days: 20,
  },
];

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches,
  );
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const before = (event: any) => {
      event.preventDefault();
      setPrompt(event);
    };

    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);

    return () => {
      window.removeEventListener('beforeinstallprompt', before);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return {
    canInstall: Boolean(prompt),
    installed,
    isIOS,
    install,
  };
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((x) => setUser(x.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Splash />;

  if (!user) {
    return (
      <Auth
        onAuth={(u, t) => {
          localStorage.setItem('afit_token', t);
          setUser(u);
        }}
      />
    );
  }

  return (
    <Shell
      user={user}
      onLogout={() => {
        localStorage.removeItem('afit_token');
        setUser(null);
      }}
      refresh={() => {
        api.me().then((x) => setUser(x.user)).catch(() => {});
      }}
    />
  );
}

const Splash = () => (
  <div className="center">
    <img src="/afit-logo.jpg" className="logo" alt="AFIT" />
    <div className="spinner" />
  </div>
);

function InstallCard() {
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const [showIOS, setShowIOS] = useState(false);

  if (installed) return null;

  return (
    <div className="installCard">
      <div>
        <b>Instale o AFIT no celular</b>
        <small>Use em tela cheia, como um aplicativo.</small>
      </div>

      {canInstall ? (
        <button onClick={install}>Instalar</button>
      ) : isIOS ? (
        <button onClick={() => setShowIOS(!showIOS)}>Como instalar</button>
      ) : null}

      {showIOS && (
        <p>
          No iPhone: toque em <b>Compartilhar</b> e depois em{' '}
          <b>Adicionar à Tela de Início</b>.
        </p>
      )}
    </div>
  );
}

function Auth({ onAuth }: { onAuth: (u: User, t: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'setup'>('login');
  const [form, setForm] = useState<any>({
    name: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    setupToken: '',
  });
  const [error, setError] = useState('');
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [reset, setReset] = useState({email:'',cpf5:'',password:'',confirm:''});

  useEffect(() => {
    api
      .setupStatus()
      .then((r) => setSetupAvailable(!r.configured))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'setup') {
        await api.setupAdmin({
          name: form.name,
          email: form.email,
          password: form.password,
          setupToken: form.setupToken,
        });

        setMode('login');
        setError(
          'Administrador criado. Agora entre com o e-mail e a senha cadastrados.',
        );
        return;
      }

      const r =
        mode === 'login'
          ? await api.login(form.email, form.password)
          : await api.register(form);

      onAuth(r.user, r.token);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <main className="auth">
      <section className="hero">
        <img className="brand" src="/afit-logo.jpg" alt="AFIT" />
        <img className="coach" src="/personal-afit.jpg" alt="Personal AFIT" />

        <div className="heroCopy">
          <h1>
            Seu corpo.
            <br />
            Sua meta.
            <br />
            <span>Nosso plano.</span>
          </h1>
          <p>
            Musculação, funcional, consultoria e acompanhamento personalizado.
          </p>
        </div>
      </section>

      <section className="authSide">
        <InstallCard />

        <section className="authCard">
          <div className="tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Entrar
            </button>

            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Criar conta
            </button>

            {setupAvailable && (
              <button
                type="button"
                className={mode === 'setup' ? 'active' : ''}
                onClick={() => setMode('setup')}
              >
                Configurar ADM
              </button>
            )}
          </div>

          <form onSubmit={submit}>
            {mode !== 'login' && (
              <label>
                Nome completo
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
            )}

            {mode === 'register' && (
              <>
                <label>
                  CPF
                  <input
                    required
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  />
                </label>

                <label>
                  Telefone
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </>
            )}

            <label>
              E-mail
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            {mode === 'setup' && (
              <label>
                SETUP_TOKEN
                <input
                  type="password"
                  required
                  value={form.setupToken}
                  onChange={(e) =>
                    setForm({ ...form, setupToken: e.target.value })
                  }
                />
              </label>
            )}

            {error && (
              <div
                className={
                  error.startsWith('Administrador criado') ? 'notice' : 'error'
                }
              >
                {error}
              </div>
            )}

            <button className="primary">
              {mode === 'login'
                ? 'Acessar minha conta'
                : mode === 'setup'
                  ? 'Criar administrador'
                  : 'Continuar para os planos'}
            </button>
            {mode === 'login' && <button type="button" className="linkButton" onClick={()=>setForgot(!forgot)}>Esqueci a senha</button>}
          </form>
          {forgot && <form className="resetBox" onSubmit={async e=>{e.preventDefault(); if(reset.password!==reset.confirm){setError('As senhas não conferem.');return;} try{await api.resetPassword({email:reset.email,cpf5:reset.cpf5,password:reset.password}); setError('Senha alterada com sucesso. Entre com a nova senha.'); setForgot(false);}catch(err:any){setError(err.message)}}}>
            <h3>Recuperar senha</h3><label>E-mail<input type="email" required value={reset.email} onChange={e=>setReset({...reset,email:e.target.value})}/></label><label>5 primeiros números do CPF<input required maxLength={5} value={reset.cpf5} onChange={e=>setReset({...reset,cpf5:e.target.value.replace(/\D/g,'')})}/></label><label>Nova senha<input type="password" minLength={8} required value={reset.password} onChange={e=>setReset({...reset,password:e.target.value})}/></label><label>Confirmar nova senha<input type="password" minLength={8} required value={reset.confirm} onChange={e=>setReset({...reset,confirm:e.target.value})}/></label><button className="primary">Alterar senha</button>
          </form>}

          <small>
            O mesmo login identifica automaticamente administrador e aluno.
          </small>
        </section>
      </section>
    </main>
  );
}

function Shell({
  user,
  onLogout,
  refresh,
}: {
  user: User;
  onLogout: () => void;
  refresh: () => void;
}) {
  const locked =
    user.role === 'student' && user.subscriptionStatus !== 'ACTIVE';

  const [page, setPage] = useState(user.role === 'admin' ? 'admin' : 'home');

  const adminNav: Array<[string, string]> = [
    ['admin', 'Painel'],
    ['exercises', 'Exercícios'],
    ['tips', 'Dicas'],
    ['diets', 'Dietas'],
    ['students', 'Alunos'],
    ['assignments', 'Treinos personalizados'],
    ['consultations', 'Consultorias'],
  ];

  const studentNav: Array<[string, string]> = [
    ['home', 'Início'],
    ['workouts', locked ? '🔒 Treinos' : 'Treinos'],
    ['personalized', locked ? '🔒 Personalizado' : 'Treino personalizado'],
    ['profile', 'Meu perfil'],
    ['mytips', locked ? '🔒 Dicas' : 'Dicas'],
    ['chat', 'Consultoria'],
    ['plans', 'Planos'],
  ];

  const nav = user.role === 'admin' ? adminNav : studentNav;
  const restrictedPages = ['workouts', 'personalized', 'mytips'];

  let content: React.ReactNode;

  if (user.role === 'admin') {
    content = <Admin page={page} />;
  } else if (page === 'plans') {
    content = <Plans refresh={refresh} />;
  } else if (locked && restrictedPages.includes(page)) {
    content = (
      <LockedFeature page={page} onPlans={() => setPage('plans')} />
    );
  } else if (locked && page === 'home') {
    content = (
      <StudentLockedHome
        name={user.name}
        onPlans={() => setPage('plans')}
      />
    );
  } else {
    content = <Student page={page} user={user} refresh={refresh} />;
  }

  return (
    <div className="app">
      <aside>
        <img src="/afit-logo.jpg" className="sideLogo" alt="AFIT" />

        <nav>
          {nav.map(([p, t]) => (
            <button
              key={p}
              className={page === p ? 'active' : ''}
              onClick={() => {
                setPage(p);
                document.body.classList.remove('navopen');
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        <button className="ghost" onClick={onLogout}>
          Sair
        </button>
      </aside>

      <header>
        <div>
          <b>Olá, {user.name.split(' ')[0]}!</b>

          <small>
            {user.role === 'admin'
              ? 'Área administrativa'
              : user.subscriptionStatus === 'ACTIVE'
                ? 'Plano ativo'
                : 'Aguardando pagamento'}
          </small>
        </div>

        <button
          className="menu"
          onClick={() => document.body.classList.toggle('navopen')}
        >
          ☰
        </button>
      </header>

      <main className="content">
        <InstallCard />
        {content}
      </main>

      <nav className="mobileNav">
        {nav.slice(0, 5).map(([p, t]) => (
          <button
            key={p}
            className={page === p ? 'active' : ''}
            onClick={() => setPage(p)}
          >
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}

function StudentLockedHome({
  name,
  onPlans,
}: {
  name: string;
  onPlans: () => void;
}) {
  return (
    <section>
      <Title
        h={`Olá, ${name.split(' ')[0]}!`}
        s="Sua conta AFIT foi criada com sucesso."
      />

      <div className="lockedWelcome">
        <div className="lockIcon">🔐</div>

        <h2>Falta pouco para começar</h2>

        <p>
          Escolha um plano para liberar os recursos disponíveis nesta versão
          de testes do AFIT.
        </p>

        <div className="unlockGrid">
          <div>
            🏋️
            <b>Treinos</b>
          </div>

          <div>
            💡
            <b>Dicas</b>
          </div>

          <div>
            💬
            <b>Consultoria avulsa</b>
          </div>
        </div>

        <button className="primary" onClick={onPlans}>
          Escolher meu plano
        </button>
      </div>
    </section>
  );
}

function LockedFeature({
  page,
  onPlans,
}: {
  page: string;
  onPlans: () => void;
}) {
  const names: Record<string, string> = {
    workouts: 'Treinos personalizados',
    mydiet: 'Dieta personalizada',
    mytips: 'Dicas exclusivas',
    chat: 'Consultoria online',
  };

  const descriptions: Record<string, string> = {
    workouts:
      'Seus exercícios, séries, repetições e vídeos explicativos serão liberados após a ativação do plano.',
    mytips:
      'As dicas exclusivas do personal estarão disponíveis após a ativação do plano.',
    chat:
      'O canal de consultoria com o personal será liberado após a confirmação do pagamento.',
  };

  return (
    <section className="lockedPage">
      <div className="lockedBox">
        <div className="lockIcon">🔒</div>

        <h1>{names[page] || 'Conteúdo exclusivo'}</h1>

        <p>
          {descriptions[page] ||
            'Este recurso estará disponível após a ativação do plano.'}
        </p>

        <div className="lockedInfo">
          <b>Aguardando ativação do plano</b>

          <p>
            Assim que o Asaas confirmar o pagamento, o AFIT libera
            automaticamente esta área.
          </p>
        </div>

        <button className="primary" onClick={onPlans}>
          Ver planos e pagamento
        </button>
      </div>
    </section>
  );
}

function Plans({ refresh }: { refresh: () => void }) {
  const [plans, setPlans] = useState<any[]>(plansFallback);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api.plans().then((x) => setPlans(x.plans)).catch(() => {});
  }, []);

  const choosePlan = async (plan: any) => {
    try {
      setBusyId(Number(plan.id));
      setMsg('');

      const r = await api.checkout(Number(plan.id));

      if (r.trial) {
        setMsg(
          'Plano Teste ativado com sucesso. Você tem acesso gratuito por 20 dias.',
        );
        await Promise.resolve(refresh());
        return;
      }

      if (!r.invoiceUrl) {
        throw new Error('O Asaas não retornou o link de pagamento.');
      }

      window.open(r.invoiceUrl, '_blank');
      setMsg(
        'Fatura criada. Após o pagamento, volte aqui e clique em verificar pagamento.',
      );
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const check = async () => {
    try {
      const r = await api.paymentStatus();
      setMsg(
        r.status === 'ACTIVE'
          ? 'Seu acesso está ativo.'
          : 'Pagamento ainda não foi confirmado.',
      );

      if (r.status === 'ACTIVE') refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <section>
      <Title
        h="Escolha seu plano"
        s="Use o Plano Teste por 20 dias sem cobrança ou escolha um plano pago."
      />

      <div className="plans">
        {plans.map((p) => {
          const isTrial =
            Number(p.price) === 0 ||
            String(p.name).trim().toLowerCase() === 'plano teste';

          return (
            <article
              className={`plan ${isTrial ? 'trialPlan' : ''}`}
              key={p.id}
            >
              {isTrial && <span className="trialBadge">TESTE GRÁTIS</span>}

              <span>{p.name}</span>

              <h2>
                {isTrial
                  ? 'GRÁTIS'
                  : `R$ ${Number(p.price).toFixed(2).replace('.', ',')}`}
              </h2>

              <small>/{p.period}</small>
              <p>{p.description}</p>

              <ul>
                <li>Treinos de musculação e funcional</li>
                <li>Vídeos explicativos dos exercícios</li>
                <li>Dicas AFIT</li>
                <li>Consultoria online disponível como serviço avulso</li>
                {isTrial && <li>Acesso completo por 20 dias</li>}
              </ul>

              <button
                className="primary"
                disabled={busyId === Number(p.id)}
                onClick={() => choosePlan(p)}
              >
                {busyId === Number(p.id)
                  ? 'Processando...'
                  : isTrial
                    ? 'Testar grátis por 20 dias'
                    : 'Assinar plano'}
              </button>
            </article>
          );
        })}
      </div>

      {msg && (
        <div className="notice">
          {msg}
          <button onClick={check}>Verificar acesso</button>
        </div>
      )}
    </section>
  );
}
function Student({ page, user, refresh }: { page: string; user: User; refresh:()=>void }) {
  const [data, setData] = useState<any>({
    exercises: [],
    tips: [],
    diet: [], assignments: [], completions: [],
  });

  useEffect(() => {
    api
      .content()
      .then(setData)
      .catch(() => {});
  }, []);

  if (page === 'home') {
    return (
      <>
        <Title h="Seu progresso" s="Foco + disciplina = resultado" />

        <div className="statgrid">
          <Card n="52%" t="Meta concluída" />
          <Card n={data.exercises.length} t="Exercícios disponíveis" />
          <Card n={data.tips.length} t="Dicas novas" />
        </div>

        <ExerciseLibrary items={data.exercises} />
      </>
    );
  }

  if (page === 'personalized') {
    const today = new Date().getDay();
    const names=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const todayItems=(data.assignments||[]).filter((x:any)=>Number(x.weekday)===today);
    return <><Title h={`Treino de hoje · ${names[today]}`} s="Treino semanal definido pelo seu personal" />{todayItems.length ? <ExerciseLibrary items={todayItems} personalized /> : <div className="empty">Nenhum treino foi atribuído para hoje.</div>}</>;
  }
  if (page === 'profile') {
    return <><Title h="Meu perfil" s="Personalize sua conta AFIT"/><div className="profileCard">{user.profileImageUrl ? <img className="profilePhoto" src={user.profileImageUrl}/> : <div className="profilePlaceholder">{user.name.charAt(0)}</div>}<div><h2>{user.name}</h2><p>{user.email}</p><label className="uploadPhoto">Alterar foto<input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0]; if(f){await api.profilePhoto(f); refresh();}}}/></label></div></div></>;
  }

  if (page === 'workouts') {
    return (
      <>
        <Title
          h="Treinos personalizados"
          s="Clique no exercício para assistir à explicação"
        />
        <ExerciseLibrary items={data.exercises} />
      </>
    );
  }

  if (page === 'mydiet') {
    return (
      <>
        <Title
          h="Minha dieta"
          s="Plano alimentar cadastrado para seu objetivo"
        />

        <div className="stack">
          {data.diet.map((x: any) => (
            <Card
              key={x.id}
              n={x.time}
              t={x.title}
              text={x.description}
            />
          ))}
        </div>
      </>
    );
  }

  if (page === 'mytips') {
    return (
      <>
        <Title h="Dicas AFIT" s="Conteúdo para acelerar seus resultados" />

        <div className="cards">
          {data.tips.map((x: any) => (
            <Card
              key={x.id}
              n={x.category || 'Dica'}
              t={x.title}
              text={x.description}
            />
          ))}
        </div>
      </>
    );
  }

  if (page === 'chat') return <StudentConsultation user={user} />;

  return null;
}

function consultationStatus(status?:string){
  return ({REQUESTED:'Solicitação enviada',AVAILABILITY_SENT:'Horários disponíveis',AWAITING_PAYMENT:'Aguardando pagamento',CONFIRMED:'Confirmada',COMPLETED:'Concluída',CANCELLED:'Cancelada'} as any)[status||'']||status||'';
}
function dateTimeBR(value?:string){ if(!value)return '-'; const d=new Date(value); return Number.isNaN(d.getTime())?value:d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}); }

function StudentConsultation({user}:{user:User}){
  const [data,setData]=useState<any>({request:null,slots:[]}); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false); const [selected,setSelected]=useState<any>(null);
  const load=()=>api.consultation().then(setData).catch((e:any)=>setMsg(e.message));
  useEffect(()=>{void load(); const t=setInterval(()=>void load(),15000); return()=>clearInterval(t);},[]);
  const requestOne=async()=>{try{setBusy(true);setMsg('');await api.requestConsultation();setMsg('Solicitação enviada ao personal.');await load();}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
  const pay=async()=>{if(!selected)return; try{setBusy(true);const r=await api.selectConsultationSlot(Number(selected.id));await load();if(r.invoiceUrl)window.open(r.invoiceUrl,'_blank');setSelected(null);}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
  const r=data.request;
  return <section><Title h="Consultoria Online" s="Atendimento individual com seu personal, com agendamento e pagamento pela plataforma"/>
    {!r ? <div className="consultHero"><div className="consultIcon">💻</div><div><span className="miniTag">SERVIÇO AVULSO</span><h2>Consultoria individual</h2><p>Converse com seu personal para avaliação, orientação e acompanhamento personalizado.</p><div className="consultMeta"><span>⏱ Aproximadamente 60 min</span><span>💰 <b>R$ 300,00</b></span></div></div><button className="primary" disabled={busy} onClick={requestOne}>{busy?'Enviando...':'Solicitar consultoria'}</button></div>:
    <div className="consultStack"><div className={`consultStatus status-${String(r.status).toLowerCase()}`}><small>Status da consultoria</small><b>{consultationStatus(r.status)}</b><span>Solicitada em {dateTimeBR(r.requestedAt)}</span></div>
      {r.status==='REQUESTED'&&<div className="consultPanel"><h3>Solicitação recebida ✅</h3><p>Seu personal recebeu o pedido. Assim que os horários forem informados, eles aparecerão aqui.</p></div>}
      {r.status==='AVAILABILITY_SENT'&&<div className="consultPanel"><h3>Escolha um horário</h3><p>Selecione uma das opções disponibilizadas pelo personal.</p><div className="slotGrid">{data.slots.filter((x:any)=>x.status==='AVAILABLE').map((x:any)=><button key={x.id} className="slotButton" onClick={()=>setSelected(x)}><b>{new Date(x.startsAt).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</b><span>{new Date(x.startsAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><em>Agendar</em></button>)}</div></div>}
      {r.status==='AWAITING_PAYMENT'&&<div className="consultPanel"><h3>Horário reservado</h3><div className="bookingSummary"><span>👤 {user.name}</span><span>📅 {dateTimeBR(r.selectedStartsAt)}</span><span>💻 Consultoria Online</span><strong>R$ 300,00</strong></div><div className="paymentPending">🟠 Aguardando confirmação do pagamento pelo Asaas.</div>{r.invoiceUrl&&<button className="primary" onClick={()=>window.open(r.invoiceUrl,'_blank')}>Pagar consultoria</button>}<button className="ghostCheck" onClick={load}>Verificar pagamento</button></div>}
      {r.status==='CONFIRMED'&&<div className="consultPanel successPanel"><div className="successMark">✓</div><h2>Consultoria agendada com sucesso!</h2><p>Seu pagamento foi confirmado e o horário está reservado.</p><div className="bookingSummary"><span>👤 {user.name}</span><span>📅 {dateTimeBR(r.selectedStartsAt)}</span><span>💳 Pagamento confirmado · R$ 300,00</span></div>{r.meetingUrl?<button className="primary" onClick={()=>window.open(r.meetingUrl,'_blank')}>Entrar na consultoria</button>:<small>O link da reunião será disponibilizado pelo personal nesta página.</small>}</div>}
      {r.status==='COMPLETED'&&<div className="consultPanel successPanel"><h3>Consultoria concluída</h3><p>Este atendimento foi marcado como realizado pelo seu personal.</p></div>}
    </div>}
    {msg&&<div className="notice">{msg}</div>}
    {selected&&<div className="consultModal" onClick={()=>setSelected(null)}><article onClick={e=>e.stopPropagation()}><button className="modalClose" onClick={()=>setSelected(null)}>×</button><span className="miniTag">CONFIRMAR AGENDAMENTO</span><h2>Consultoria Online</h2><div className="bookingSummary"><span>👤 <b>{user.name}</b></span><span>📅 <b>{dateTimeBR(selected.startsAt)}</b></span><span>💻 Atendimento online</span></div><div className="consultPrice"><small>Valor da consultoria</small><strong>R$ 300,00</strong></div><p className="muted">O horário será confirmado automaticamente após a identificação do pagamento.</p><button className="primary" disabled={busy} onClick={pay}>{busy?'Gerando cobrança...':'Confirmar e pagar'}</button></article></div>}
  </section>;
}

function ConsultationsAdmin(){
 const [items,setItems]=useState<any[]>([]); const [msg,setMsg]=useState(''); const [editing,setEditing]=useState<any>(null); const [slots,setSlots]=useState<string[]>(['']); const [meeting,setMeeting]=useState('');
 const load=()=>api.consultationAdminList().then(r=>setItems(r.items||[])).catch((e:any)=>setMsg(e.message)); useEffect(()=>{void load();},[]);
 const send=async()=>{try{const clean=slots.filter(Boolean);await api.consultationAdminSlots(editing.id,clean);setMsg('Horários enviados ao aluno.');setEditing(null);setSlots(['']);await load();}catch(e:any){setMsg(e.message)}};
 const update=async(id:number,action:string,extra:any={})=>{try{await api.consultationAdminUpdate({id,action,...extra});setMsg('Consultoria atualizada.');await load();}catch(e:any){setMsg(e.message)}};
 return <section><Title h="Consultorias" s="Gerencie solicitações, horários, pagamentos e links das reuniões"/>{msg&&<div className="notice">{msg}</div>}<div className="consultAdminList">{items.length===0&&<div className="empty">Nenhuma solicitação de consultoria.</div>}{items.map(x=><article className="consultAdminCard" key={x.id}><div className="consultAdminHead"><div><span className="miniTag">#{x.id} · {consultationStatus(x.status)}</span><h3>{x.name}</h3><small>{x.email}{x.phone?` · ${x.phone}`:''}</small></div><strong>R$ {Number(x.price||300).toFixed(2).replace('.',',')}</strong></div><div className="consultAdminInfo"><span>Solicitada: {dateTimeBR(x.requestedAt)}</span>{x.selectedStartsAt&&<span>Agendada: <b>{dateTimeBR(x.selectedStartsAt)}</b></span>}<span>Pagamento: <b>{x.paymentStatus||'não gerado'}</b></span></div>{x.slots?.length>0&&<div className="adminSlots">{x.slots.filter((s:any)=>s.status!=='CANCELLED').map((s:any)=><span key={s.id}>{dateTimeBR(s.startsAt)} · {s.status}</span>)}</div>}<div className="consultActions">{['REQUESTED','AVAILABILITY_SENT'].includes(x.status)&&<button onClick={()=>{setEditing(x);setSlots(x.slots?.filter((s:any)=>s.status==='AVAILABLE').map((s:any)=>String(s.startsAt).slice(0,16))||[''])}}>Informar horários</button>}{x.status==='CONFIRMED'&&<><input placeholder="Link Google Meet / Zoom" defaultValue={x.meetingUrl||''} onChange={e=>setMeeting(e.target.value)}/><button onClick={()=>update(x.id,'meeting',{meetingUrl:meeting||x.meetingUrl||''})}>Salvar link</button><button className="okAction" onClick={()=>update(x.id,'complete')}>Concluir</button></>} {!['COMPLETED','CANCELLED'].includes(x.status)&&<button className="danger" onClick={()=>confirm('Cancelar esta consultoria?')&&update(x.id,'cancel')}>Cancelar</button>}</div></article>)}</div>
 {editing&&<div className="consultModal" onClick={()=>setEditing(null)}><article onClick={e=>e.stopPropagation()}><button className="modalClose" onClick={()=>setEditing(null)}>×</button><span className="miniTag">DISPONIBILIDADE</span><h2>{editing.name}</h2><p>Informe uma ou mais datas e horários para o aluno escolher.</p><div className="slotEditor">{slots.map((v,i)=><div key={i}><input type="datetime-local" value={v} onChange={e=>setSlots(a=>a.map((x,j)=>j===i?e.target.value:x))}/>{slots.length>1&&<button onClick={()=>setSlots(a=>a.filter((_,j)=>j!==i))}>×</button>}</div>)}</div><button className="ghostCheck" onClick={()=>setSlots(a=>[...a,''])}>+ Adicionar horário</button><button className="primary" onClick={send}>Enviar horários ao aluno</button></article></div>}
 </section>;
}

function ExerciseLibrary({ items, personalized=false }: { items: any[]; personalized?: boolean }) {
  const [selected, setSelected] = useState<any>(null);
  const [category, setCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [series, setSeries] = useState(0); const [restLeft,setRestLeft]=useState(0); const [running,setRunning]=useState(false); const [resting,setResting]=useState(false); const [done,setDone]=useState<Set<number>>(new Set());

  const categories = [
    'Todos',
    ...Array.from(
      new Set(items.map((x) => x.trainingCategory || 'Musculação')),
    ),
  ];

  const filtered = items.filter(
    (x) =>
      (category === 'Todos' ||
        (x.trainingCategory || 'Musculação') === category) &&
      String(x.name).toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(()=>{ if(restLeft<=0)return; const t=setInterval(()=>setRestLeft(v=>Math.max(0,v-1)),1000); return()=>clearInterval(t);},[restLeft]);
  const restSeconds=(v:any)=>{const m=String(v||'60').match(/(\d+)/); return m?Number(m[1]):60};
  const start=(x:any)=>{setSelected(x);setSeries(1);setRestLeft(0);setResting(false);setRunning(true)};
  const finishSeries=()=>{if(!selected)return; setResting(true); setRestLeft(restSeconds(selected.rest));};
  const nextSeries=()=>{if(restLeft>0)return; const total=Number(selected?.sets||1); setResting(false); setRestLeft(0); if(series<total)setSeries(v=>v+1);};
  const complete=async()=>{if(!selected||restLeft>0)return; await api.completeWorkout(Number(selected.exerciseId||selected.id)); setDone(new Set([...done,Number(selected.exerciseId||selected.id)])); setResting(false); setRestLeft(0); setRunning(false)};

  return (
    <>
      <div className="exerciseToolbar">
        <input
          placeholder="Buscar exercício..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="chips">
          {categories.map((c) => (
            <button
              key={String(c)}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(String(c))}
            >
              {String(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="exerciseList">
        {filtered.map((x) => (
          <button key={x.id} onClick={() => setSelected(x)}>
            <div className="thumb">
              {x.imageUrl ? (
                <img src={x.imageUrl} alt={x.name} />
              ) : (
                <span>▶</span>
              )}
            </div>

            <div>
              <span className="categoryTag">
                {x.trainingCategory || 'Musculação'}
              </span>

              <b>{x.name}</b>

              <small>
                {x.sets} séries ·{' '}
                {x.executionMode === 'Tempo'
                  ? x.duration || 'tempo definido'
                  : `${x.reps || '-'} repetições`}
              </small>
            </div>

            <span>›</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <article onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>

            {selected.videoUrl ? (
              <video
                controls
                poster={selected.imageUrl || ''}
                src={selected.videoUrl}
              />
            ) : (
              <div className="videoPlaceholder">
                Vídeo do personal será exibido aqui
              </div>
            )}

            <div className="metrics">
              <b>
                {selected.sets || '-'}
                <small>séries</small>
              </b>

              <b>
                {selected.executionMode === 'Tempo'
                  ? selected.duration || '-'
                  : selected.reps || '-'}
                <small>
                  {selected.executionMode === 'Tempo'
                    ? 'duração'
                    : 'repetições'}
                </small>
              </b>

              <b>
                {selected.rest || '-'}
                <small>descanso</small>
              </b>
            </div>

            <div className="detailHead">
              <span className="categoryTag">
                {selected.trainingCategory}
              </span>

              <span className="levelTag">{selected.level}</span>
            </div>

            <h2>{selected.name}</h2>
            <Detail title="Descrição" text={selected.description} />
            <Detail title="Objetivo" text={selected.objective} />
            <Detail title="Como executar" text={selected.instructions} />
            <Detail title="Benefícios" text={selected.benefits} />
            <Detail title="Erros comuns" text={selected.commonErrors} />
            <Detail
              title="Equipamentos"
              text={selected.equipment || 'Peso corporal'}
            />

            {selected.tags && <Detail title="Tags" text={selected.tags} />}
            <div className="workoutRunner">
              {done.has(Number(selected.exerciseId||selected.id)) ? <button className="completedButton">✓ Treino concluído</button> : !running ? <button className="primary" onClick={()=>start(selected)}>Iniciar treino</button> : <><b>Série {series} de {selected.sets||1}</b>{resting ? <><div className="restTimer">Descanso <strong>{restLeft}s</strong></div>{series < Number(selected.sets||1) ? <button className={`primary ${restLeft===0?'readyPulse':''}`} disabled={restLeft>0} onClick={nextSeries}>{restLeft>0?'Aguarde o descanso':`Começar série ${series+1}`}</button> : <button className={`primary ${restLeft===0?'readyPulse':''}`} disabled={restLeft>0} onClick={complete}>{restLeft>0?'Aguarde o descanso':'Concluir treino'}</button>}</> : <button className="primary" onClick={finishSeries}>Finalizar série {series}</button>}</>}
            </div>
          </article>
        </div>
      )}
    </>
  );
}

function Detail({title,text}:{title:string;text?:string}) { const [open,setOpen]=useState(false); if(!text)return null; return <div className="detailAccordion"><button onClick={()=>setOpen(!open)}><span>{title}</span><span>{open?'−':'+'}</span></button>{open&&<p className="preserve">{text}</p>}</div>; }

function Admin({ page }: { page: string }) {
  if (page === 'admin') {
    return (
      <>
        <Title
          h="Painel administrativo"
          s="Gerencie todo o conteúdo da plataforma"
        />

        <div className="statgrid">
          <Card n="D1" t="Banco de dados" />
          <Card n="R2" t="Vídeos e imagens" />
          <Card n="Asaas" t="Pagamentos e webhooks" />
        </div>
      </>
    );
  }

  if (page === 'assignments') return <AssignmentAdmin />;
  if (page === 'consultations') return <ConsultationsAdmin />;

  const map: any = {
    exercises: {
      title: 'Exercícios',
      fields: [
        'trainingCategory',
        'name',
        'muscleGroup',
        'level',
        'executionMode',
        'description',
        'objective',
        'instructions',
        'benefits',
        'commonErrors',
        'equipment',
        'sets',
        'reps',
        'duration',
        'rest',
        'tags',
        'videoUrl',
        'imageUrl',
      ],
    },
    tips: {
      title: 'Dicas',
      fields: ['title', 'description', 'category', 'videoUrl', 'imageUrl'],
    },
    diets: {
      title: 'Dietas',
      fields: ['studentEmail', 'time', 'title', 'description'],
    },
    students: {
      title: 'Alunos',
      fields: [],
    },
  };

  return <AdminCrud kind={page} config={map[page] || map.exercises} />;
}

function AdminCrud({ kind, config }: { kind: string; config: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    trainingCategory: 'Musculação',
    level: 'Iniciante',
    executionMode: 'Repetições',
  });
  const [msg, setMsg] = useState('');
  const [editing,setEditing]=useState<number|null>(null);

  const load = () =>
    api
      .adminList(kind)
      .then((r) => setItems(r.items || []))
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    void load();
  }, [kind]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if(editing && kind==='exercises') await api.adminUpdate(kind,{...form,id:editing}); else await api.adminSave(kind, form);

      setForm({
        trainingCategory: 'Musculação',
        level: 'Iniciante',
        executionMode: 'Repetições',
      });

      setEditing(null); setMsg('Salvo com sucesso.');
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const upload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      setMsg('Enviando arquivo...');
      const r = await api.upload(f);
      setForm({ ...form, [field]: r.url });
      setMsg('Upload concluído.');
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <Title h={config.title} s="Cadastre e publique sem editar código" />

      {config.fields.length > 0 && (
        <form className="adminForm" onSubmit={save}>
          {config.fields.map((f: string) => {
            const v = form[f] || '';

            if (f === 'trainingCategory') {
              return (
                <label key={f}>
                  {label(f)}
                  <select
                    value={v}
                    onChange={(e) =>
                      setForm({ ...form, [f]: e.target.value })
                    }
                  >
                    <option>Musculação</option>
                    <option>Funcional</option>
                    <option>Cardio</option>
                    <option>Mobilidade</option>
                    <option>Alongamento</option>
                    <option>Treino em Casa</option>
                    <option>Corrida</option>
                    <option>Preparação Física</option>
                    <option>Outro</option>
                  </select>
                </label>
              );
            }

            if (f === 'level') {
              return (
                <label key={f}>
                  {label(f)}
                  <select
                    value={v}
                    onChange={(e) =>
                      setForm({ ...form, [f]: e.target.value })
                    }
                  >
                    <option>Iniciante</option>
                    <option>Intermediário</option>
                    <option>Avançado</option>
                  </select>
                </label>
              );
            }

            if (f === 'executionMode') {
              return (
                <label key={f}>
                  {label(f)}
                  <select
                    value={v}
                    onChange={(e) =>
                      setForm({ ...form, [f]: e.target.value })
                    }
                  >
                    <option>Repetições</option>
                    <option>Tempo</option>
                    <option>Distância</option>
                  </select>
                </label>
              );
            }

            if (
              [
                'description',
                'objective',
                'instructions',
                'benefits',
                'commonErrors',
              ].includes(f)
            ) {
              return (
                <label className="wide" key={f}>
                  {label(f)}
                  <textarea
                    rows={4}
                    value={v}
                    onChange={(e) =>
                      setForm({ ...form, [f]: e.target.value })
                    }
                  />
                </label>
              );
            }

            return (
              <label key={f}>
                {label(f)}

                {f === 'videoUrl' || f === 'imageUrl' ? (
                  <>
                    <input
                      value={v}
                      onChange={(e) =>
                        setForm({ ...form, [f]: e.target.value })
                      }
                    />

                    <input
                      type="file"
                      accept={f === 'videoUrl' ? 'video/*' : 'image/*'}
                      onChange={(e) => upload(e, f)}
                    />
                  </>
                ) : (
                  <input
                    required={f === 'name'}
                    value={v}
                    onChange={(e) =>
                      setForm({ ...form, [f]: e.target.value })
                    }
                  />
                )}
              </label>
            );
          })}

          <button className="primary">Salvar</button>
        </form>
      )}

      {msg && <div className="notice">{msg}</div>}

      <div className="table">
        {items.map((x: any) => (
          <div key={x.id} className="adminRow">
            <div><b>{x.name || x.title || x.email}</b><small>{kind==='students' ? `${x.subscription_status||''} · Plano pago: ${x.paid_plan||'nenhum'} · ${x.phone||''}` : (x.description || x.subscription_status || x.category)}</small>{kind==='students'&&<small>CPF: {x.cpf ? `***.***.${String(x.cpf).replace(/\D/g,'').slice(-5)}` : 'não informado'} · Acesso até: {x.subscription_until ? new Date(x.subscription_until).toLocaleDateString('pt-BR'):'-'}</small>}</div>
            <div className="rowActions">{kind==='exercises'&&<button onClick={()=>{setForm({...x});setEditing(x.id);window.scrollTo({top:0,behavior:'smooth'})}}>Editar</button>}{['exercises','students'].includes(kind)&&<button className="danger" onClick={async()=>{if(confirm(`Deseja realmente remover ${x.name||x.email}?`)){await api.adminDelete(kind,x.id);load();}}}>Remover</button>}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function AssignmentAdmin(){
 const [students,setStudents]=useState<any[]>([]),[exercises,setExercises]=useState<any[]>([]); const [studentId,setStudentId]=useState(0); const [weekday,setWeekday]=useState(new Date().getDay()); const [selected,setSelected]=useState<number[]>([]); const [msg,setMsg]=useState('');
 useEffect(()=>{api.adminList('students').then(r=>setStudents(r.items));api.adminList('exercises').then(r=>setExercises(r.items));},[]);
 useEffect(()=>{if(!studentId)return; api.assignments(studentId).then(r=>setSelected(r.items.filter((x:any)=>Number(x.weekday)===weekday).map((x:any)=>Number(x.exerciseId))))},[studentId,weekday]);
 const days=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
 return <><Title h="Treinos personalizados" s="Monte a rotina semanal de cada aluno"/><div className="assignmentControls"><label>Aluno<select value={studentId} onChange={e=>setStudentId(Number(e.target.value))}><option value={0}>Selecione...</option>{students.map(x=><option value={x.id} key={x.id}>{x.name} · {x.email}</option>)}</select></label><label>Dia da semana<select value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label></div><div className="assignmentList">{exercises.map(x=><label key={x.id}><input type="checkbox" checked={selected.includes(Number(x.id))} onChange={()=>setSelected(v=>v.includes(Number(x.id))?v.filter(i=>i!==Number(x.id)):[...v,Number(x.id)])}/><span><b>{x.name}</b><small>{x.muscleGroup||x.trainingCategory}</small></span></label>)}</div><button className="primary" disabled={!studentId} onClick={async()=>{await api.saveAssignments({studentId,weekday,exerciseIds:selected});setMsg('Treino do dia salvo com sucesso.')}}>Salvar treino de {days[weekday]}</button>{msg&&<div className="notice">{msg}</div>}</>;
}

const label = (s: string) =>
  (
    {
      trainingCategory: 'Modalidade',
      name: 'Nome do exercício',
      muscleGroup: 'Grupo muscular',
      level: 'Nível',
      executionMode: 'Forma de execução',
      description: 'Descrição',
      objective: 'Objetivo',
      instructions: 'Como executar',
      benefits: 'Benefícios',
      commonErrors: 'Erros comuns',
      equipment: 'Equipamentos',
      sets: 'Séries',
      reps: 'Repetições ou distância',
      duration: 'Duração',
      rest: 'Descanso',
      tags: 'Tags',
      videoUrl: 'Vídeo do personal',
      imageUrl: 'Imagem de capa',
      title: 'Título',
      category: 'Categoria',
      studentEmail: 'E-mail do aluno',
      time: 'Horário',
    } as any
  )[s] || s;

const Title = ({ h, s }: { h: string; s: string }) => (
  <div className="title">
    <h1>{h}</h1>
    <p>{s}</p>
  </div>
);

function Card({
  n,
  t,
  text,
}: {
  n: any;
  t: string;
  text?: string;
}) {
  return (
    <article className="card">
      <strong>{n}</strong>
      <h3>{t}</h3>
      {text && <p>{text}</p>}
    </article>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
