/* LEX: dependency-free, keyboard-accessible client for the grounded legal assistant. */
(() => {
'use strict';
const $ = (selector,root=document) => root.querySelector(selector);
const $$ = (selector,root=document) => [...root.querySelectorAll(selector)];
const iconSet = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  messages:'<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3v-6A7.5 7.5 0 0 1 12.5 4h.5a7 7 0 0 1 7 7.5Z"/><path d="M9 11h7M9 14h5"/>',
  files:'<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 13h7M9 17h7"/>',
  trash:'<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  shield:'<path d="m12 3 8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4Z"/><path d="m9 12 2 2 4-4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  scale:'<path d="M12 3v18M5 21h14M8 7h8M4 7l-3 7h6L4 7Zm16 0-3 7h6l-3-7ZM4 7l8-4 8 4"/>',
  book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 8-1 10 2 2-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sparkle:'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3ZM4 3l.7 1.3L6 5l-1.3.7L4 7l-.7-1.3L2 5l1.3-.7L4 3Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  alert:'<path d="m12 3 10 18H2L12 3ZM12 9v5M12 18v.1"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 1 1 5 2c-1.5 1-2 2-2 4M12 18v.1"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16H3V5a2 2 0 0 1 2-2h11v1"/>',
  external:'<path d="M13 5h6v6M19 5 9 15"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
  bookmark:'<path d="M5 4h14v18l-7-4-7 4V4Z"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7v.1"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  arrowleft:'<path d="m14 6-6 6 6 6M8 12h13"/>'
};
const I = name => `<span class="svg-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${iconSet[name]||iconSet.files}</svg></span>`;
function hydrateIcons(){ $$('[data-i]').forEach(e => { e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${iconSet[e.dataset.i]||iconSet.files}</svg>`; }); }
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
const api = async (url, options={}) => {
  const response = await fetch(url, {...options, headers:{'Content-Type':'application/json',...(options.headers||{})}});
  let data;try{data=await response.json()}catch {data={detail:`HTTP ${response.status}`};}
  if(!response.ok) {const err=new Error(typeof data.detail==='string' ? data.detail : 'Ошибка запроса к серверу');err.status=response.status;throw err;}
  return data;
};
const storeKey = 'lex_chat_state_v1';
const state = {route:'chat', docs:[], selectedDoc:null, docDetails:{}, docFilter:'', docQuery:'', convo:[], activeConvo:null, loading:false, sources:[], activeSource:0, apiReady:false, model:'DeepSeek'};
try { const prior=JSON.parse(localStorage.getItem(storeKey)||'{}'); state.convo=Array.isArray(prior.convo)?prior.convo.slice(-25):[];state.activeConvo=prior.activeConvo||null; } catch{}
const save = () => { try{localStorage.setItem(storeKey,JSON.stringify({convo:state.convo,activeConvo:state.activeConvo}));}catch{} };
const activeChat = () => state.convo.find(x=>x.id===state.activeConvo);
const toShort = (value,n=55) => value.length>n?value.slice(0,n-1)+'…':value;
let toastTimer;
function toast(text) { const t=$('#toast'); t.textContent=text; t.classList.add('visible'); clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3300); }
function reroute(route){state.route=route; $('#view-chat').classList.toggle('hidden',route!=='chat');$('#view-docs').classList.toggle('hidden',route!=='docs');$$('[data-route]').forEach(x=>x.classList.toggle('active',x.dataset.route===route));$('#current-breadcrumb').textContent=route==='docs'?'База знаний':(activeChat()?.title||'Новый диалог');$('#sidebar').classList.remove('open'); if(route==='chat') renderChat();else renderDocs();}
function newChat() {state.activeConvo=null;state.sources=[];state.activeSource=0;save();reroute('chat');$('#chat-input').value='';$('#chat-input').focus();}
function ensureChat(question) {let c=activeChat();if(!c){c={id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:toShort(question,42),messages:[],created:Date.now()};state.convo.unshift(c);state.activeConvo=c.id;}return c;}
function renderHistory(){const root=$('#history-list');root.innerHTML=state.convo.length ? state.convo.map(c=>`<button class="history-item ${c.id===state.activeConvo?'active':''}" data-history="${esc(c.id)}">${I('messages')}<span>${esc(c.title)}</span></button>`).join(''):'<div class="history-empty">Здесь будут ваши диалоги и вопросы к документам.</div>';}
const suggestions=[
 {icon:'files',name:'Условия договора',text:'Какой срок оплаты по договору ПТ-05/2023 с ООО «Альфа-Трейдинг»?'},
 {icon:'calendar',name:'Редакции регламента',text:'Нужно ли одобрение генерального директора для договора на 12 млн рублей в августе 2024 года?'},
 {icon:'book',name:'Трудовое право',text:'Какой максимальный срок испытания можно установить главному бухгалтеру?'},
 {icon:'shield',name:'Работа с контрагентами',text:'Нужно ли проводить санкционную проверку иностранного контрагента в мае 2025 года?'}
];
function welcomeHTML(){return `<div class="welcome"><div class="hero"><div class="hero-text"><span class="eyebrow">${I('sparkle')} ИИ-АССИСТЕНТ ДЛЯ ЮРИСТОВ ПСБ</span><h1>Юридические ответы.<br>С опорой на документы.</h1><p>Находите нужные положения в договорах, регламентах и законодательстве. Проверяйте выводы по первоисточникам и учитывайте даты редакций.</p><div class="hero-features"><span class="hero-feature">${I('check')} Проверяемые ответы</span><span class="hero-feature">${I('files')} Конкретные пункты</span><span class="hero-feature">${I('shield')} Без выдуманных норм</span></div></div><div class="hero-art" aria-hidden="true"><div class="hero-orbit"></div><div class="hero-orbit"></div><div class="hero-scale"><svg viewBox="0 0 120 120" fill="none"><path d="M60 17v80M33 98h54M47 105h26M25 36h70M25 36 60 17 95 36M29 36 12 69h34L29 36Zm62 0L74 69h34L91 36Z" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 70c4 14 28 14 32 0M75 70c4 14 28 14 32 0" stroke="currentColor" stroke-width="2.6"/></svg></div></div></div><div class="quick-start"><div class="section-heading"><h2>С чего начнём?</h2><span>Примеры вопросов из базы знаний</span></div><div class="examples-grid">${suggestions.map((x,i)=>`<button class="example-card" data-example="${i}"><span class="example-icon">${I(x.icon)}</span><span class="example-content"><strong>${esc(x.name)}</strong><span>${esc(x.text)}</span></span></button>`).join('')}</div></div><p class="welcome-footer">LEX использует исключительно предоставленную базу нормативных документов · Hack&Change 2026</p></div>`;}
function formattedAnswer(text,sources){const valid=new Set((sources||[]).map(x=>x.ref));return esc(text).replace(/\[(\d+)\]/g, (whole,n)=>valid.has(+n)?`<button class="citation-inline" data-source="${n}" title="Перейти к источнику ${n}">[${n}]</button>`:whole);}
function statusTag(status){const obj={answered:['check','Ответ на основе документов'],clarify:['help','Нужно уточнение'],insufficient:['alert','Недостаточно оснований'],error:['alert','Техническая ошибка']};const [ico,title]=obj[status]||obj.answered;return `<span class="answer-status ${esc(status)}">${I(ico)} ${title}</span>`;}
function renderTurn(msg){
 if(msg.role==='user') return `<div class="chat-turn user"><div class="bubble">${esc(msg.content)}</div></div>`;
 if(msg.waiting) return `<div class="chat-turn assistant"><div class="chat-avatar">${I('scale')}</div><div class="typing-card"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
 const sources=msg.sources||[];return `<div class="chat-turn assistant"><div class="chat-avatar">${I('scale')}</div><div class="assistant-answer"><div class="message-author">LEX AI <span class="message-time">${esc(msg.date||'')}</span></div>${statusTag(msg.status||'answered')}<div class="answer-text">${formattedAnswer(msg.content,sources)}</div>${sources.length?`<div class="message-source-divider"></div><div class="message-source-title">${I('layers')} Источники (${sources.length})</div><div class="message-source-chips">${sources.map(s=>`<button class="message-source-chip" data-source="${s.ref}">${I('files')}<span>${esc(s.title)}<small>${esc(s.clause)} ${s.version?' · '+esc(s.version):''}</small></span>${I('chevron')}</button>`).join('')}</div>`:''}<div class="message-actions"><button class="mini-icon-btn" data-copy="${esc(msg.id||'')}" aria-label="Скопировать ответ" title="Скопировать">${I('copy')}</button></div></div></div>`;
}
function renderChat(){renderHistory();const root=$('#messages');const chat=activeChat();if(!chat?.messages.length){root.innerHTML=welcomeHTML();state.sources=[];renderEvidence();return;}
 root.innerHTML=`<div class="chat-heading"><div><h2>${esc(chat.title)}</h2><small>Диалог с юридическим ИИ-ассистентом</small></div><button class="outline-btn" data-action="new-chat">${I('plus')} Новый диалог</button></div><div class="thread">${chat.messages.map(renderTurn).join('')}</div>`;
 const lastAssistant=[...chat.messages].reverse().find(m=>m.role==='assistant' && !m.waiting);state.sources=lastAssistant?.sources||[];if(!state.sources.some(s=>s.ref===state.activeSource))state.activeSource=state.sources[0]?.ref||0;renderEvidence();scrollToBottom();
}
function renderEvidence(){const target=$('#evidence-panel'),s=state.sources;const source=s.find(x=>x.ref===state.activeSource)||s[0];if(!s.length){target.innerHTML=`<div class="evidence-header"><h3>Источники</h3>${I('book')}</div><div class="empty-evidence"><span class="empty-icon">${I('files')}</span><strong>Документы под рукой</strong><p>Когда ассистент ответит на вопрос, здесь появятся использованные документы и подтверждающие положения.</p></div>`;return;}
 target.innerHTML=`<div class="evidence-header"><h3>Источники <span class="count-dot">${s.length}</span></h3><button class="mini-icon-btn" id="close-evidence" title="Скрыть панель">${I('close')}</button></div><div class="evidence-inner"><div class="evidence-label">ПОДТВЕРЖДАЮЩИЕ ДОКУМЕНТЫ</div><div class="source-list">${s.map(x=>`<button class="source-tile ${x.ref===source.ref?'active':''}" data-source="${x.ref}"><span class="source-number">${x.ref}</span><span class="source-content"><strong>${esc(x.title)}</strong><small>${esc(x.clause)}${x.version?' · '+esc(x.version):''}</small></span></button>`).join('')}</div><div class="source-preview"><div class="evidence-label">ФРАГМЕНТ ПЕРВОИСТОЧНИКА</div><div class="source-preview-card"><div class="source-preview-head"><span>${esc(source.clause)}</span>${I('bookmark')}</div><div class="quote-text">${esc(source.excerpt)}</div><div class="source-preview-footer"><button class="outline-btn" data-open-doc="${esc(source.doc_id)}" data-clause="${esc(source.clause)}">Открыть документ ${I('external')}</button></div></div></div></div>`;
}
function scrollToBottom(){requestAnimationFrame(()=>{const a=$('#chat-scroll');a.scrollTop=a.scrollHeight;});}
function setSendDisabled(disabled){state.loading=disabled;$('#send-button').disabled=disabled;$('#chat-input').disabled=disabled;}
async function sendQuestion(value){const question=String(value||'').trim();if(!question||state.loading)return;reroute('chat');const c=ensureChat(question);const history=c.messages.filter(m=>!m.waiting&&!m.error).map(m=>({role:m.role,content:m.content})).slice(-6);c.messages.push({id:Date.now().toString(),role:'user',content:question});c.messages.push({role:'assistant',waiting:true});$('#chat-input').value='';$('#chat-input').style.height='auto';setSendDisabled(true);renderChat();
 try{const payload=JSON.stringify({question,history});const send=()=>api('/api/chat',{method:'POST',headers:{'X-Demo-Access-Code':sessionStorage.getItem('lex_demo_access_code')||''},body:payload});let result;try{result=await send();}catch(error){if(error.status!==403)throw error;const code=prompt('Введите код доступа к демо LEX:');if(!code)throw error;sessionStorage.setItem('lex_demo_access_code',code);result=await send();}c.messages.pop();c.messages.push({id:'m'+Date.now(),role:'assistant',content:result.answer, status:result.status,sources:result.sources||[],date:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})});}
 catch(err){c.messages.pop();const msg=err.message.includes('DEEPSEEK_API_KEY')?'Для получения ответов укажите DEEPSEEK_API_KEY в файле .env и перезапустите сервер. База документов уже загружена.':err.message;c.messages.push({id:'m'+Date.now(),role:'assistant',status:'error',content:msg,sources:[],date:'',error:true});}
 finally{setSendDisabled(false);save();renderChat();$('#chat-input').focus();}
}
const cats=[['Все документы',''],['Договоры','Договоры'],['Доп. соглашения','Доп. соглашения'],['Регламенты','Регламенты'],['Служебные документы','Служебные документы'],['Законодательство РФ','Законодательство РФ']];
function groupStats(){return [{name:'Все документы',cat:'',count:state.docs.length,icon:'layers'},...cats.slice(1).map(([name,cat])=>({name,cat,count:state.docs.filter(d=>d.category===cat).length,icon:cat==='Законодательство РФ'?'book':'files'}))];}
function documentsFiltered(){return state.docs.filter(d=> (!state.docFilter||d.category===state.docFilter)&&(!state.docQuery||[d.title,d.counterparty,d.contract_id,d.law_article].join(' ').toLowerCase().includes(state.docQuery.toLowerCase())));}
function renderDocs(){renderHistory();const root=$('#view-docs');const groups=groupStats();const active=state.selectedDoc;const list=documentsFiltered();root.innerHTML=`<div class="docs-heading"><div><h1>База знаний</h1><p>Договоры, редакции регламентов и нормативные акты — все подтверждающие источники в одном месте</p></div><div class="docs-counter">${state.docs.length} документ${state.docs.length===21?'': 'ов'}</div></div><div class="docs-stats">${groups.filter(x=>['Договоры','Регламенты','Служебные документы','Законодательство РФ'].includes(x.name)).map(s=>`<button class="stat-card" data-filter-category="${esc(s.cat)}"><span class="stat-icon">${I(s.icon)}</span><span><strong>${s.count}</strong><small>${esc(s.name)}</small></span></button>`).join('')}</div><div class="docs-toolbar"><div class="search-input">${I('search')}<input id="docs-search" type="search" placeholder="Поиск по документам, номерам, контрагентам..." value="${esc(state.docQuery)}"/></div><select id="docs-category" class="select-field" aria-label="Категория документа">${cats.map(([label,val])=>`<option value="${esc(val)}" ${val===state.docFilter?'selected':''}>${esc(label)}</option>`).join('')}</select></div><div class="docs-workspace ${active?'viewing':''}" id="docs-workspace"><div class="docs-list-panel"><div class="doc-list-head">Документы (${list.length})</div><div id="docs-list-content">${list.length?list.map(d=>`<button class="document-row ${d.id===active?'active':''}" data-doc="${esc(d.id)}"><span class="doc-icon">${I('files')}</span><span class="document-row-body"><strong>${esc(d.title)}</strong><small>${esc(d.counterparty||d.law_article||'Документ из предоставленной базы')}</small><span class="doc-category">${esc(d.category)}</span></span>${I('chevron')}</button>`).join(''):'<div class="docs-empty">По вашему запросу документы не найдены</div>'}</div></div><div class="doc-viewer" id="doc-viewer"><div class="viewer-placeholder">${I('files')}<p>Выберите документ для просмотра</p></div></div></div>`;
 if(active)renderViewer(active);
}
function renderListOnly(){const root=$('#docs-list-content');if(!root)return;const list=documentsFiltered();$('.doc-list-head').textContent=`Документы (${list.length})`;root.innerHTML=list.length?list.map(d=>`<button class="document-row ${d.id===state.selectedDoc?'active':''}" data-doc="${esc(d.id)}"><span class="doc-icon">${I('files')}</span><span class="document-row-body"><strong>${esc(d.title)}</strong><small>${esc(d.counterparty||d.law_article||'Документ из предоставленной базы')}</small><span class="doc-category">${esc(d.category)}</span></span>${I('chevron')}</button>`).join(''):'<div class="docs-empty">По вашему запросу документы не найдены</div>';}
function highlightClause(text,clause){const escaped=esc(text);if(!clause||!clause.startsWith('п.'))return escaped;const num=clause.replace('п.','').trim();const re=new RegExp(`(^|\\n)(${num.replace('.','\\.')}\\.\\s+[^\\n]{0,500})`);return escaped.replace(re,(full,leading,body)=>`${leading}<mark>${body}</mark>`);}
async function renderViewer(docId,clause){const root=$('#doc-viewer');if(!root)return;let doc=state.docDetails[docId];if(!doc){root.innerHTML='<div class="viewer-placeholder">Загрузка документа…</div>';try{doc=await api('/api/documents/'+encodeURIComponent(docId));state.docDetails[docId]=doc;}catch(e){root.innerHTML=`<div class="docs-empty">${esc(e.message)}</div>`;return;}}if(state.selectedDoc!==docId)return;
 root.innerHTML=`<div class="viewer-toolbar"><button class="viewer-back" id="viewer-back" aria-label="К списку">${I('arrowleft')}</button><span class="doc-icon">${I('files')}</span><div><h3>${esc(doc.title)}</h3><span>${esc(doc.category)} ${doc.version?' · '+esc(doc.version):''}</span></div><div class="viewer-top-right"><button class="mini-icon-btn" data-download-doc="${esc(docId)}" title="Скачать TXT">${I('external')}</button></div></div><div class="viewer-paper" id="viewer-paper"><pre>${highlightClause(doc.text,clause||state.currentClause)}</pre></div><div class="viewer-footer"><span>${esc(doc.counterparty||doc.law_article||'Оригинал из базы знаний')}</span><span>Исходный формат: TXT · Только чтение</span></div>`;
 if(clause||state.currentClause){const mark=$('mark',root);if(mark)mark.scrollIntoView({block:'center'});}
}
async function openDocument(id,clause){state.selectedDoc=id;state.currentClause=clause||null;reroute('docs');await renderViewer(id,clause);}
async function init(){hydrateIcons();renderHistory();renderChat();$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQuestion(e.target.value)}});$('#chat-input').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(165,e.target.scrollHeight)+'px';});$('#send-button').addEventListener('click',()=>sendQuestion($('#chat-input').value));
 document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.action==='new-chat'){newChat();return;}
  if(button.dataset.route){reroute(button.dataset.route);return;}
  if(button.dataset.history){state.activeConvo=button.dataset.history;save();reroute('chat');return;}
  if(button.dataset.example!=null){sendQuestion(suggestions[+button.dataset.example].text);return;}
  if(button.dataset.source!=null){const ref=+button.dataset.source;const last=[...(activeChat()?.messages||[])].reverse().find(m=>(m.sources||[]).some(x=>x.ref===ref));if(last){state.sources=last.sources;state.activeSource=ref;renderEvidence();$('#view-chat').classList.add('show-evidence');}return;}
  if(button.dataset.openDoc){openDocument(button.dataset.openDoc,button.dataset.clause);return;}
  if(button.dataset.doc){openDocument(button.dataset.doc);return;}
  if(button.dataset.filterCategory!=null){state.docFilter=button.dataset.filterCategory;renderDocs();return;}
  if(button.dataset.downloadDoc){const d=state.docDetails[button.dataset.downloadDoc];if(d){const file=new Blob([d.text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=d.title+'.txt';a.click();URL.revokeObjectURL(url);}return;}
  if(button.dataset.copy){const msg=activeChat()?.messages.find(x=>x.id===button.dataset.copy);if(msg){try{await navigator.clipboard.writeText(msg.content);toast('Ответ скопирован');}catch{toast('Не удалось скопировать текст');}}return;}
  if(button.id==='close-evidence'){$('#view-chat').classList.remove('show-evidence');return;}
  if(button.id==='toggle-menu'){$('#sidebar').classList.toggle('open');return;}
  if(button.id==='viewer-back'){$('#docs-workspace').classList.remove('viewing');state.selectedDoc=null;return;}
  if(button.id==='clear-history'){if(confirm('Удалить сохранённые на этом устройстве диалоги?')){state.convo=[];state.activeConvo=null;save();renderHistory();reroute('chat');toast('История диалогов очищена');}return;}
 });
 document.addEventListener('input',e=>{if(e.target.id==='docs-search'){state.docQuery=e.target.value;renderListOnly();}});
 document.addEventListener('change',e=>{if(e.target.id==='docs-category'){state.docFilter=e.target.value;renderListOnly();}});
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();reroute('chat');$('#chat-input').focus();}});
 try{const [health,documents]=await Promise.all([api('/api/health'),api('/api/documents')]);state.apiReady=health.api_configured;state.model=health.model;state.docs=documents.items||[];$('#nav-doc-count').textContent=state.docs.length;$('#top-doc-counter').textContent=state.docs.length+' документ'+(state.docs.length===21?'':'ов');$('#api-status').className='status-pill '+(state.apiReady?'ready':'unready');$('#api-status').innerHTML=`<span class="status-led"></span><span>${state.apiReady?esc(state.model):'API не настроен'}</span>`;}
 catch(error){toast('Не удалось загрузить базу знаний: '+error.message);$('#api-status').innerHTML='<span class="status-led"></span><span>Нет связи с сервером</span>';}
}
init();
})();
