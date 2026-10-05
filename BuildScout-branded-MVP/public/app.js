const topics=['Artificial Intelligence','Machine Learning','Deep Learning','Computer Vision','Natural Language Processing','Generative AI','AI Agents','Data Science','Computer Science','Robotics','ROS / ROS 2','Autonomous Systems','Reinforcement Learning','Embedded Systems','Electronics','IoT','Simulation','3D / CAD','Computer Graphics','Web Development','Mobile Development','Cybersecurity','Open Source'];
const hardware=['Laptop only','Webcam','Arduino','Raspberry Pi','Microcontroller','Sensors','Robotics kit','3D printer','GPU'];
const levels=[['Beginner','Little or no prior experience.'],['Intermediate','Comfortable with programming and basic technical concepts.'],['Advanced','Comfortable with technical frameworks and complex projects.'],['Expert','Looking for difficult builds or substantial open-source projects.']];
const times=['Under 2 hours','2–5 hours','5–10 hours','10–20 hours','20+ hours'];
const budgets=['£0 / Free','Under £20','£20–£50','£50–£100','£100+'];
const goals=['Learn a new skill','Build something cool','Portfolio / CV','University project','Research','Contribute to open source','Just for fun'];
let state={topics:['Computer Vision'],level:'Intermediate',time:'5–10 hours',budget:'Under £20',hardware:['Laptop only','Webcam'],goals:['Portfolio / CV']};
let projects=[];
let shortlist=new Set();
let resultsMeta={searched:0,fetched:0};
let showShortlist=false;
const app=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
app.addEventListener('click',handleSetupClick);

function chips(items,key,multi=true){
  const selected=multi?state[key].length:1;
  return `<div class="selection-heading"><span>${multi?'Choose any that fit':'Choose one'}</span><span class="selection-count" data-count="${key}">${multi?`${selected} selected`:esc(state[key])}</span></div>
    ${multi?`<div class="selection-tools"><button type="button" class="text-button" data-select-visible="${key}">Select all shown</button><button type="button" class="text-button" data-clear="${key}">Clear</button></div>`:''}
    <div class="chips">${items.map(x=>{let on=multi?state[key].includes(x):state[key]===x;return `<button type="button" class="chip ${on?'active':''}" aria-pressed="${on}" data-key="${key}" data-value="${esc(x)}">${multi?`<span class="chip-check" aria-hidden="true">${on?'✓':''}</span>`:''}${esc(x)}</button>`}).join('')}</div>`;
}

function renderSetup(){
  app.innerHTML=`<section class="hero"><div class="eyebrow">Open-web project discovery</div><h1>Discover something <span>worth building.</span></h1><p>Tell BuildScout what you want to learn. It searches the live web, reads the best projects and assembles a build path around you.</p><img class="hero-art" src="/assets/illustrations/hero-discovery.webp" alt="BuildScout discovering projects and resources"><div style="height:28px"></div></section><section class="panel">
  <div class="section"><div class="section-title"><h2>1. What are you interested in?</h2><span class="multi-hint">Choose as many as you like, or add your own</span></div><label class="topic-search"><span class="sr-only">Search interests</span><span aria-hidden="true">⌕</span><input id="topic-search" type="search" placeholder="Search interests..." autocomplete="off"></label><div class="custom-interest"><label class="sr-only" for="custom-interest-input">Add any skill or project interest</label><input id="custom-interest-input" type="text" maxlength="100" placeholder="Add any skill or project idea..."><button type="button" class="btn secondary" id="add-interest">+ Add interest</button></div><p class="form-hint" id="custom-interest-hint" role="status">Can't find your interest? Type it above and add it.</p><div id="topic-options">${chips([...topics,...state.topics.filter(x=>!topics.includes(x))],'topics')}</div><p class="form-hint" id="topic-hint">Choose at least one interest to find relevant projects.</p></div>
  <div class="two"><div class="section"><h2>2. Skill level</h2><div class="grid">${levels.map(([a,b])=>`<button type="button" class="card ${state.level===a?'active':''}" aria-pressed="${state.level===a}" data-key="level" data-value="${a}"><b>${a}</b><span>${b}</span></button>`).join('')}</div></div><div class="section"><h2>3. Time per project</h2>${chips(times,'time',false)}</div></div>
  <div class="two"><div class="section"><h2>4. Budget</h2>${chips(budgets,'budget',false)}</div><div class="section"><div class="section-title"><h2>5. Hardware</h2><span class="multi-hint">Choose any you have</span></div>${chips(hardware,'hardware')}</div></div>
  <div class="section"><div class="section-title"><h2>6. What do you want to achieve?</h2><span class="multi-hint">Choose any that fit</span></div>${chips(goals,'goals')}</div>
  <div class="actions"><div><b>Your profile</b><div class="summary" id="profile-summary"></div></div><button class="btn primary" id="find" ${state.topics.length?'':'disabled'}>Find something to build →</button></div></section>`;

  app.querySelector('#topic-search').addEventListener('input',filterTopics);
  app.querySelector('#custom-interest-input').addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();addInterest()}
  });
  app.querySelector('#add-interest').addEventListener('click',addInterest);
  app.querySelector('#find').addEventListener('click',search);
  updateSetup();
}

