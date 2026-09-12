(function () {
    'use strict';

    /* =========================================================
       ONESOL - GHL TASK CENTER v4.3.0
       Fixed bottom-right notification bell (no dragging)

       Loader example:
       <script
           src="https://tasks.onesol.ae/task.js?v=4.3.0"
           data-userid="GHL_USER_ID"
           data-username="Bushra">
       </script>

       SECURITY: Never commit a real Private Integration Token here.
       Use a protected server-side proxy for production deployments.
       ========================================================= */

    const SCRIPT = document.currentScript;
    const PASSED_USER_ID = SCRIPT?.getAttribute('data-userid')?.trim() || '';
    const PASSED_USER_NAME = SCRIPT?.getAttribute('data-username')?.trim() || '';
    const PASSED_LOCATION_ID = SCRIPT?.getAttribute('data-locationid')?.trim() || '';

    const CONFIG = {
        PRIVATE_TOKEN: 'PASTE_YOUR_PRIVATE_INTEGRATION_TOKEN_HERE',
        API_BASE: 'https://services.leadconnectorhq.com',
        API_VERSION: 'v3',
        USER_ID: PASSED_USER_ID,
        USER_NAME: PASSED_USER_NAME,
        LOCATION_ID: PASSED_LOCATION_ID,
        PAGE_SIZE: 25,
        MAX_PAGES: 40,
        CONTACT_CONCURRENCY: 5,
        REFRESH_INTERVAL: 60 * 1000,
        BELL_RIGHT: 24,
        BELL_BOTTOM: 24,
        PANEL_WIDTH: 430,
        PANEL_MAX_HEIGHT: 650,
        SWEETALERT_JS: 'https://cdn.jsdelivr.net/npm/sweetalert2@11',
        SWEETALERT_CSS: 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
        DEBUG: true
    };

    const STATE = {
        userId: null,
        userName: null,
        locationId: null,
        tasks: [],
        contactCache: new Map(),
        loading: false,
        initialized: false,
        refreshTimer: null,
        currentView: 'list',
        calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        selectedDate: null
    };

    const IDS = {
        ROOT: 'onesol-task-center',
        STYLE: 'onesol-task-center-style',
        TOAST: 'onesol-task-center-toast',
        SWAL_STYLE: 'onesol-task-swal-style',
        SWAL_SCRIPT: 'onesol-swal-js',
        SWAL_CSS: 'onesol-swal-css'
    };

    function log(...args) { if (CONFIG.DEBUG) console.log('[OneSol Task Center]', ...args); }
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function stripHtml(value) {
        if (!value) return '';
        try { const el = document.createElement('div'); el.innerHTML = String(value); return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim(); }
        catch { return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
    }
    function firstName(name) { return String(name || 'there').trim().split(/\s+/)[0] || 'there'; }
    function parseDate(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
    function dateKey(value) { const date = parseDate(value); if (!date) return null; return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-'); }
    function dateFromKey(key) { if (!key) return null; const [year, month, day] = key.split('-').map(Number); if (!year || !month || !day) return null; return new Date(year, month-1, day); }
    function todayKey() { return dateKey(new Date()); }
    function formatTime(value) { const date = parseDate(value); if (!date) return ''; return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date); }
    function formatFullDate(value) { const date = parseDate(value); if (!date) return ''; return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date); }
    function formatCalendarMonth(value) { return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(value); }
    function formatCalendarDate(key) { const date=dateFromKey(key); if(!date)return ''; return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(date); }

    function storagePrefix() { return `onesol-task-center:${STATE.locationId || CONFIG.LOCATION_ID || 'location'}:${STATE.userId || CONFIG.USER_ID || 'user'}`; }
    function viewStorageKey() { return `${storagePrefix()}:view`; }
    function saveViewPreference() { try { localStorage.setItem(viewStorageKey(), STATE.currentView); } catch (_) {} }
    function restoreViewPreference() { try { const value=localStorage.getItem(viewStorageKey()); if(value==='list'||value==='calendar') STATE.currentView=value; } catch (_) {} }

    function setFixedPosition() {
        const root=document.getElementById(IDS.ROOT); if(!root)return;
        root.style.left='auto'; root.style.top='auto'; root.style.right=`${CONFIG.BELL_RIGHT}px`; root.style.bottom=`${CONFIG.BELL_BOTTOM}px`;
    }

    async function waitForAppUtils(timeout=12000) { const start=Date.now(); while(Date.now()-start<timeout){ if(window.AppUtils?.Utilities)return true; await sleep(200); } return false; }
    function locationFromUrl() { return window.location.pathname.match(/\/location\/([^/]+)/)?.[1] || ''; }
    async function resolveUser() {
        if(CONFIG.USER_ID){ STATE.userId=CONFIG.USER_ID; STATE.userName=CONFIG.USER_NAME||'there'; try{const current=await window.AppUtils?.Utilities?.getCurrentUser?.(); if(current?.id===STATE.userId) STATE.userName=CONFIG.USER_NAME||current.firstName||current.name||current.email||'there';}catch(_){} return; }
        const ready=await waitForAppUtils(); if(!ready||typeof AppUtils.Utilities.getCurrentUser!=='function')throw new Error('Unable to determine current HighLevel user.');
        const user=await AppUtils.Utilities.getCurrentUser(); if(!user?.id)throw new Error('HighLevel User ID was not found.'); STATE.userId=user.id; STATE.userName=user.firstName||user.name||user.email||'there';
    }
    async function resolveLocation() {
        if(CONFIG.LOCATION_ID){STATE.locationId=CONFIG.LOCATION_ID;return;}
        try{const location=await window.AppUtils?.Utilities?.getCurrentLocation?.();if(location?.id){STATE.locationId=location.id;return;}}catch(_){}
        const locationId=locationFromUrl(); if(locationId){STATE.locationId=locationId;return;} throw new Error('Unable to determine HighLevel Location ID.');
    }
    async function resolveContext(){await resolveUser();await resolveLocation();log('Context',{userId:STATE.userId,userName:STATE.userName,locationId:STATE.locationId});}

    function validateToken(){if(!CONFIG.PRIVATE_TOKEN||CONFIG.PRIVATE_TOKEN.includes('PASTE_YOUR_'))throw new Error('Private Integration Token is not configured.');}
    async function ghlFetch(endpoint,options={}){
        validateToken();
        const response=await fetch(`${CONFIG.API_BASE}${endpoint}`,{...options,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${CONFIG.PRIVATE_TOKEN.trim()}`,Version:CONFIG.API_VERSION,...(options.headers||{})}});
        if(!response.ok){let message=`HighLevel API Error ${response.status}`;try{const body=await response.json();message=body?.message||body?.error||message;}catch(_){}throw new Error(message);}
        if(response.status===204)return{};try{return await response.json();}catch{return{};}
    }
    async function searchTasks(skip=0){return ghlFetch(`/locations/${encodeURIComponent(STATE.locationId)}/tasks/search`,{method:'POST',body:JSON.stringify({assignedTo:[STATE.userId],completed:false,limit:CONFIG.PAGE_SIZE,skip})});}
    function extractTasks(response){if(Array.isArray(response?.tasks))return response.tasks;if(Array.isArray(response?.data?.tasks))return response.data.tasks;if(Array.isArray(response?.data))return response.data;return[];}
    async function fetchAllTasks(){const result=[];const seen=new Set();for(let page=0;page<CONFIG.MAX_PAGES;page++){const response=await searchTasks(page*CONFIG.PAGE_SIZE);const batch=extractTasks(response);for(const task of batch){const key=getTaskId(task)||[task?.title,task?.dueDate,task?.contactId].join('|');if(seen.has(key))continue;seen.add(key);result.push(task);}if(batch.length<CONFIG.PAGE_SIZE)break;}return result;}

    async function fetchContact(contactId){if(!contactId)return null;if(STATE.contactCache.has(contactId))return STATE.contactCache.get(contactId);try{const response=await ghlFetch(`/contacts/${encodeURIComponent(contactId)}`,{method:'GET'});const contact=response?.contact||response||null;STATE.contactCache.set(contactId,contact);return contact;}catch(error){log('Unable to load contact',contactId,error.message);STATE.contactCache.set(contactId,null);return null;}}
    function contactObjectName(contact){if(!contact)return'';if(contact.name)return String(contact.name).trim();return [contact.firstName,contact.lastName].filter(Boolean).join(' ').trim();}
    function getTaskContactId(task){return task?.contactId||task?.contact?.id||'';}
    function getTaskContactName(task){if(task?.contactName)return String(task.contactName).trim();const direct=contactObjectName(task?.contact);if(direct)return direct;const resolved=contactObjectName(task?._resolvedContact);if(resolved)return resolved;const contactId=getTaskContactId(task);if(contactId&&STATE.contactCache.has(contactId))return contactObjectName(STATE.contactCache.get(contactId));return'';}
    function getTaskContactObject(task){if(task?.contact&&typeof task.contact==='object')return task.contact;if(task?._resolvedContact&&typeof task._resolvedContact==='object')return task._resolvedContact;const contactId=getTaskContactId(task);if(contactId&&STATE.contactCache.has(contactId))return STATE.contactCache.get(contactId);return null;}
    function getTaskContactPhone(task){const contact=getTaskContactObject(task);if(!contact)return'';return String(contact.phone||contact.phoneNumber||contact.mobile||contact.mobilePhone||'').trim();}
    function getClientProfilePath(task){const contactId=getTaskContactId(task);if(!STATE.locationId||!contactId)return'';return `/v2/location/${encodeURIComponent(STATE.locationId)}/contacts/detail/${encodeURIComponent(contactId)}`;}
    async function openClientFile(task){const path=getClientProfilePath(task);if(!path){showToast('Client contact file is unavailable.',true);return;}if(window.Swal)Swal.close();try{if(window.AppUtils?.RouteHelper?.navigate){await AppUtils.RouteHelper.navigate({path});return;}}catch(error){log('GHL contact navigation failed',error);}window.location.href=path;}
    async function enrichTaskContacts(tasks){const contactIds=[...new Set(tasks.map(getTaskContactId).filter(Boolean))];if(!contactIds.length)return tasks;let index=0;async function worker(){while(index<contactIds.length){const contactId=contactIds[index++];await fetchContact(contactId);}}await Promise.all(Array.from({length:Math.min(CONFIG.CONTACT_CONCURRENCY,contactIds.length)},()=>worker()));for(const task of tasks){const contactId=getTaskContactId(task);if(contactId&&STATE.contactCache.has(contactId))task._resolvedContact=STATE.contactCache.get(contactId);}return tasks;}

    async function markTaskComplete(task){const taskId=getTaskId(task);const contactId=getTaskContactId(task);if(!taskId)throw new Error('Task ID is missing.');if(!contactId)throw new Error('Contact ID is unavailable for this task.');return ghlFetch(`/contacts/${encodeURIComponent(contactId)}/tasks/${encodeURIComponent(taskId)}/completed`,{method:'PUT',body:JSON.stringify({completed:true})});}
    function getTaskId(task){return task?.id||task?._id||'';}
    function getTaskTitle(task){return stripHtml(task?.title||task?.name||'Untitled task').trim()||'Untitled task';}
    function getTaskDescription(task){return stripHtml(task?.description||task?.body||task?.notes||'').trim();}
    function getTaskDueDate(task){return task?.dueDate||task?.dueAt||task?.dueDateTime||task?.startDate||task?.startAt||null;}
    function getTaskStatus(task){const due=getTaskDueDate(task);if(!due)return'no-date';const dueDate=parseDate(due);if(!dueDate)return'no-date';const today=todayKey();const key=dateKey(dueDate);if(key<today)return'overdue';if(key===today)return'today';return'upcoming';}
    function groupTasks(tasks){const groups={overdue:[],today:[],upcoming:[],noDate:[]};tasks.forEach(task=>{const status=getTaskStatus(task);if(status==='overdue')groups.overdue.push(task);else if(status==='today')groups.today.push(task);else if(status==='upcoming')groups.upcoming.push(task);else groups.noDate.push(task);});return groups;}
    function taskSort(a,b){const da=parseDate(getTaskDueDate(a))?.getTime()??Infinity;const db=parseDate(getTaskDueDate(b))?.getTime()??Infinity;return da-db;}

    function injectStyles(){
        if(document.getElementById(IDS.STYLE))return;
        const style=document.createElement('style');style.id=IDS.STYLE;style.textContent=`
#${IDS.ROOT}{position:fixed;right:${CONFIG.BELL_RIGHT}px;bottom:${CONFIG.BELL_BOTTOM}px;z-index:2147483000;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a}
#${IDS.ROOT} *{box-sizing:border-box}#${IDS.ROOT} button{font:inherit}
#${IDS.ROOT} .ot-bell{width:60px;height:60px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 14px 40px rgba(15,23,42,.18);display:grid;place-items:center;cursor:pointer;position:relative;transition:transform .15s ease,box-shadow .15s ease}
#${IDS.ROOT} .ot-bell:hover{transform:translateY(-2px);box-shadow:0 18px 46px rgba(15,23,42,.22)}
#${IDS.ROOT} .ot-bell svg{width:28px;height:28px;color:#334155}#${IDS.ROOT} .ot-badge{position:absolute;right:-4px;top:-7px;min-width:25px;height:25px;padding:0 7px;border-radius:999px;background:#ef4444;color:#fff;border:3px solid #fff;display:grid;place-items:center;font-size:12px;font-weight:850}.ot-badge.hidden{display:none}.ot-badge.pulse{animation:otPulse 1.8s infinite}@keyframes otPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.3)}50%{box-shadow:0 0 0 7px rgba(239,68,68,0)}}
#${IDS.ROOT} .ot-panel{position:absolute;right:0;bottom:76px;width:min(${CONFIG.PANEL_WIDTH}px,calc(100vw - 32px));max-height:${CONFIG.PANEL_MAX_HEIGHT}px;background:#fff;border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.2);overflow:hidden;display:none}.ot-panel.open{display:flex;flex-direction:column}
#${IDS.ROOT} .ot-header{padding:18px 20px 14px;border-bottom:1px solid #e2e8f0}.ot-head-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ot-title{font-size:20px;font-weight:850}.ot-user-name{color:#2563eb}.ot-remaining{margin-top:5px;color:#64748b;font-size:12px}.ot-head-actions{display:flex;gap:8px}.ot-icon-btn{width:40px;height:40px;border:0;border-radius:13px;background:#f1f5f9;color:#475569;display:grid;place-items:center;cursor:pointer}.ot-icon-btn:hover{background:#e2e8f0}.ot-icon-btn svg{width:19px;height:19px}.ot-refresh.loading svg{animation:otSpin 1s linear infinite}@keyframes otSpin{to{transform:rotate(360deg)}}
#${IDS.ROOT} .ot-attention{margin-top:14px;border:1px solid #fecaca;background:#fff1f2;border-radius:15px;padding:12px 14px;display:none}.ot-attention.show{display:flex;gap:10px;align-items:center}.ot-attention-dot{width:19px;height:19px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 7px #fee2e2;flex:0 0 auto}.ot-attention-title{font-size:13px;font-weight:850;color:#b91c1c}.ot-attention-copy{margin-top:2px;color:#64748b;font-size:11px}
#${IDS.ROOT} .ot-tabs{margin:14px 20px 0;padding:4px;background:#f1f5f9;border-radius:12px;display:grid;grid-template-columns:1fr 1fr}.ot-tab{border:0;background:transparent;border-radius:9px;padding:9px;color:#64748b;font-size:11px;font-weight:800;cursor:pointer}.ot-tab.active{background:#fff;color:#0f172a;box-shadow:0 1px 4px rgba(15,23,42,.1)}
#${IDS.ROOT} .ot-content{overflow:auto;min-height:0;flex:1}#${IDS.ROOT} .ot-section{border-top:1px solid #e2e8f0}.ot-section-title{padding:11px 20px;background:#f8fafc;display:flex;justify-content:space-between;font-size:11px;font-weight:850;letter-spacing:.04em}.ot-section-title.overdue{background:#fff1f2;color:#b91c1c}.ot-section-title.today{background:#fff7ed;color:#b45309}.ot-task{padding:14px 20px;display:flex;gap:10px;border-bottom:1px solid #e2e8f0;cursor:pointer;background:#fff}.ot-task:hover{background:#f8fafc}.ot-task.overdue{background:linear-gradient(90deg,#fff7f7,#fff)}.ot-dot{width:11px;height:11px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 5px #fff7ed;margin-top:5px;flex:0 0 auto}.ot-task.overdue .ot-dot{background:#ef4444;box-shadow:0 0 0 5px #fee2e2}.ot-task-main{min-width:0;flex:1}.ot-task-title{font-size:13px;font-weight:800;overflow-wrap:anywhere}.ot-task-meta{margin-top:5px;color:#64748b;font-size:11px}.ot-task-description{margin-top:5px;color:#64748b;font-size:11px;line-height:1.4}.ot-client{margin-top:7px;display:flex;gap:6px;align-items:flex-start;color:#475569}.ot-client svg{width:13px;height:13px;flex:0 0 auto;margin-top:1px}.ot-client-info{min-width:0}.ot-client-name{color:#334155;font-size:11px;font-weight:750;line-height:1.3;overflow-wrap:anywhere}.ot-client-phone{margin-top:2px;color:#64748b;font-size:10px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}.ot-task.overdue .ot-client-name{color:#991b1b}.ot-complete{width:38px;height:38px;border:1px solid #dbe5f1;border-radius:12px;background:#fff;color:#94a3b8;display:grid;place-items:center;cursor:pointer;flex:0 0 auto}.ot-complete:hover{border-color:#93c5fd;color:#2563eb;background:#eff6ff}.ot-complete svg{width:17px;height:17px}.ot-empty{padding:36px 20px;text-align:center;color:#94a3b8;font-size:12px}.ot-footer{padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px}.ot-footer-user{font-size:10px;color:#94a3b8}.ot-open-tasks{border:0;background:transparent;color:#2563eb;font-size:11px;font-weight:800;cursor:pointer}
#${IDS.ROOT} .ot-calendar{padding-bottom:10px}.ot-calendar-nav{padding:13px 18px;display:flex;align-items:center;justify-content:space-between}.ot-calendar-btn{width:30px;height:30px;border:0;border-radius:9px;background:#f1f5f9;cursor:pointer;font-size:20px;color:#475569}.ot-calendar-title{font-size:12px;font-weight:850}.ot-weekdays,.ot-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);padding:0 10px}.ot-weekday{text-align:center;padding:5px 0;color:#94a3b8;font-size:9px;font-weight:800}.ot-calendar-day{min-height:45px;border:1px solid #f1f5f9;background:#fff;padding:5px;cursor:pointer;position:relative}.ot-calendar-day.other{background:#f8fafc;color:#cbd5e1}.ot-calendar-day.selected{outline:2px solid #93c5fd;outline-offset:-2px}.ot-calendar-day.today{background:#eff6ff}.ot-calendar-num{font-size:10px;font-weight:750}.ot-calendar-count{position:absolute;right:4px;bottom:4px;min-width:16px;height:16px;border-radius:999px;background:#2563eb;color:#fff;font-size:8px;font-weight:850;display:grid;place-items:center}.ot-calendar-selected{margin:12px 18px 0;border-top:1px solid #e2e8f0}.ot-selected-header{padding:12px 0 8px;display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#475569}.ot-calendar-task{display:flex;gap:8px;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer}.ot-calendar-task-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-top:4px;flex:0 0 auto}.ot-calendar-task.overdue .ot-calendar-task-dot{background:#ef4444}.ot-calendar-task-main{min-width:0}.ot-calendar-task-title{font-size:10px;font-weight:800}.ot-calendar-client{margin-top:3px;color:#334155;font-size:10px;font-weight:700}.ot-calendar-phone{margin-top:2px;color:#64748b;font-size:9.5px;font-weight:600}.ot-calendar-task-time{margin-top:3px;color:#64748b;font-size:9.5px}
#${IDS.TOAST}{position:fixed;right:24px;bottom:96px;z-index:2147483647;background:#0f172a;color:#fff;padding:10px 14px;border-radius:10px;font-size:11px;box-shadow:0 10px 30px rgba(15,23,42,.2);opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none}.ot-toast-show{opacity:1!important;transform:translateY(0)!important}
@media(max-width:520px){#${IDS.ROOT}{right:16px;bottom:16px}#${IDS.ROOT} .ot-panel{bottom:72px;width:calc(100vw - 32px);max-height:70vh}.ot-footer{padding:11px 16px}.ot-header{padding:16px}.ot-tabs{margin-left:16px;margin-right:16px}.ot-task{padding-left:16px;padding-right:16px}}
        `;document.head.appendChild(style);
    }

    function createWidget(){
        if(document.getElementById(IDS.ROOT))return;
        const root=document.createElement('div');root.id=IDS.ROOT;
        root.innerHTML=`
            <div class="ot-panel" aria-label="Task Center">
                <div class="ot-header">
                    <div class="ot-head-row">
                        <div><div class="ot-title">👋 Hi <span class="ot-user-name">there</span></div><div class="ot-remaining">Loading tasks...</div></div>
                        <div class="ot-head-actions">
                            <button type="button" class="ot-icon-btn ot-refresh" title="Refresh tasks"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10"></path><path d="M3 4v6h6"></path><path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14"></path><path d="M21 20v-6h-6"></path></svg></button>
                            <button type="button" class="ot-icon-btn ot-close" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
                        </div>
                    </div>
                    <div class="ot-attention"><span class="ot-attention-dot"></span><div><div class="ot-attention-title">Attention required</div><div class="ot-attention-copy"></div></div></div>
                </div>
                <div class="ot-tabs"><button type="button" class="ot-tab active" data-view="list">☷ List</button><button type="button" class="ot-tab" data-view="calendar">▦ Calendar</button></div>
                <div class="ot-content"></div>
                <div class="ot-footer"><span class="ot-footer-user">My tasks</span><button type="button" class="ot-open-tasks">View all tasks →</button></div>
            </div>
            <button type="button" class="ot-bell" aria-label="Open tasks">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>
                <span class="ot-badge hidden">0</span>
            </button>`;
        document.body.appendChild(root);bindEvents();setFixedPosition();
    }

    function showToast(message,error=false){let toast=document.getElementById(IDS.TOAST);if(!toast){toast=document.createElement('div');toast.id=IDS.TOAST;document.body.appendChild(toast);}toast.textContent=message;toast.style.background=error?'#991b1b':'#0f172a';toast.classList.add('ot-toast-show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('ot-toast-show'),2200);}
    function positionPanel(){const root=document.getElementById(IDS.ROOT);if(!root)return;root.style.right=`${CONFIG.BELL_RIGHT}px`;root.style.bottom=`${CONFIG.BELL_BOTTOM}px`;root.style.left='auto';root.style.top='auto';}

    function bindEvents(){
        const root=document.getElementById(IDS.ROOT);if(!root)return;const bell=root.querySelector('.ot-bell'),panel=root.querySelector('.ot-panel');
        bell.addEventListener('click',event=>{event.stopPropagation();const open=!panel.classList.contains('open');if(open)positionPanel();panel.classList.toggle('open',open);});
        root.querySelector('.ot-close').addEventListener('click',()=>panel.classList.remove('open'));
        root.querySelector('.ot-refresh').addEventListener('click',()=>refreshTasks(true));
        root.querySelector('.ot-open-tasks').addEventListener('click',openTasksPage);
        root.querySelectorAll('.ot-tab').forEach(button=>button.addEventListener('click',()=>{STATE.currentView=button.dataset.view;saveViewPreference();render();}));
        root.querySelector('.ot-content').addEventListener('click',async event=>{
            const complete=event.target.closest('[data-task-complete]');if(complete){event.stopPropagation();const task=STATE.tasks.find(item=>getTaskId(item)===complete.dataset.taskComplete);if(task)await completeTask(task,false);return;}
            const open=event.target.closest('[data-task-open]');if(open){const task=STATE.tasks.find(item=>getTaskId(item)===open.dataset.taskOpen);if(task)await openTaskDetails(task);return;}
            const day=event.target.closest('[data-calendar-date]');if(day){STATE.selectedDate=day.dataset.calendarDate;render();}
            const prev=event.target.closest('.ot-calendar-prev');if(prev){STATE.calendarMonth=new Date(STATE.calendarMonth.getFullYear(),STATE.calendarMonth.getMonth()-1,1);render();}
            const next=event.target.closest('.ot-calendar-next');if(next){STATE.calendarMonth=new Date(STATE.calendarMonth.getFullYear(),STATE.calendarMonth.getMonth()+1,1);render();}
        });
    }

    function renderClientName(task){const contact=getTaskContactName(task),phone=getTaskContactPhone(task);if(!contact&&!phone)return'';return `<div class="ot-client"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg><div class="ot-client-info">${contact?`<div class="ot-client-name">${escapeHtml(contact)}</div>`:''}${phone?`<div class="ot-client-phone">☎ ${escapeHtml(phone)}</div>`:''}</div></div>`;}
    function renderTaskRow(task){const status=getTaskStatus(task),due=getTaskDueDate(task),description=getTaskDescription(task);return `<div class="ot-task ${status}" data-task-open="${escapeHtml(getTaskId(task))}"><span class="ot-dot"></span><div class="ot-task-main"><div class="ot-task-title">${escapeHtml(getTaskTitle(task))}</div>${renderClientName(task)}${due?`<div class="ot-task-meta">${escapeHtml(formatFullDate(due))}</div>`:''}${description?`<div class="ot-task-description">${escapeHtml(description)}</div>`:''}</div><button type="button" class="ot-complete" data-task-complete="${escapeHtml(getTaskId(task))}" title="Mark complete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l4 4L19 6"></path></svg></button></div>`;}
    function renderSection(title,tasks,kind){if(!tasks.length)return'';return `<section class="ot-section"><div class="ot-section-title ${kind||''}"><span>${escapeHtml(title)}</span><span>${tasks.length}</span></div>${tasks.sort(taskSort).map(renderTaskRow).join('')}</section>`;}
    function renderListView(){const groups=groupTasks(STATE.tasks);if(!STATE.tasks.length)return '<div class="ot-empty">🎉 You have no remaining tasks.</div>';return renderSection('OVERDUE',groups.overdue,'overdue')+renderSection('TODAY · NEEDS ACTION',groups.today,'today')+renderSection('UPCOMING',groups.upcoming,'')+renderSection('NO DUE DATE',groups.noDate,'');}

    function taskCountMap(){const map={};STATE.tasks.forEach(task=>{const key=dateKey(getTaskDueDate(task));if(key)map[key]=(map[key]||0)+1;});return map;}
    function tasksForDate(key){return STATE.tasks.filter(task=>dateKey(getTaskDueDate(task))===key).sort(taskSort);}
    function renderCalendarDay(date,month,counts){const key=dateKey(date),other=date.getMonth()!==month.getMonth(),today=key===todayKey(),selected=key===STATE.selectedDate,count=counts[key]||0;return `<button type="button" class="ot-calendar-day ${other?'other':''} ${today?'today':''} ${selected?'selected':''}" data-calendar-date="${key}"><span class="ot-calendar-num">${date.getDate()}</span>${count?`<span class="ot-calendar-count">${count>99?'99+':count}</span>`:''}</button>`;}
    function renderSelectedCalendarTasks(){if(!STATE.selectedDate)return'';const tasks=tasksForDate(STATE.selectedDate);const rows=tasks.length?tasks.map(task=>{const status=getTaskStatus(task),contact=getTaskContactName(task),phone=getTaskContactPhone(task);return `<div class="ot-calendar-task ${status}" data-task-open="${escapeHtml(getTaskId(task))}"><span class="ot-calendar-task-dot"></span><div class="ot-calendar-task-main"><div class="ot-calendar-task-title">${escapeHtml(getTaskTitle(task))}</div>${contact?`<div class="ot-calendar-client">👤 ${escapeHtml(contact)}</div>`:''}${phone?`<div class="ot-calendar-phone">☎ ${escapeHtml(phone)}</div>`:''}<div class="ot-calendar-task-time">${escapeHtml(formatTime(getTaskDueDate(task)))}</div></div></div>`;}).join(''):'<div style="padding:16px 5px 20px;color:#94a3b8;font-size:11px;">No tasks scheduled for this date.</div>';return `<div class="ot-calendar-selected"><div class="ot-selected-header"><span>${escapeHtml(formatCalendarDate(STATE.selectedDate))}</span><span>${tasks.length} ${tasks.length===1?'task':'tasks'}</span></div>${rows}</div>`;}
    function renderCalendarView(){const month=STATE.calendarMonth,firstDay=new Date(month.getFullYear(),month.getMonth(),1),start=new Date(month.getFullYear(),month.getMonth(),1-firstDay.getDay()),counts=taskCountMap(),days=[];for(let i=0;i<42;i++)days.push(renderCalendarDay(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),month,counts));return `<div class="ot-calendar"><div class="ot-calendar-nav"><button type="button" class="ot-calendar-btn ot-calendar-prev">‹</button><div class="ot-calendar-title">${escapeHtml(formatCalendarMonth(month))}</div><button type="button" class="ot-calendar-btn ot-calendar-next">›</button></div><div class="ot-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<div class="ot-weekday">${day}</div>`).join('')}</div><div class="ot-calendar-grid">${days.join('')}</div>${renderSelectedCalendarTasks()}</div>`;}

    function render(){const root=document.getElementById(IDS.ROOT);if(!root)return;const groups=groupTasks(STATE.tasks),total=STATE.tasks.length,overdue=groups.overdue.length,today=groups.today.length;root.querySelector('.ot-user-name').textContent=firstName(STATE.userName);root.querySelector('.ot-footer-user').textContent=STATE.userName?`${STATE.userName}'s tasks`:'My Tasks';root.querySelector('.ot-remaining').innerHTML=total?`You have <strong>${total}</strong> ${total===1?'task':'tasks'} remaining.`:'You have no remaining tasks.';const badge=root.querySelector('.ot-badge');badge.textContent=today>99?'99+':String(today);badge.classList.toggle('hidden',today===0);badge.classList.toggle('pulse',today>0);const attention=root.querySelector('.ot-attention'),title=root.querySelector('.ot-attention-title'),copy=root.querySelector('.ot-attention-copy');if(overdue||today){attention.classList.add('show');if(overdue){title.textContent='⚠ Attention required';copy.textContent=`${overdue} overdue${today?` • ${today} due today`:''}`;}else{title.textContent='Today needs your attention';copy.textContent=`${today} ${today===1?'task is':'tasks are'} due today.`;}}else attention.classList.remove('show');root.querySelectorAll('.ot-tab').forEach(button=>button.classList.toggle('active',button.dataset.view===STATE.currentView));root.querySelector('.ot-content').innerHTML=STATE.currentView==='calendar'?renderCalendarView():renderListView();if(root.querySelector('.ot-panel').classList.contains('open'))positionPanel();}

    async function ensureSweetAlert(){if(window.Swal)return window.Swal;if(!document.getElementById(IDS.SWAL_CSS)){const link=document.createElement('link');link.id=IDS.SWAL_CSS;link.rel='stylesheet';link.href=CONFIG.SWEETALERT_CSS;document.head.appendChild(link);}if(document.getElementById(IDS.SWAL_SCRIPT))return new Promise((resolve,reject)=>{const existing=document.getElementById(IDS.SWAL_SCRIPT);existing.addEventListener('load',()=>resolve(window.Swal));existing.addEventListener('error',()=>reject(new Error('Unable to load SweetAlert.')));});return new Promise((resolve,reject)=>{const script=document.createElement('script');script.id=IDS.SWAL_SCRIPT;script.src=CONFIG.SWEETALERT_JS;script.onload=()=>resolve(window.Swal);script.onerror=()=>reject(new Error('Unable to load SweetAlert.'));document.head.appendChild(script);});}
    function injectSweetAlertStyles(){if(document.getElementById(IDS.SWAL_STYLE))return;const style=document.createElement('style');style.id=IDS.SWAL_STYLE;style.textContent=`.onesol-task-swal-container{z-index:2147483646!important}.onesol-task-modal{border-radius:20px!important;padding:0!important}.onesol-task-modal .swal2-title{padding:22px 24px 8px!important;font-size:20px!important;font-weight:850!important;text-align:left!important}.onesol-task-modal .swal2-html-container{margin:0!important;padding:8px 24px 18px!important;text-align:left!important}.onesol-task-modal .swal2-actions{padding:10px 24px 20px!important}.ot-modal-status{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:800}.ot-modal-status.overdue{background:#fee2e2;color:#b91c1c}.ot-modal-status.today{background:#ffedd5;color:#b45309}.ot-modal-status.upcoming,.ot-modal-status.no-date{background:#e0f2fe;color:#0369a1}.ot-modal-client{margin-top:14px;padding:12px;border:1px solid #dbeafe;background:#eff6ff;border-radius:13px;display:flex;align-items:center;gap:10px}.ot-modal-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#dbeafe;flex:0 0 auto}.ot-modal-client-label{color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase}.ot-modal-client-content{min-width:0;flex:1 1 auto}.ot-modal-client-name{margin-top:3px;color:#1e3a8a;font-size:13px;font-weight:800;overflow-wrap:anywhere}.ot-modal-client-phone{margin-top:4px;color:#475569;font-size:11px;font-weight:650;overflow-wrap:anywhere}.ot-modal-open-client{flex:0 0 auto;padding:8px 11px;border:1px solid #bfdbfe;border-radius:9px;background:#fff;color:#2563eb;cursor:pointer;font-size:10px;font-weight:750;white-space:nowrap}.ot-modal-open-client:hover{border-color:#93c5fd;background:#dbeafe}.ot-modal-grid{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.ot-modal-box{padding:11px;border:1px solid #e2e8f0;border-radius:12px}.ot-modal-label{color:#94a3b8;font-size:9px;font-weight:800;text-transform:uppercase}.ot-modal-value{margin-top:4px;color:#334155;font-size:11px;font-weight:700}.ot-modal-notes{margin-top:12px;padding:11px;border-radius:12px;background:#f8fafc}.ot-modal-notes-text{margin-top:5px;color:#475569;font-size:11px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:520px){.ot-modal-client{align-items:flex-start;flex-wrap:wrap}.ot-modal-open-client{width:100%;margin-top:5px}.ot-modal-grid{grid-template-columns:1fr}.onesol-task-modal .swal2-title{padding:18px 18px 6px!important}.onesol-task-modal .swal2-html-container{padding:8px 18px 14px!important}}`;document.head.appendChild(style);}

    async function openTaskDetails(task){try{await ensureSweetAlert();}catch(error){showToast(error.message,true);return;}const status=getTaskStatus(task),contact=getTaskContactName(task),phone=getTaskContactPhone(task),contactId=getTaskContactId(task),description=getTaskDescription(task),due=getTaskDueDate(task),statusLabels={overdue:'⚠ Overdue',today:'● Due Today',upcoming:'● Upcoming','no-date':'No Due Date'};const html=`<div><div class="ot-modal-status ${status}">${escapeHtml(statusLabels[status])}</div>${contact||phone?`<div class="ot-modal-client"><div class="ot-modal-avatar">👤</div><div class="ot-modal-client-content"><div class="ot-modal-client-label">Client</div>${contact?`<div class="ot-modal-client-name">${escapeHtml(contact)}</div>`:''}${phone?`<div class="ot-modal-client-phone">☎ ${escapeHtml(phone)}</div>`:''}</div>${contactId?`<button type="button" class="ot-modal-open-client" data-open-client="1">Open Client File →</button>`:''}</div>`:''}<div class="ot-modal-grid"><div class="ot-modal-box"><div class="ot-modal-label">Due</div><div class="ot-modal-value">${due?escapeHtml(formatFullDate(due)):'No due date'}</div></div><div class="ot-modal-box"><div class="ot-modal-label">Status</div><div class="ot-modal-value">${escapeHtml(statusLabels[status])}</div></div></div>${description?`<div class="ot-modal-notes"><div class="ot-modal-label">Notes</div><div class="ot-modal-notes-text">${escapeHtml(description)}</div></div>`:''}</div>`;const result=await Swal.fire({title:getTaskTitle(task),html,width:540,target:document.body,backdrop:true,heightAuto:false,customClass:{container:'onesol-task-swal-container',popup:'onesol-task-modal'},showCancelButton:true,showConfirmButton:Boolean(contactId),confirmButtonText:'✓ Mark Complete',cancelButtonText:'Close',reverseButtons:true,allowOutsideClick:false,allowEscapeKey:true,focusConfirm:false,didOpen:popup=>{const button=popup.querySelector('[data-open-client]');if(button)button.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();await openClientFile(task);});}});if(result.isConfirmed)await completeTask(task,true);}
    async function completeTask(task,modal=false){const taskId=getTaskId(task);try{if(modal&&window.Swal)Swal.fire({title:'Completing task...',text:getTaskTitle(task),allowOutsideClick:false,allowEscapeKey:false,showConfirmButton:false,didOpen(){Swal.showLoading();}});await markTaskComplete(task);STATE.tasks=STATE.tasks.filter(item=>getTaskId(item)!==taskId);render();if(modal&&window.Swal)await Swal.fire({icon:'success',title:'Task completed',text:getTaskTitle(task),timer:1300,showConfirmButton:false,customClass:{container:'onesol-task-swal-container'}});else showToast('✓ Task completed');}catch(error){if(modal&&window.Swal)await Swal.fire({icon:'error',title:'Unable to complete task',text:error.message,confirmButtonText:'Close',customClass:{container:'onesol-task-swal-container'}});else showToast(error.message,true);}}

    async function refreshTasks(force=false){if(STATE.loading&&!force)return;setLoading(true);try{if(!CONFIG.LOCATION_ID){STATE.locationId=null;await resolveLocation();}let tasks=await fetchAllTasks();tasks=await enrichTaskContacts(tasks);STATE.tasks=tasks;if(!STATE.selectedDate)STATE.selectedDate=todayKey();render();log('Tasks loaded',tasks.length);}catch(error){renderError(error);}finally{setLoading(false);}}
    function setLoading(value){STATE.loading=value;document.querySelector(`#${IDS.ROOT} .ot-refresh`)?.classList.toggle('loading',value);}
    function renderError(error){console.error('[OneSol Task Center]',error);const root=document.getElementById(IDS.ROOT);if(!root)return;root.querySelector('.ot-badge')?.classList.add('hidden');root.querySelector('.ot-remaining').textContent='Unable to load tasks.';root.querySelector('.ot-content').innerHTML=`<div class="ot-empty"><strong>Unable to load tasks</strong><br><br>${escapeHtml(error?.message||String(error))}</div>`;}
    async function openTasksPage(){if(!STATE.locationId)return;const path=`/v2/location/${STATE.locationId}/tasks`;try{if(window.AppUtils?.RouteHelper?.navigate){await AppUtils.RouteHelper.navigate({path});return;}}catch(_){}window.location.href=path;}
    async function handleRouteChange(){await sleep(350);createWidget();setFixedPosition();if(!CONFIG.LOCATION_ID){try{STATE.locationId=null;await resolveLocation();}catch(_) {}}await refreshTasks();}
    function startAutoRefresh(){if(STATE.refreshTimer)clearInterval(STATE.refreshTimer);STATE.refreshTimer=setInterval(()=>{if(document.visibilityState==='visible')refreshTasks();},CONFIG.REFRESH_INTERVAL);}
    async function init(){if(STATE.initialized)return;STATE.initialized=true;injectStyles();injectSweetAlertStyles();createWidget();setFixedPosition();try{await resolveContext();restoreViewPreference();STATE.calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);STATE.selectedDate=todayKey();await refreshTasks(true);startAutoRefresh();window.addEventListener('routeLoaded',handleRouteChange);window.addEventListener('routeChangeEvent',handleRouteChange);window.addEventListener('focus',()=>refreshTasks());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshTasks();});ensureSweetAlert().catch(error=>log('SweetAlert preload failed',error.message));log('Initialized');}catch(error){renderError(error);}}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
