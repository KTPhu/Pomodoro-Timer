(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const STORE = "pomodoro-garden-v1";
  const defaults = {tasks:[],sessions:[],customRituals:[],mode:"focus",durations:{focus:25,short:5,long:15},alarm:true,phoneReminder:true};
  let data;
  try { data = {...defaults,...JSON.parse(localStorage.getItem(STORE) || "{}")}; } catch { data = {...defaults}; }
  data.tasks ||= []; data.sessions ||= []; data.customRituals ||= []; data.durations = {...defaults.durations,...data.durations};
  let remaining = data.durations[data.mode] * 60, running = false, endAt = null, ticker = null, audioCtx = null, focusMelted = false;
  let lastTickSecond = null;
  const modes = {focus:{label:"FOCUS SESSION",button:"▶  Start focus"},short:{label:"SHORT BREAK",button:"▶  Start break"},long:{label:"LONG BREAK",button:"▶  Start long break"}};
  const todayKey = () => new Date().toLocaleDateString("en-CA");
  const save = () => { localStorage.setItem(STORE,JSON.stringify(data)); renderStats(); };
  const daySessions = (key=todayKey()) => data.sessions.filter(s=>s.day===key && s.mode==="focus");
  const completedToday = () => daySessions().length;
  const totalFocusMinutes = () => data.sessions.filter(s=>s.mode==="focus").reduce((sum,s)=>sum+s.minutes,0);
  function renderTimer(){
    const mm = Math.floor(remaining/60), ss = remaining%60;
    $("#timeDisplay").textContent = `${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
    $("#timerLabel").textContent = modes[data.mode].label;
    $("#startPause").textContent = running ? "Ⅱ  Pause" : modes[data.mode].button;
    $("#sessionCount").textContent = `SESSION ${(completedToday()%4)+1} OF 4`;
    $$(".mode-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.mode===data.mode));
    const total = data.durations[data.mode]*60;
    const pct = total ? (1-remaining/total)*100 : 0;
    $("#timerRing").style.setProperty("--progress", `${pct}%`);
    document.title = `${$("#timeDisplay").textContent} · Pomodoro Garden`;
  }
  function setMode(mode){ pauseTimer(); data.mode=mode; if(mode==="focus")focusMelted=false; remaining=data.durations[mode]*60; save(); renderTimer(); }
  function pauseTimer(){running=false; if(ticker)clearInterval(ticker); ticker=null; endAt=null; renderTimer();}
  function startTimer(){
    if(running){pauseTimer();return;}
    if(data.phoneReminder && data.mode==="focus" && !sessionStorage.getItem("phoneReminderShown")){
      const reminder=$("#phoneReminder");
      reminder.hidden=false;
      $("#phoneReminderConfirm").focus();
      return;
    }
    running=true; endAt=Date.now()+remaining*1000; renderTimer();
    ticker=setInterval(()=>{remaining=Math.max(0,Math.ceil((endAt-Date.now())/1000));renderTimer();if(remaining<=0)finishTimer();},250);
  }
  function finishTimer(){
    if(data.mode==="focus")focusMelted=true;
    const finishedMode=data.mode; pauseTimer();
    if(finishedMode==="focus"){
      data.sessions.push({day:todayKey(),mode:"focus",minutes:data.durations.focus,finishedAt:new Date().toISOString()});
      save(); playAlarm();
      const next = completedToday()%4===0 ? "long" : "short"; setMode(next);
    } else {playAlarm();setMode("focus");}
  }
  function playAlarm(){
    if(!data.alarm)return;
    try {
      audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==="suspended")audioCtx.resume();
      [0,0.28,0.56].forEach(delay=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type="sine";osc.frequency.value=880;gain.gain.setValueAtTime(.0001,audioCtx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.22,audioCtx.currentTime+delay+.02);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+delay+.22);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(audioCtx.currentTime+delay);osc.stop(audioCtx.currentTime+delay+.24);});
    } catch(e) { console.warn("Audio alarm unavailable",e); }
  }
  function renderTasks(){
    const target=$("#nextTask");
    if(!data.tasks.length){target.className="empty";target.textContent="Add a task below to choose what to focus on.";return;}
    target.className="";
    target.innerHTML=data.tasks.map((t,i)=>`<div class="task-row"><input type="checkbox" data-check="${i}" ${t.done?"checked":""} aria-label="Complete ${escapeHtml(t.text)}"><span class="task-text ${t.done?"done":""}">${escapeHtml(t.text)}</span>${i===data.tasks.findIndex(x=>!x.done)?'<span class="pill">UP NEXT</span>':""}<button data-delete="${i}" class="secondary" style="min-width:0;padding:5px 9px" aria-label="Delete task">×</button></div>`).join("");
    $$("[data-check]").forEach(el=>el.addEventListener("change",()=>{data.tasks[+el.dataset.check].done=el.checked;save();renderTasks();}));
    $$("[data-delete]").forEach(el=>el.addEventListener("click",()=>{data.tasks.splice(+el.dataset.delete,1);save();renderTasks();}));
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function renderRituals(){
    const rituals=[
      ["💧","Drink water","Rehydrate and refresh"],
      ["🌳","Step outside","Get some fresh air"],
      ["🧘","Stretch for 2 min","Move your body"],
      ["🚶","Take a 10-minute walk","Let your mind reset"]
    ];
    const target=$("#breakRituals");
    target.innerHTML=rituals.map(([emoji,title,description])=>`<p class="ritual"><span class="emoji">${emoji}</span><span><strong>${title}</strong><small>${description}</small></span></p>`).join("")+data.customRituals.map((ritual,index)=>`<div class="ritual"><span class="emoji">🧊</span><span><strong>${escapeHtml(ritual)}</strong><small>Your break ritual</small></span><button class="ritual-delete" type="button" data-delete-ritual="${index}" aria-label="Remove ${escapeHtml(ritual)}">×</button></div>`).join("");
    $$('[data-delete-ritual]').forEach(button=>button.addEventListener("click",()=>{data.customRituals.splice(Number(button.dataset.deleteRitual),1);save();renderRituals();}));
  }
  function renderStats(){
    const n=completedToday(); $("#todayCount").textContent=`${n} / 8`;
    $("#tomatoes").innerHTML=Array.from({length:Math.max(8,n)},(_,i)=>`<span class="tomato ${i<n?"filled":""}">🧊</span>`).join("");
    $("#focusedStat").textContent=`${totalFocusMinutes()} min`;$("#completedStat").textContent=`${data.sessions.filter(s=>s.mode==="focus").length} cycles`;
    const days=new Set(data.sessions.filter(s=>s.mode==="focus").map(s=>s.day));let streak=0;const d=new Date();
    while(days.has(d.toLocaleDateString("en-CA"))){streak++;d.setDate(d.getDate()-1);}
    $("#streakStat").textContent=`${streak} days`;
    const week=$("#weekBars"), names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], now=new Date();
    week.innerHTML=Array.from({length:7},(_,i)=>{const day=new Date(now);day.setDate(now.getDate()-((now.getDay()+6)%7)+i);const key=day.toLocaleDateString("en-CA");const count=daySessions(key).length;return {day,key,count,name:names[day.getDay()]};}).map(x=>`<div class="day ${x.key===todayKey()?"today":""}"><div class="bar"><i style="height:${Math.max(6,Math.min(100,x.count/8*100))}%"></i></div>${x.name}</div>`).join("");
    renderTasks();
  }
  function showView(view){
    $$(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $("#focusView").classList.toggle("hidden",view!=="focus");$("#otherView").classList.toggle("hidden",view==="focus");
    const titles={focus:"Make room for focus.",tasks:"Tend to your task list.",history:"Every session counts.",calendar:"Make time for focus.",settings:"Make it your own."};
    $("#pageTitle").textContent=titles[view]||titles.focus;
    if(view==="focus")return;
    $("#otherTitle").textContent=titles[view];
    const content=$("#otherContent");
    if(view==="tasks"){
      content.innerHTML='<p class="small-muted">Your tasks are stored in this browser.</p><div id="allTasks"></div>';
      $("#allTasks").innerHTML=data.tasks.length?data.tasks.map((t,i)=>`<div class="task-row"><input type="checkbox" data-allcheck="${i}" ${t.done?"checked":""}><span class="task-text ${t.done?"done":""}">${escapeHtml(t.text)}</span><button class="secondary" data-alldel="${i}">Delete</button></div>`).join(""):'<p class="empty">No tasks yet. Add one on the Focus screen.</p>';
      $$("[data-allcheck]").forEach(e=>e.addEventListener("change",()=>{data.tasks[+e.dataset.allcheck].done=e.checked;save();showView("tasks");}));
      $$("[data-alldel]").forEach(e=>e.addEventListener("click",()=>{data.tasks.splice(+e.dataset.alldel,1);save();showView("tasks");}));
    } else if(view==="history"){
      content.innerHTML=`<p>You have completed <strong>${data.sessions.length}</strong> focus sessions, totalling <strong>${totalFocusMinutes()} minutes</strong>.</p>`+(data.sessions.length?'<div>'+data.sessions.slice().reverse().map(s=>`<div class="task-row">🧊 <span class="task-text">Focus session</span><span class="small-muted">${escapeHtml(s.day)} · ${s.minutes} min</span></div>`).join("")+'</div>':'<p class="empty">Your completed sessions will appear here.</p>')+'<button id="exportBtn" class="secondary">Export session history (CSV)</button>';
      $("#exportBtn").addEventListener("click",()=>{const rows=[["day","mode","minutes","finishedAt"],...data.sessions.map(s=>[s.day,s.mode,s.minutes,s.finishedAt])];download("pomodoro-history.csv",rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv");});
    } else if(view==="calendar"){
      content.innerHTML='<p>There is no calendar account connected in this starter version. You can download a local calendar event and import it into Google Calendar, Apple Calendar, or Outlook.</p><button id="icsBtn" class="primary">Download a focus block (.ics)</button><p class="small-muted">A true two-way sync requires a calendar provider API and sign-in flow.</p>';
      $("#icsBtn").addEventListener("click",downloadCalendar);
    } else if(view==="settings"){
      content.innerHTML=`<p>Choose your session lengths. Changes apply to the next timer session.</p><div class="task-row"><label class="task-text" for="focusMins">Focus minutes</label><input id="focusMins" type="number" min="1" max="120" value="${data.durations.focus}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><div class="task-row"><label class="task-text" for="shortMins">Short break minutes</label><input id="shortMins" type="number" min="1" max="60" value="${data.durations.short}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><div class="task-row"><label class="task-text" for="longMins">Long break minutes</label><input id="longMins" type="number" min="1" max="90" value="${data.durations.long}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><button id="saveSettings" class="primary">Save timer settings</button><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><button id="clearData" class="secondary">Clear all local data</button><p class="small-muted">This removes tasks and history saved in this browser only.</p>`;
      $("#saveSettings").addEventListener("click",()=>{for(const [id,key,max] of [["focusMins","focus",120],["shortMins","short",60],["longMins","long",90]]){const n=Number($("#"+id).value);if(!Number.isInteger(n)||n<1||n>max){alert(`Enter a whole number from 1 to ${max}.`);return;}data.durations[key]=n;}setMode(data.mode);alert("Settings saved.");});
      $("#clearData").addEventListener("click",()=>{if(confirm("Delete all tasks and session history from this browser?")){data={...defaults,tasks:[],sessions:[],durations:{...defaults.durations}};localStorage.removeItem(STORE);pauseTimer();setMode("focus");renderStats();showView("settings");}});
    }
  }
  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function downloadCalendar(){
    const start=new Date(Date.now()+60000),end=new Date(start.getTime()+data.durations.focus*60000);
    const fmt=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
    const ics=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Pomodoro Garden//EN\nBEGIN:VEVENT\nUID:${Date.now()}@pomodoro-garden.local\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(start)}\nDTEND:${fmt(end)}\nSUMMARY:Pomodoro Garden focus session\nDESCRIPTION:One focused session. Remember to take a break afterwards.\nEND:VEVENT\nEND:VCALENDAR`;
    download("pomodoro-focus.ics",ics,"text/calendar");
  }
  $("#startPause").addEventListener("click",startTimer);
  $("#phoneReminderConfirm").addEventListener("click",()=>{
    sessionStorage.setItem("phoneReminderShown","1");
    $("#phoneReminder").hidden=true;
    startTimer();
  });
  $("#resetBtn").addEventListener("click",()=>{pauseTimer();remaining=data.durations[data.mode]*60;renderTimer();});
  $("#skipBtn").addEventListener("click",()=>{pauseTimer();setMode(data.mode==="focus"?(completedToday()%4===3?"long":"short"):"focus");});
  $$(".mode-tabs button").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
  $("#taskForm").addEventListener("submit",e=>{e.preventDefault();const text=$("#taskInput").value.trim();if(!text)return;data.tasks.push({text,done:false,createdAt:new Date().toISOString()});$("#taskInput").value="";save();renderTasks();});
  $$(".nav button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  const alarmToggle=$("#alarmToggle");if(alarmToggle){alarmToggle.checked=data.alarm;alarmToggle.addEventListener("change",e=>{data.alarm=e.target.checked;save();});}
  $("#phoneToggle").checked=data.phoneReminder;$("#phoneToggle").addEventListener("change",e=>{data.phoneReminder=e.target.checked;save();});
  $("#ritualForm").addEventListener("submit",e=>{e.preventDefault();const ritual=$("#ritualInput").value.trim();if(!ritual)return;data.customRituals.push(ritual);$("#ritualInput").value="";save();renderRituals();});
  const calendarBtn=$("#calendarBtn");if(calendarBtn)calendarBtn.addEventListener("click",downloadCalendar);
  $("#todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).toUpperCase();
  $("#timeDisplay").addEventListener("click",()=>{if(running)return;const d=$("#timeDisplay"),i=document.createElement("input");i.value=d.textContent;i.style.cssText="font:inherit;font-size:clamp(40px,5vw,60px);width:190px;text-align:center";d.replaceWith(i);i.focus();i.select();const done=()=>{let v=i.value.trim(),n;if(/^\d{1,3}:\d{1,2}$/.test(v)){const a=v.split(":").map(Number);n=a[0]*60+a[1]}else n=/^\d{1,3}$/.test(v)?Number(v)*60:remaining;n=Math.max(1,Math.min(7200,n));data.durations[data.mode]=Math.ceil(n/60);remaining=n;save();i.replaceWith(d);renderTimer()};i.addEventListener("keydown",e=>{if(e.key==="Enter")done();if(e.key==="Escape"){i.replaceWith(d);renderTimer()}});i.addEventListener("blur",done,{once:true})});
  const overlay=$("#focusOverlay");$("#closeOverlay").addEventListener("click",()=>overlay.classList.remove("open"));const startOriginal=startTimer;startTimer=function(){startOriginal();if(running){$("#overlayTimer").append(document.querySelector(".timer-card"));$("#overlayTasks").innerHTML=$("#nextTask").innerHTML;overlay.classList.add("open")}};
  const renderOriginal=renderTimer;renderTimer=function(){renderOriginal();if(overlay.classList.contains("open")){const card=document.querySelector(".timer-card");if(card&&!overlay.contains(card))$("#overlayTimer").append(card);$("#overlayTasks").innerHTML=$("#nextTask").innerHTML}const pct=data.mode==="focus"?Math.max(0,Math.min(1,1-remaining/(data.durations.focus*60||1))):0;$("#iceArt").style.clipPath=`inset(${(focusMelted?100:pct*100)}% 0 0 0)`;$("#meltedIceArt").classList.toggle("visible",focusMelted)};
  renderTimer();renderStats();renderRituals();
})();