function addInterest(){
  const input=app.querySelector('#custom-interest-input');
  const value=input.value.trim();
  const hint=app.querySelector('#custom-interest-hint');
  if(!value){hint.textContent='Enter an interest or skill to add it.';input.focus();return}
  if(state.topics.some(topic=>topic.toLowerCase()===value.toLowerCase())){
    hint.textContent=`“${value}” is already in your interests.`;
    input.focus();
    return;
  }
  state.topics.push(value);
  input.value='';
  app.querySelector('#topic-search').value='';
  hint.textContent=`Added “${value}”.`;
  updateSetup();
}

function handleSetupClick(event){
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.key){
    const {key,value}=button.dataset;
    if(['topics','hardware','goals'].includes(key)){
      state[key]=state[key].includes(value)?state[key].filter(x=>x!==value):[...state[key],value];
    }else state[key]=value;
    updateSetup();
    return;
  }
  if(button.dataset.clear){
    state[button.dataset.clear]=[];
    updateSetup();
    return;
  }
  if(button.dataset.selectVisible){
    const key=button.dataset.selectVisible;
    const visible=[...app.querySelectorAll(`[data-key="${key}"]:not([hidden])`)].map(x=>x.dataset.value);
    state[key]=[...new Set([...state[key],...visible])];
    updateSetup();
  }
}

function filterTopics(){
  const query=app.querySelector('#topic-search').value.trim().toLowerCase();
  app.querySelectorAll('[data-key="topics"]').forEach(button=>{button.hidden=!button.dataset.value.toLowerCase().includes(query)});
}

