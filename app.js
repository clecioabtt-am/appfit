const exercises = [
  { id: 'agachamento', name: 'Agachamento Livre', sets: 4, reps: '12', rest: '60–90 seg', group: 'Membros inferiores' },
  { id: 'supino', name: 'Supino Reto', sets: 4, reps: '10', rest: '60 seg', group: 'Peitoral' },
  { id: 'remada', name: 'Remada Curvada', sets: 4, reps: '12', rest: '60 seg', group: 'Costas' },
  { id: 'prancha', name: 'Prancha Abdominal', sets: 3, reps: '45 segundos', rest: '45 seg', group: 'Abdômen' },
  { id: 'legpress', name: 'Leg Press', sets: 4, reps: '12', rest: '75 seg', group: 'Membros inferiores' },
  { id: 'avanco', name: 'Avanço', sets: 3, reps: '12 cada perna', rest: '60 seg', group: 'Membros inferiores' }
];

const routeMeta = {
  home: ['PAINEL DO ALUNO', 'Olá, Mariana! 👋'],
  workouts: ['SEU PROGRAMA', 'Treinos personalizados'],
  exercise: ['DETALHES DO EXERCÍCIO', 'Execução orientada'],
  diet: ['PLANO ALIMENTAR', 'Sua dieta personalizada'],
  tips: ['CONTEÚDO AFIT', 'Dicas para evoluir'],
  consulting: ['ATENDIMENTO ONLINE', 'Consultoria com seu personal'],
  profile: ['MINHA CONTA', 'Perfil e assinatura'],
  plans: ['ASSINATURA AFIT', 'Escolha seu plano']
};

const view = document.querySelector('#view');
let currentRoute = 'home';
let selectedExercise = exercises[0];
let deferredPrompt = null;

function exerciseRows(items = exercises) {
  return items.map((e, i) => `
    <article class="exercise-row" data-exercise="${e.id}">
      <div class="exercise-thumb"><img src="assets/images/personal-afit.jpg" alt="${e.name}" style="object-position:${45 + (i%3)*8}% 24%"></div>
      <div><h3>${e.name}</h3><p>${e.sets} séries × ${e.reps} · ${e.group}</p></div>
      <span class="arrow">›</span>
    </article>`).join('');
}

