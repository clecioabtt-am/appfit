import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCheck,LockKeyhole,MessageCircle,Send,UserRound,RefreshCw} from 'lucide-react';
import {get,post} from './api';
import type {User} from './api';

type Presence='ONLINE'|'AWAY'|'OFFLINE';
type Contact={studentId:number;name:string;email?:string;photoUrl:string|null;role:'admin'|'student';presence:Presence;lastMessage:string;lastAt:string|null;unread:number};
type Message={id:number;studentId:number;senderRole:'admin'|'student';senderId:number;senderName:string;senderPhoto:string|null;body:string;createdAt:string;readAt:string|null};
const presenceLabel:Record<Presence,string>={ONLINE:'Online',AWAY:'Ausente',OFFLINE:'Offline'};
const fmt=(date:string)=>{const normalized=date.includes('T')?date:date.replace(' ','T')+'Z';const t=Date.parse(normalized);return Number.isFinite(t)?new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''};

function Avatar({name,src,role,size='md'}:{name:string;src?:string|null;role:'admin'|'student';size?:'md'|'lg'}){
 const avatar=src||(role==='admin'?'/brand/wagner-retrato.jpg':null);
 return <span className={'chatAvatar chatAvatar-'+size}>{avatar?<img src={avatar} alt={`Foto de ${name}`} loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<UserRound size={size==='lg'?25:19}/>}</span>;
}
function OnlineBadge({presence}:{presence:Presence}){return <span className={'presenceText presence-'+presence.toLowerCase()}><i aria-hidden="true"/> {presenceLabel[presence]}</span>}

