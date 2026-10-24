(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const STORE = "pomodoro-garden-v1";
  const defaults = {tasks:[],sessions:[],customRituals:[],mode:"focus",durations:{focus:25,short:5,long:15},alarm:true,phoneReminder:true};
  let data;
  try { data = {...defaults,...JSON.parse(localStorage.getItem(STORE) || "{}")}; } catch { data = {...defaults}; }
  data.tasks ||= []; data.sessions ||= []; data.customRituals ||= []; data.calendarEvents ||= []; data.durations = {...defaults.durations,...data.durations};
  let remaining = data.durations[data.mode] * 60, running = false, endAt = null, ticker = null, audioCtx = null, focusMelted = false;
  let lastTickSecond = null;
  let calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let selectedCalendarDate = dateKey(new Date());
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
      {image:"https://png.pngtree.com/png-vector/20220727/ourmid/pngtree-vector-icon-of-water-droplet-outline-against-a-white-backdrop-vector-png-image_47747826.jpg", emoji:"💧", title:"Drink water", description:"Rehydrate and refresh"},
      {image:"https://yt3.googleusercontent.com/ytc/AIdro_n2T_SjX1pFvU0RzVgr1-cFVbAE2N4QX-cwt3PzrnOSqA=s900-c-k-c0x00ffffff-no-rj", emoji:"🌳", title:"Step outside", description:"Get some fresh air"},
      {image:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRjh5uOSqFx_NEzkvYFGVBldGSDs-Cz9hf9bt4FeZ1V4dViv7O4Sr3FK-mV&s=10", emoji:"🧘", title:"Stretch for 2 min", description:"Move your body"},
      {image:"https://media.discordapp.net/attachments/895104058795388948/1563358094841356469/Screenshot_2026-10-23_210641.png?ex=6add562f&is=6adc04af&hm=ee29489f91b224f0c8ed4196ab65b633ea68a719e5d2ad36f2fa1ebbe0fb6d65&=&format=webp&quality=lossless", emoji:"🚶", title:"Take a 10-minute walk", description:"Let your mind reset"}
    ];
    const target=$("#breakRituals");
    target.innerHTML=rituals.map(({image,emoji,title,description})=>{
      const imageMarkup = image ? `<img class="ritual-image" src="${image}" alt="${escapeHtml(title)}">` : `<span class="emoji">${emoji}</span>`;
      return `<p class="ritual">${imageMarkup}<span><strong>${title}</strong><small>${description}</small></span></p>`;
    }).join("")+data.customRituals.map((ritual,index)=>`<div class="ritual"><span class="emoji">🧊</span><span><strong>${escapeHtml(ritual)}</strong><small>Your break ritual</small></span><button class="ritual-delete" type="button" data-delete-ritual="${index}" aria-label="Remove ${escapeHtml(ritual)}">×</button></div>`).join("");
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
      content.innerHTML='<section class="card calendar-card"><div class="calendar-toolbar"><button id="calendarPrev" class="secondary" type="button" aria-label="Previous month">‹</button><h2 id="calendarMonthLabel" class="calendar-month-label"></h2><button id="calendarNext" class="secondary" type="button" aria-label="Next month">›</button></div><div class="calendar-weekdays" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div id="calendarGrid" class="calendar-grid" role="group" aria-label="Choose a date"></div></section><section class="card calendar-day-card"><h2 id="selectedDateLabel"></h2><div id="calendarDayEvents"></div><form id="calendarEventForm" class="task-form"><input id="calendarEventInput" maxlength="120" placeholder="Add a note or plan for this day" aria-label="Calendar note" required><button type="submit">Add</button></form></section>';
      renderCalendar();
      $("#calendarPrev").addEventListener("click",()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar();});
      $("#calendarNext").addEventListener("click",()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar();});
      $("#calendarEventForm").addEventListener("submit",e=>{
        e.preventDefault();
        const input=$("#calendarEventInput"),title=input.value.trim();
        if(!title)return;
        data.calendarEvents.push({date:selectedCalendarDate,title});
        save();
        input.value="";
        renderCalendar();
      });
    } else if(view==="settings"){
      content.innerHTML=`<p>Choose your session lengths. Changes apply to the next timer session.</p><div class="task-row"><label class="task-text" for="focusMins">Focus minutes</label><input id="focusMins" type="number" min="1" max="120" value="${data.durations.focus}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><div class="task-row"><label class="task-text" for="shortMins">Short break minutes</label><input id="shortMins" type="number" min="1" max="60" value="${data.durations.short}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><div class="task-row"><label class="task-text" for="longMins">Long break minutes</label><input id="longMins" type="number" min="1" max="90" value="${data.durations.long}" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:9px"></div><button id="saveSettings" class="primary">Save timer settings</button><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><button id="clearData" class="secondary">Clear all local data</button><p class="small-muted">This removes tasks and history saved in this browser only.</p>`;
      $("#saveSettings").addEventListener("click",()=>{for(const [id,key,max] of [["focusMins","focus",120],["shortMins","short",60],["longMins","long",90]]){const n=Number($("#"+id).value);if(!Number.isInteger(n)||n<1||n>max){alert(`Enter a whole number from 1 to ${max}.`);return;}data.durations[key]=n;}setMode(data.mode);alert("Settings saved.");});
      $("#clearData").addEventListener("click",()=>{if(confirm("Delete all tasks, calendar notes, and session history from this browser?")){data={...defaults,tasks:[],sessions:[],calendarEvents:[],durations:{...defaults.durations}};localStorage.removeItem(STORE);pauseTimer();setMode("focus");renderStats();showView("settings");}});
    }
  }
  function download(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function dateKey(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function renderCalendar(){
    const monthLabel=$("#calendarMonthLabel");
    if(!monthLabel)return;
    monthLabel.textContent=calendarMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const offset=(first.getDay()+6)%7;
    const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
    const cellCount=Math.ceil((offset+daysInMonth)/7)*7;
    const today=dateKey(new Date());
    const cells=Array.from({length:cellCount},(_,index)=>{
      const date=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),index-offset+1);
      const key=dateKey(date),events=data.calendarEvents.filter(event=>event.date===key);
      const classes=["calendar-day"];
      if(date.getMonth()!==calendarMonth.getMonth())classes.push("outside-month");
      if(key===selectedCalendarDate)classes.push("selected");
      if(key===today)classes.push("today");
      const eventTitles=events.map(event=>event.title);
      const accessibleLabel=[date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}),...eventTitles].join(": ");
      const eventMarkup=events.map(event=>`<small class="calendar-entry" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</small>`).join("");
      return `<button class="${classes.join(" ")}" type="button" data-calendar-date="${key}" aria-label="${escapeHtml(accessibleLabel)}" aria-pressed="${key===selectedCalendarDate}"><span>${date.getDate()}</span>${eventMarkup?`<span class="calendar-entries">${eventMarkup}</span>`:""}</button>`;
    });
    $("#calendarGrid").innerHTML=cells.join("");
    $$("[data-calendar-date]").forEach(button=>button.addEventListener("click",()=>{
      selectedCalendarDate=button.dataset.calendarDate;
      const picked=new Date(`${selectedCalendarDate}T12:00:00`);
      calendarMonth=new Date(picked.getFullYear(),picked.getMonth(),1);
      renderCalendar();
    }));
    $("#selectedDateLabel").textContent=new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    const selectedEvents=data.calendarEvents.map((event,index)=>({...event,index})).filter(event=>event.date===selectedCalendarDate);
    $("#calendarDayEvents").innerHTML=selectedEvents.length?selectedEvents.map(event=>`<div class="calendar-event"><span>${escapeHtml(event.title)}</span><button class="secondary" type="button" data-delete-calendar-event="${event.index}" aria-label="Delete ${escapeHtml(event.title)}">Delete</button></div>`).join(""):'<p class="empty">Nothing planned for this day yet.</p>';
    $$("[data-delete-calendar-event]").forEach(button=>button.addEventListener("click",()=>{
      data.calendarEvents.splice(Number(button.dataset.deleteCalendarEvent),1);
      save();
      renderCalendar();
    }));
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
  $("#todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}).toUpperCase();
  $("#timeDisplay").addEventListener("click",()=>{
    if(running)return;
    const display=$("#timeDisplay"),input=document.createElement("input");
    input.value=display.textContent;
    input.inputMode="numeric";
    input.maxLength=6;
    input.setAttribute("aria-label","Timer duration in seconds or minutes and seconds");
    input.style.cssText="font:inherit;font-size:clamp(40px,5vw,60px);width:190px;text-align:center";
    display.replaceWith(input);
    input.focus();
    input.select();
    let finished=false;
    const finish=apply=>{
      if(finished)return;
      finished=true;
      if(apply){
        const value=input.value.trim();
        let seconds=null;
        if(/^\d{1,3}:\d{1,2}$/.test(value)){
          const [minutes,secs]=value.split(":").map(Number);
          if(secs<60)seconds=minutes*60+secs;
        }else if(/^\d{1,4}$/.test(value)){
          if(value.length<=2)seconds=Number(value);
          else if(value.length===3)seconds=Number(value[0])*60+Number(value.slice(1));
          else seconds=Number(value.slice(0,2))*60+Number(value.slice(2));
        }
        if(seconds!==null){
          seconds=Math.max(1,Math.min(7200,seconds));
          data.durations[data.mode]=Math.ceil(seconds/60);
          remaining=seconds;
          save();
        }
      }
      input.replaceWith(display);
      renderTimer();
    };
    input.addEventListener("keydown",event=>{
      if(event.key==="Enter")finish(true);
      if(event.key==="Escape")finish(false);
    });
    input.addEventListener("blur",()=>finish(true),{once:true});
  });
  const overlay=$("#focusOverlay");$("#closeOverlay").addEventListener("click",()=>overlay.classList.remove("open"));const startOriginal=startTimer;startTimer=function(){startOriginal();if(running){$("#overlayTimer").append(document.querySelector(".timer-card"));$("#overlayTasks").innerHTML=$("#nextTask").innerHTML;overlay.classList.add("open")}};
  const renderOriginal=renderTimer;renderTimer=function(){renderOriginal();if(overlay.classList.contains("open")){const card=document.querySelector(".timer-card");if(card&&!overlay.contains(card))$("#overlayTimer").append(card);$("#overlayTasks").innerHTML=$("#nextTask").innerHTML}const pct=data.mode==="focus"?Math.max(0,Math.min(1,1-remaining/(data.durations.focus*60||1))):0;$("#iceArt").style.clipPath=`inset(${(focusMelted?100:pct*100)}% 0 0 0)`;$("#meltedIceArt").classList.toggle("visible",focusMelted)};
  renderTimer();renderStats();renderRituals();
})();