const templates = {
  home: () => `
    <div class="grid dashboard-grid">
      <article class="card hero">
        <div class="hero-content">
          <span class="pill">● CONSULTORIA ATIVA</span>
          <h2>Seu corpo. Sua meta. <span>Nosso plano.</span></h2>
          <p>Treinos, dietas e acompanhamento profissional criados para o seu objetivo e para a sua rotina.</p>
          <button class="primary-button" data-route="workouts">Começar treino de hoje</button>
        </div>
      </article>
      <article class="card progress-card">
        <p class="card-label">PROGRESSO DO OBJETIVO</p>
        <div class="progress-ring"><strong>52%</strong></div>
        <div class="progress-meta"><span>Meta: -10 kg</span><b>-5,2 kg</b></div>
      </article>
    </div>
    <div class="section-title"><h2>Acesso rápido</h2><button data-route="plans">Ver assinatura</button></div>
    <div class="grid quick-grid">
      <article class="card quick-card" data-route="workouts"><div class="quick-icon">◫</div><h3>Treinos</h3><p>Seu programa completo</p></article>
      <article class="card quick-card" data-route="diet"><div class="quick-icon">♨</div><h3>Dietas</h3><p>Plano alimentar do dia</p></article>
      <article class="card quick-card" data-route="tips"><div class="quick-icon">✦</div><h3>Dicas</h3><p>Conteúdos do personal</p></article>
      <article class="card quick-card" data-route="consulting"><div class="quick-icon">◉</div><h3>Consultoria</h3><p>Fale com a equipe AFIT</p></article>
    </div>
    <div class="section-title"><h2>Treino de hoje</h2><button data-route="workouts">Ver treino completo</button></div>
    <div class="workout-list">${exerciseRows(exercises.slice(0,4))}</div>`,

  workouts: () => `
    <div class="grid content-grid">
      <section class="card panel">
        <div class="section-title" style="margin-top:0"><div><p class="card-label">QUARTA-FEIRA</p><h2>Membros inferiores + abdômen</h2></div><button>35–45 min</button></div>
        <div class="workout-list">${exerciseRows()}</div>
      </section>
      <aside class="grid">
        <article class="card stat-card"><small>Exercícios</small><strong>6</strong><span>programados</span></article>
        <article class="card stat-card"><small>Progresso</small><strong>2/6</strong><span>concluídos</span></article>
        <article class="card panel"><p class="card-label">ORIENTAÇÃO DO PERSONAL</p><p style="color:var(--muted);line-height:1.6;font-size:13px">Priorize a técnica. Use uma carga que permita concluir as repetições sem perder o alinhamento corporal.</p></article>
      </aside>
    </div>`,

  exercise: () => `
    <div class="grid content-grid">
      <section class="card panel">
        <div class="video-frame">
          <img src="assets/images/personal-afit.jpg" alt="Vídeo demonstrativo de ${selectedExercise.name}">
          <button class="play-button" id="playDemo" aria-label="Reproduzir vídeo">▶</button>
        </div>
        <div class="detail-block"><h3>Sobre o exercício</h3><p>O ${selectedExercise.name.toLowerCase()} trabalha grupos musculares importantes com foco em força, controle e estabilidade. O vídeo do personal será exibido aqui quando conectado ao armazenamento do Cloudflare R2.</p></div>
        <div class="detail-block"><h3>Objetivo</h3><p>Desenvolver força e resistência, melhorar o desempenho funcional e aumentar a consciência corporal durante a execução.</p></div>
        <div class="detail-block"><h3>Como executar</h3><ul><li>Prepare a postura e mantenha o abdômen ativo.</li><li>Execute o movimento de forma controlada.</li><li>Evite compensações e respeite sua amplitude.</li><li>Retorne à posição inicial mantendo a técnica.</li></ul></div>
        <button class="primary-button" style="width:100%;margin-top:12px" id="completeExercise">✓ Marcar como concluído</button>
      </section>
      <aside class="stat-grid">
        <article class="card stat-card"><small>Séries</small><strong>${selectedExercise.sets}</strong><span>séries</span></article>
        <article class="card stat-card"><small>Repetições</small><strong>${selectedExercise.reps}</strong><span>repetições</span></article>
        <article class="card stat-card"><small>Descanso</small><strong style="font-size:24px">${selectedExercise.rest}</strong><span>entre séries</span></article>
      </aside>
    </div>`,

  diet: () => `
    <div class="grid content-grid">
      <section class="card panel">
        <div class="section-title" style="margin-top:0"><div><p class="card-label">QUARTA-FEIRA</p><h2>Plano alimentar</h2></div><button>2.180 kcal</button></div>
        <div class="info-list">
          ${[['07:00','Café da manhã','Ovos mexidos, pão integral, banana e café sem açúcar.'],['10:00','Lanche da manhã','Iogurte natural com aveia e castanhas.'],['13:00','Almoço','Arroz, feijão, frango grelhado, legumes e salada.'],['16:30','Lanche da tarde','Tapioca com queijo branco e uma fruta.'],['20:00','Jantar','Peixe grelhado, batata-doce e legumes.']].map(([t,n,d])=>`<article class="card info-card"><div class="quick-icon" style="font-size:12px;font-weight:900">${t}</div><div><h3>${n}</h3><p>${d}</p></div></article>`).join('')}
        </div>
      </section>
      <aside class="grid">
        <article class="card stat-card"><small>Água</small><strong>2,4 L</strong><span>meta diária</span></article>
        <article class="card stat-card"><small>Proteína</small><strong>160 g</strong><span>meta diária</span></article>
        <article class="card panel"><p class="card-label">OBSERVAÇÃO</p><p style="color:var(--muted);line-height:1.6;font-size:13px">Este layout é demonstrativo. Dietas e orientações nutricionais devem ser cadastradas por profissional habilitado.</p></article>
      </aside>
    </div>`,

  tips: () => `<div class="info-list">
    ${[['✦','Consistência vence intensidade','Um treino bem executado de forma constante gera mais resultado do que treinos excessivos e irregulares.'],['◷','Respeite o descanso','A recuperação muscular faz parte do processo de evolução. Durma bem e respeite os intervalos.'],['◉','Registre suas cargas','Anotar a carga usada em cada exercício facilita acompanhar sua progressão.'],['♨','Organize suas refeições','Planejar com antecedência reduz decisões impulsivas e ajuda a manter o foco.']].map(([i,t,d])=>`<article class="card info-card"><div class="quick-icon">${i}</div><div><h3>${t}</h3><p>${d}</p></div></article>`).join('')}
  </div>`,

  consulting: () => `
    <section class="card chat-shell">
      <div class="chat-head"><strong>Equipe AFIT</strong><p style="margin:3px 0 0;color:var(--muted);font-size:12px">Online · resposta média em até 2 horas</p></div>
      <div class="messages" id="messages"><div class="message">Olá, Mariana! Como você se sentiu no treino de ontem?</div><div class="message mine">Foi ótimo! Consegui aumentar a carga no leg press.</div><div class="message">Excelente evolução. Mantenha a execução controlada e me avise se sentir qualquer desconforto.</div></div>
      <form class="chat-form" id="chatForm"><input id="chatInput" placeholder="Digite sua mensagem..." autocomplete="off"><button class="primary-button">Enviar</button></form>
    </section>`,

  profile: () => `
    <div class="grid profile-layout">
      <article class="card profile-hero"><div class="profile-photo">MA</div><h2 style="margin:0">Mariana Alves</h2><p style="color:var(--muted)">Plano trimestral ativo</p><button class="secondary-button" data-route="plans">Gerenciar assinatura</button></article>
      <section class="card panel"><p class="card-label">DADOS DO ALUNO</p><div class="info-list" style="margin-top:18px">
        ${[['Objetivo','Emagrecimento e condicionamento'],['Peso atual','74,8 kg'],['Meta','69,6 kg'],['Altura','1,68 m'],['Próxima avaliação','12 de agosto']].map(([a,b])=>`<article class="card info-card" style="justify-content:space-between"><strong>${a}</strong><span style="color:var(--muted);text-align:right">${b}</span></article>`).join('')}
      </div></section>
    </div>`,

  plans: () => `<div class="grid plan-grid">
    <article class="card plan-card featured"><span class="plan-tag">MAIS ESCOLHIDO</span><p class="card-label">PLANO MENSAL</p><div class="plan-price">R$ 59,90 <small>/mês</small></div><ul class="check-list"><li>Consultoria online</li><li>Treinos personalizados</li><li>Dietas personalizadas</li><li>Acompanhamento de evolução</li><li>Suporte via chat</li></ul><button class="primary-button" style="width:100%">Escolher mensal</button></article>
    <article class="card plan-card"><p class="card-label">PLANO TRIMESTRAL</p><div class="plan-price">R$ 161,70 <small>/trimestre</small></div><p style="color:var(--muted);margin-top:0;font-size:12px">Equivale a R$ 53,90 por mês</p><ul class="check-list"><li>Todos os recursos do plano mensal</li><li>10% de desconto</li><li>Prioridade na consultoria</li><li>Avaliação de progresso</li><li>Renovação simplificada</li></ul><button class="secondary-button" style="width:100%">Escolher trimestral</button></article>
  </div>`
};