export default function Chat({user}:{user:User}){
 const [hasOlder,setHasOlder]=useState(false),[loadingOlder,setLoadingOlder]=useState(false),[contacts,setContacts]=useState<Contact[]>([]),[selected,setSelected]=useState<number|null>(null),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[error,setError]=useState(''),[restricted,setRestricted]=useState(false),[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
 const lastId=useRef(0),selectedRef=useRef<number|null>(null),bottom=useRef<HTMLDivElement>(null),mounted=useRef(true);
 const isAdmin=user.role==='admin';
 const fetchContacts=async()=>{
  try{const res=await get<{items:Contact[]}>('/chat/conversations');if(!mounted.current)return;
   setContacts(res.items);setRestricted(false);setError('');
   if(!isAdmin&&res.items.length){setSelected(res.items[0].studentId)}
   else if(isAdmin){setSelected(old=>old&&res.items.some(x=>x.studentId===old)?old:res.items[0]?.studentId??null)}
  }catch(e:any){if(!mounted.current)return;setContacts([]);setSelected(null);setRestricted(!isAdmin);setError(e.message||'Não foi possível carregar o chat.')}finally{if(mounted.current)setLoading(false)}
 };
 useEffect(()=>{mounted.current=true;void fetchContacts();const tick=window.setInterval(()=>{if(document.visibilityState==='visible')void fetchContacts()},5000);return()=>{mounted.current=false;clearInterval(tick)}},[user.id,user.role]);
 useEffect(()=>{selectedRef.current=selected;lastId.current=0;setMessages([]);setHasOlder(false);if(selected===null)return;
  let live=true;let inFlight=false;
  const load=async()=>{if(inFlight||!live||document.visibilityState==='hidden')return;inFlight=true;
   try{const result=await get<{items:Message[];hasMore:boolean}>(`/chat/messages?studentId=${selected}&after=${lastId.current}`);
    if(!live)return;
    if(result.items.length){if(lastId.current===0)setHasOlder(result.hasMore===true);const newest=result.items[result.items.length-1].id;lastId.current=Math.max(lastId.current,newest);setMessages(prev=>[...prev,...result.items.filter(m=>!prev.some(p=>p.id===m.id))]);
      const unread=result.items.filter(m=>m.senderRole!==(isAdmin?'admin':'student')&&m.readAt===null);
      if(unread.length)await post('/chat/read',{studentId:selected,throughId:unread[unread.length-1].id}).catch(()=>{});
      window.setTimeout(()=>{if(live)bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},50);
    }
    const status=await get<{readThrough:number}>(`/chat/read-state?studentId=${selected}`).catch(()=>null);
    if(live&&status?.readThrough)setMessages(prev=>prev.map(m=>m.senderRole===(isAdmin?'admin':'student')&&m.id<=status.readThrough&&!m.readAt?{...m,readAt:'lida'}:m));
   }catch(e:any){if(live)setError(e.message||'Não foi possível carregar mensagens.')}finally{inFlight=false}
  };
  void load();const interval=window.setInterval(load,2500);
  const visible=()=>{if(document.visibilityState==='visible')void load()};document.addEventListener('visibilitychange',visible);
  return()=>{live=false;clearInterval(interval);document.removeEventListener('visibilitychange',visible)};
 },[selected,user.role]);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();const content=draft.trim();if(!content||!selected||sending)return;setSending(true);
  try{await post('/chat/messages',{studentId:selected,body:content});setDraft('');
    const res=await get<{items:Message[]}>(`/chat/messages?studentId=${selected}&after=${lastId.current}`);
    if(selectedRef.current===selected&&res.items.length){lastId.current=Math.max(lastId.current,res.items[res.items.length-1].id);setMessages(prev=>[...prev,...res.items.filter(m=>!prev.some(p=>p.id===m.id))]);setTimeout(()=>bottom.current?.scrollIntoView({behavior:'smooth',block:'end'}),40)}
  }catch(e:any){setError(e.message||'Falha ao enviar a mensagem.')}finally{setSending(false)}
 };
 const loadOlder=async()=>{if(!selected||loadingOlder||!messages.length)return;setLoadingOlder(true);
  try{const oldest=messages[0].id;const r=await get<{items:Message[];hasMore:boolean}>(`/chat/messages?studentId=${selected}&before=${oldest}`);setMessages(prev=>[...r.items.filter(m=>!prev.some(p=>p.id===m.id)),...prev]);setHasOlder(r.hasMore)}
  catch(e:any){setError(e.message)}finally{setLoadingOlder(false)}
 };
 const peer=contacts.find(c=>c.studentId===selected);
 if(restricted)return <section><h1 className="chatTitle">Chat com o personal</h1><div className="panel chatLocked"><LockKeyhole size={42}/><h2>Chat exclusivo para planos pagos</h2><p>Este canal fica disponível depois que o Wagner aprovar seu pagamento Pix e seu plano pago estiver ativo. O Plano Teste não habilita o chat.</p></div></section>;
 return <section className="chatModule"><div className="chatPageHeading"><div><div className="pageKicker">WAGNER NORONHA · ATENDIMENTO INDIVIDUAL</div><h1>{isAdmin?'Mensagens dos alunos':'Conversar com Wagner Noronha'}</h1><p>{isAdmin?'Acompanhamento de alunos com plano pago vigente.':'Tire suas dúvidas diretamente com seu personal. As mensagens são atualizadas automaticamente.'}</p></div><button className="btn btn-outline" onClick={()=>void fetchContacts()} aria-label="Atualizar lista"><RefreshCw size={17}/> Atualizar</button></div>
  {error&&!restricted&&<div role="alert" className="chatError">{error}</div>}
  <div className={'chatShell '+(isAdmin?'chatAdmin':'chatStudent')}>
   {isAdmin&&<aside className={'chatContacts '+(peer?'chatContactsHasSelection':'')} aria-label="Conversas com alunos"><div className="chatListHeading">Alunos com plano pago <span>{contacts.length}</span></div>
    {contacts.map(c=><button type="button" key={c.studentId} className={'chatContact '+(selected===c.studentId?'selected':'')} onClick={()=>{setSelected(c.studentId);selectedRef.current=c.studentId;setError('')}}>
      <span className="chatContactAvatar"><Avatar name={c.name} role="student" src={c.photoUrl}/><i className={'presenceDot dot-'+c.presence.toLowerCase()}/></span>
      <span className="chatContactInfo"><strong>{c.name}</strong><small>{c.lastMessage||c.email||'Inicie uma conversa'}</small><OnlineBadge presence={c.presence}/></span>{c.unread>0&&<span className="chatUnread">{c.unread}</span>}
    </button>)}
    {!contacts.length&&<p className="chatNoContacts">{loading?'Carregando…':'Nenhum aluno com plano pago ativo no momento.'}</p>}
   </aside>}
   <div className="chatConversation">
    {peer?<><div className="chatHeader">{isAdmin&&<button className="chatMobileBack" onClick={()=>setSelected(null)} aria-label="Voltar às conversas"><ArrowLeft size={20}/></button>}<span className="chatContactAvatar"><Avatar name={peer.name} src={peer.photoUrl} role={peer.role} size="lg"/><i className={'presenceDot dot-'+peer.presence.toLowerCase()}/></span><div className="chatHeaderName"><strong>{peer.name}</strong><OnlineBadge presence={peer.presence}/></div><span className="chatHeaderPrivacy">Conversa privada</span></div>
    <div className="chatMessages" aria-label="Histórico da conversa" aria-live="polite">{hasOlder&&<button type="button" className="chatLoadOlder" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder?'Carregando…':'Ver mensagens anteriores'}</button>}
     {!messages.length&&<div className="chatWelcome"><MessageCircle size={34}/><b>Comece a conversa</b><p>Seu histórico de mensagens com {peer.name} aparecerá aqui.</p></div>}
     {messages.map(m=>{const mine=m.senderRole===(isAdmin?'admin':'student');return <article key={m.id} className={'chatBubbleRow '+(mine?'mine':'theirs')}><Avatar name={m.senderName} src={m.senderPhoto} role={m.senderRole}/><div className={'chatBubble '+(mine?'mine':'theirs')}><strong>{m.senderName}</strong><p>{m.body}</p><div className="chatMessageMeta"><time>{fmt(m.createdAt)}</time>{mine&&m.readAt&&<CheckCheck size={15} aria-label="Lida"/>}</div></div></article>})}
     <div ref={bottom}/>
    </div>
    <form className="chatComposer" onSubmit={submit}><input value={draft} maxLength={1500} onChange={e=>setDraft(e.target.value)} placeholder="Escreva uma mensagem para seu personal..." aria-label="Mensagem"/><button type="submit" disabled={!draft.trim()||sending} aria-label="Enviar mensagem"><Send size={19}/></button></form>
    </>:<div className="chatSelectEmpty"><MessageCircle size={43}/><h3>Selecione uma conversa</h3><p>{loading?'Carregando contatos…':'O chat fica disponível para alunos com um plano pago aprovado e vigente.'}</p></div>}
   </div>
  </div><p className="chatFinePrint"><span className="presenceDot dot-online"/> Verde: aplicativo em primeiro plano · <span className="presenceDot dot-away"/> Laranja: em segundo plano ou fechado com sessão válida · <span className="presenceDot dot-offline"/> Vermelho: logout ou sessão expirada. A presença pode levar alguns segundos para atualizar.</p>
 </section>;
}