function updateSetup(){
  app.querySelector('#topic-options').innerHTML=chips([...topics,...state.topics.filter(x=>!topics.includes(x))],'topics');
  for(const key of ['topics','hardware','goals']){
    app.querySelectorAll(`[data-key="${key}"]`).forEach(button=>{
      const active=state[key].includes(button.dataset.value);
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
      button.querySelector('.chip-check').textContent=active?'✓':'';
    });
    app.querySelector(`[data-count="${key}"]`).textContent=`${state[key].length} selected`;
  }
  for(const key of ['time','budget'])app.querySelector(`[data-count="${key}"]`).textContent=state[key];
  app.querySelectorAll('[data-key="level"],[data-key="time"],[data-key="budget"]').forEach(button=>{
    const active=state[button.dataset.key]===button.dataset.value;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  const profileItems=[...state.topics.slice(0,3),...(state.topics.length>3?[`+ ${state.topics.length-3} interests`]:[]),state.level,state.time,state.budget,...(state.hardware.length?[`${state.hardware.length} hardware options`]:[]),...(state.goals.length?[`${state.goals.length} goals`]:[])];
  const pills=profileItems.map(x=>`<span class="pill">${esc(x)}</span>`);
  app.querySelector('#profile-summary').innerHTML=pills.length?pills.join(''):'<span class="status">Choose your interests and preferences to get started.</span>';
  app.querySelector('#find').disabled=state.topics.length===0;
  app.querySelector('#topic-hint').textContent=state.topics.length?'Pick several interests to explore a broader range of projects.':'Choose at least one interest to find relevant projects.';
  filterTopics();
}

async function search(){
  shortlist.clear();
  showShortlist=false;
  app.innerHTML=`<section class="panel loading"><div class="loader"></div><b>Searching the open web...</b><p class="status">Finding projects · reading repositories · assembling tutorials</p></section>`;
  try{
    const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    projects=d.projects;
    resultsMeta={searched:d.searched,fetched:d.fetched,geminiUsed:d.geminiUsed,geminiWarning:d.geminiWarning};
    renderResults();
  }catch(e){
    app.innerHTML=`<section class="panel"><b>BuildScout couldn't search yet.</b><div class="error">${esc(e.message)}<br><br>Set <code>TINYFISH_API_KEY</code> in the server environment and restart the app.</div><div class="actions"><button class="btn secondary" id="back-to-setup">Back</button></div></section>`;
    app.querySelector('#back-to-setup').addEventListener('click',renderSetup);
  }
}

function renderResults(){
  app.innerHTML=`<div class="results-head"><div><div class="eyebrow">Personalised results</div><h2>Projects worth building</h2><div class="status">${resultsMeta.searched} live searches · ${resultsMeta.fetched} pages fetched${resultsMeta.geminiUsed?' · Gemini web discovery added':''}</div></div></div>
  <section class="results-tools" aria-label="Find a project"><label class="project-search"><span aria-hidden="true">⌕</span><input id="project-search" type="search" placeholder="Search project names and descriptions..." autocomplete="off"></label><label class="sort-control">Sort by <select id="project-sort"><option value="fit">Best fit</option><option value="title">Name A–Z</option></select></label><button type="button" class="btn shortlist-toggle" id="shortlist-filter" aria-pressed="${showShortlist}">Shortlist <span id="shortlist-count">${shortlist.size}</span></button><span id="result-count" class="status"></span></section>
  ${resultsMeta.geminiWarning?`<p class="search-notice">${esc(resultsMeta.geminiWarning)}</p>`:''}
  <p id="no-results" class="empty-results" hidden>No projects match those filters. Try another search or view all projects.</p>
  <section class="projects" id="project-list">${projects.map((p,i)=>`<article class="project" data-project="${i}" data-title="${esc(p.title.toLowerCase())}" data-description="${esc(p.description.toLowerCase())}"><div class="project-top"><div><div class="status">${esc(p.source)}</div><h3>${esc(p.title)}</h3></div><span class="fit">${p.fit} FIT</span></div><p>${esc(p.description)}</p><div class="meta"><span>${esc(p.difficulty)}</span><span>${esc(p.time)}</span><span>${esc(p.cost)}</span>${p.skills.slice(0,4).map(s=>`<span>${esc(s)}</span>`).join('')}</div><p><b>Why BuildScout picked this:</b> ${esc(p.why)}</p><div class="project-actions"><button type="button" class="choose-project" data-open="${i}">View build path →</button><button type="button" class="save-project ${shortlist.has(i)?'saved':''}" data-save="${i}" aria-pressed="${shortlist.has(i)}">${shortlist.has(i)?'✓ Shortlisted':'＋ Shortlist'}</button>${p.github?`<a href="${esc(p.github)}" target="_blank" rel="noreferrer">GitHub</a>`:''}${p.video?`<a href="${esc(p.video)}" target="_blank" rel="noreferrer">Video</a>`:''}<a href="${esc(p.url)}" target="_blank" rel="noreferrer">Source</a></div></article>`).join('')}</section><div id="detail"></div><div class="actions"><button class="btn secondary" id="change-preferences">← Change preferences</button><button class="btn primary" id="surprise">Surprise me</button></div>`;
  app.querySelector('#project-search').addEventListener('input',applyResultFilters);
  app.querySelector('#project-sort').addEventListener('change',applyResultFilters);
  app.querySelector('#shortlist-filter').addEventListener('click',()=>{
    showShortlist=!showShortlist;
    app.querySelector('#shortlist-filter').setAttribute('aria-pressed',String(showShortlist));
    applyResultFilters();
  });
  app.querySelector('#project-list').addEventListener('click',event=>{
    const open=event.target.closest('[data-open]');
    const save=event.target.closest('[data-save]');
    if(open)openProject(Number(open.dataset.open));
    if(save){
      const i=Number(save.dataset.save);
      if(shortlist.has(i))shortlist.delete(i);else shortlist.add(i);
      save.classList.toggle('saved',shortlist.has(i));
      save.setAttribute('aria-pressed',String(shortlist.has(i)));
      save.textContent=shortlist.has(i)?'✓ Shortlisted':'＋ Shortlist';
      app.querySelector('#shortlist-count').textContent=shortlist.size;
      applyResultFilters();
    }
  });
  app.querySelector('#change-preferences').addEventListener('click',renderSetup);
  app.querySelector('#surprise').addEventListener('click',()=>{state.goals=['Just for fun'];search()});
  applyResultFilters();
}

function applyResultFilters(){
  const query=app.querySelector('#project-search').value.trim().toLowerCase();
  const order=app.querySelector('#project-sort').value;
  const cards=[...app.querySelectorAll('.project')];
  const ordered=[...cards].sort((a,b)=>order==='title'
    ?a.dataset.title.localeCompare(b.dataset.title)
    :projects[Number(b.dataset.project)].fit-projects[Number(a.dataset.project)].fit);
  ordered.forEach(card=>app.querySelector('#project-list').append(card));
  let visible=0;
  for(const card of cards){
    const i=Number(card.dataset.project);
    const match=(!query||card.dataset.title.includes(query)||card.dataset.description.includes(query))&&(!showShortlist||shortlist.has(i));
    card.hidden=!match;
    if(match)visible++;
  }
  app.querySelector('#result-count').textContent=`${visible} of ${projects.length} projects`;
  const empty=app.querySelector('#no-results');
  empty.hidden=visible>0;
  empty.textContent=showShortlist&&!shortlist.size?'Your shortlist is empty. Add a project with the “Shortlist” button.':'No projects match those filters. Try another search or view all projects.';
}

function openProject(i){
  const p=projects[i];
  document.querySelector('#detail').innerHTML=`<section class="detail"><div class="eyebrow">${esc(p.source)} · ${p.fit}/100 fit</div><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><div class="meta">${p.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div><div class="path">${p.path.map(x=>`<div class="step"><b>${esc(x.label)}</b><p>${esc(x.text)}</p></div>`).join('')}</div><div class="monitor"><div><b>Keep discovering</b><div class="status">Get new projects matching this profile each week.</div></div><button class="btn" id="monitor-project">Monitor this topic</button></div></section>`;
  document.querySelector('#monitor-project').addEventListener('click',monitor);
  document.querySelector('#detail').scrollIntoView({behavior:'smooth'});
}

async function monitor(){
  try{
    const r=await fetch('/api/monitor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    toast('TinyMonitor created successfully.');
    document.querySelector('.monitor').innerHTML='<b>You’re being watched.</b><span class="status">BuildScout will keep looking for new matching projects.</span>';
  }catch(e){toast(e.message)}
}

function toast(t){
  const x=document.createElement('div');
  x.className='toast';
  x.textContent=t;
  document.body.append(x);
  setTimeout(()=>x.remove(),4000);
}

renderSetup();