function navigate(route, push = true) {
  currentRoute = templates[route] ? route : 'home';
  const [eyebrow,title] = routeMeta[currentRoute];
  document.querySelector('#pageEyebrow').textContent = eyebrow;
  document.querySelector('#pageTitle').textContent = title;
  view.innerHTML = templates[currentRoute]();
  document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === currentRoute));
  if (push) history.pushState({route: currentRoute}, '', currentRoute === 'home' ? './' : `#${currentRoute}`);
  bindDynamicEvents();
  window.scrollTo({top:0,behavior:'smooth'});
}

function bindDynamicEvents() {
  view.querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
  view.querySelectorAll('[data-exercise]').forEach(row => row.addEventListener('click', () => {
    selectedExercise = exercises.find(e => e.id === row.dataset.exercise) || exercises[0];
    navigate('exercise');
  }));
  document.querySelector('#playDemo')?.addEventListener('click', e => {
    e.currentTarget.textContent = '❚❚';
    alert('Área preparada para reproduzir o vídeo do personal. Depois, conecte aqui a URL do vídeo hospedado no Cloudflare R2.');
  });
  document.querySelector('#completeExercise')?.addEventListener('click', e => {
    e.currentTarget.textContent = '✓ Exercício concluído';
    e.currentTarget.disabled = true;
  });
  document.querySelector('#chatForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.querySelector('#chatInput');
    if (!input.value.trim()) return;
    const msg = document.createElement('div');
    msg.className = 'message mine';
    msg.textContent = input.value.trim();
    document.querySelector('#messages').append(msg);
    input.value = '';
    msg.scrollIntoView({behavior:'smooth'});
  });
}

document.querySelectorAll('.sidebar [data-route], .mobile-nav [data-route], .profile-chip').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
window.addEventListener('popstate', () => navigate(location.hash.slice(1) || 'home', false));

function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function showInstallUI() {
  if (isStandalone() || sessionStorage.getItem('afit-install-dismissed')) return;
  document.querySelector('#installBanner').classList.remove('hidden');
  document.querySelector('#installTop').classList.remove('hidden');
  document.querySelector('#installSidebar').classList.remove('hidden');
}
async function installApp() {
  if (isIos()) { document.querySelector('#iosModal').classList.remove('hidden'); return; }
  if (!deferredPrompt) { alert('No Android, abra esta página pelo Google Chrome e use “Adicionar à tela inicial” no menu do navegador.'); return; }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.querySelector('#installBanner').classList.add('hidden');
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; showInstallUI(); });
window.addEventListener('appinstalled', () => document.querySelector('#installBanner').classList.add('hidden'));
['installTop','installSidebar','installBannerButton'].forEach(id => document.querySelector(`#${id}`)?.addEventListener('click', installApp));
document.querySelector('#dismissInstall').addEventListener('click', () => { document.querySelector('#installBanner').classList.add('hidden'); sessionStorage.setItem('afit-install-dismissed','1'); });
['closeIosModal','understoodIos'].forEach(id => document.querySelector(`#${id}`).addEventListener('click', () => document.querySelector('#iosModal').classList.add('hidden')));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
setTimeout(() => { if (isIos() && !isStandalone()) showInstallUI(); }, 1600);
navigate(location.hash.slice(1) || 'home', false);
