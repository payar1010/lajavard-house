(function(){'use strict';
/* ====== ابزارهای پایه ====== */
const $=(s,r)=>(r||document).querySelector(s);
function h(tag,props,...kids){const e=document.createElement(tag);
  for(const k in (props||{})){const v=props[k];if(v==null||v===false)continue;
    if(k==='class')e.className=v;else if(k==='html')e.innerHTML=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,'');else e.setAttribute(k,v)}
  kids.flat(Infinity).forEach(c=>{if(c==null||c===false)return;e.append(c.nodeType?c:document.createTextNode(c))});return e}
const BASE=new URL('../',location.href).href;
const toEd=s=>(s||'').replace(/(src|href|poster)="\/(?!\/)/g,'$1="'+BASE);
const fromEd=s=>(s||'').split('="'+BASE).join('="/');
const enc=new TextEncoder(),dec=new TextDecoder();
function u8ToB64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
const strToB64=t=>u8ToB64(enc.encode(t));
const b64ToStr=b=>dec.decode(Uint8Array.from(atob(b.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S={cfg:null,site:null,dirty:false,cur:'',cache:{},media:null,onSave:null,pages:null,col:{}};

function toast(msg,err){const t=h('div',{class:'toast'+(err?' err':'')},msg);document.body.append(t);setTimeout(()=>t.remove(),err?7000:4500)}
function modal(title,body,actions,opts){
  let closed=false;const close=()=>{if(closed)return;closed=true;ov.remove();document.removeEventListener('keydown',kd);if(opts&&opts.onclose)opts.onclose()};
  const kd=e=>{if(e.key==='Escape')close()};
  const ov=h('div',{class:'ov',onmousedown:e=>{if(e.target===ov)close()}},
    h('div',{class:'modal'+(opts&&opts.wide?' wide':'')},
      h('div',{class:'mh'},h('b',{},title),h('button',{class:'x',onclick:close,'aria-label':'بستن'},'✕')),
      h('div',{class:'mb'},body),
      actions&&actions.length?h('div',{class:'mf'},actions.map(a=>h('button',{class:'btn'+(a.primary?' p':''),onclick:async()=>{if(await a.fn()!==false)close()}},a.label))):null));
  document.addEventListener('keydown',kd);document.body.append(ov);return close}
const confirmBox=(msg,yes)=>new Promise(res=>{modal('تأیید',h('p',{},msg),[{label:yes||'تأیید',primary:true,fn:()=>{res(true)}},{label:'انصراف',fn:()=>{}}],{onclose:()=>res(false)})});

/* ====== ارتباط با گیت‌هاب ====== */
async function gh(path,opt){opt=opt||{};
  const r=await fetch('https://api.github.com/repos/'+S.cfg.repo+path,Object.assign({},opt,{headers:Object.assign({Authorization:'Bearer '+S.cfg.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},opt.headers||{})}));
  if(!r.ok){let m='';try{m=(await r.json()).message}catch(e){}const er=new Error(m||('خطا '+r.status));er.status=r.status;throw er}
  return r.status===204?null:r.json()}
const ref=()=>'?ref='+encodeURIComponent(S.cfg.branch)+'&t='+Date.now();
async function getFile(p){const r=await gh('/contents/'+p+ref());return{sha:r.sha,text:r.content?b64ToStr(r.content):'',size:r.size}}
async function listDir(p){try{const r=await gh('/contents/'+p+ref());return Array.isArray(r)?r:[]}catch(e){if(e.status===404)return[];throw e}}
async function putText(p,text,sha,msg){const b={message:msg,content:strToB64(text),branch:S.cfg.branch};if(sha)b.sha=sha;const r=await gh('/contents/'+p,{method:'PUT',body:JSON.stringify(b)});return r.content.sha}
async function delFile(p,sha,msg){await gh('/contents/'+p,{method:'DELETE',body:JSON.stringify({message:msg,sha,branch:S.cfg.branch})})}
async function pool(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k])}}));return out}

/* ====== ساختار محتوا ====== */
const SCH={
 pages:{label:'صفحه',dir:'content/pages',def:()=>({title:'',slug:'',status:'draft',template:'page',intro:'',blocks:[]}),multi:true},
 works:{label:'نوشته',dir:'content/works',def:()=>({title:'',slug:'',status:'draft',date:today(),category:'',author:'',summary:'',body:'',sources:'',tags:'',image:''})},
 treasury:{label:'منبع',dir:'content/treasury',def:()=>({title:'',status:'published',review_status:'unreviewed',added:today()})},
 events:{label:'رویداد',dir:'content/events',def:()=>({title:'',slug:'',status:'draft',visibility:'public'})}};
const siteList=k=>()=>((S.site&&S.site[k])||[]).map(x=>[x,x]);
const STAT=[['published','منتشرشده'],['draft','پیش‌نویس']];
const T=(k,l,o)=>Object.assign({k,l,type:'text'},o);
const FIELDS={
 pages:[T('title','عنوان صفحه'),T('intro','متن زیر عنوان',{type:'textarea'}),T('blocks','بخش‌های صفحه',{type:'blocks'}),
  T('status','وضعیت',{type:'select',opts:()=>STAT,g:'side'}),T('template','نوع صفحه',{type:'select',g:'side',hint:'«خانه» بدون عنوان بالای صفحه؛ «آثار/گنجینه/رویدادها» فهرست خودکار زیر بخش‌ها اضافه می‌کنند.',opts:()=>[['page','معمولی'],['home','صفحهٔ نخست'],['works','فهرست آثار'],['treasury','فهرست گنجینه'],['events','فهرست رویدادها']]}),
  T('slug','نشانی صفحه',{type:'slug',g:'side',hint:'انگلیسی و کوچک؛ مثل about یا fields/sword. صفحهٔ نخست: index'}),
  T('description','توضیح کوتاه برای گوگل',{type:'textarea',g:'seo'}),T('seo_title','عنوان گوگل (اختیاری)',{g:'seo'}),T('image','تصویر اشتراک‌گذاری',{type:'media',kind:'image',g:'seo'})],
 works:[T('title','عنوان'),T('summary','خلاصه',{type:'textarea'}),T('body','متن مقاله',{type:'richtext'}),T('sources','منابع',{type:'richtext',mini:true}),
  T('status','وضعیت',{type:'select',opts:()=>STAT,g:'side',hint:'تاریخ آینده = انتشار زمان‌بندی‌شده'}),T('date','تاریخ انتشار',{type:'date',g:'side'}),T('category','دسته‌بندی',{type:'select',opts:siteList('works_categories'),g:'side'}),
  T('author','نویسنده',{g:'side'}),T('image','تصویر شاخص',{type:'media',kind:'image',g:'side'}),T('tags','برچسب‌ها (با ویرگول)',{g:'side'}),T('slug','نشانی (انگلیسی)',{type:'slug',g:'side'}),
  T('seo_title','عنوان گوگل (اختیاری)',{g:'seo'}),T('seo_desc','توضیح گوگل (اختیاری)',{type:'textarea',g:'seo'})],
 treasury:[T('title','عنوان منبع'),T('creator','نویسنده / پدیدآورنده'),T('url','نشانی منبع اصلی',{type:'url'}),T('summary','خلاصه',{type:'textarea'}),T('why','دلیل پیشنهاد / اهمیت',{type:'textarea'}),
  T('type','نوع منبع',{type:'select',opts:siteList('treasury_types'),g:'side'}),T('subject','موضوع',{type:'select',opts:siteList('treasury_categories'),g:'side'}),T('language','زبان',{g:'side'}),T('year','سال انتشار',{g:'side'}),
  T('review_status','وضعیت بررسی',{type:'select',g:'side',opts:()=>[['unreviewed','بررسی‌نشده'],['reviewed','بررسی‌شده'],['featured','منتخب']]}),T('status','نمایش در سایت',{type:'select',opts:()=>STAT,g:'side'}),T('tags','برچسب‌ها (با ویرگول)',{g:'side'}),T('added','تاریخ افزودن',{type:'date',g:'side'})],
 events:[T('title','عنوان رویداد'),T('summary','خلاصه',{type:'textarea'}),T('goal','هدف',{type:'textarea'}),T('topics','محورهای بحث',{type:'textarea'}),T('conditions','شرایط ثبت‌نام',{type:'textarea'}),T('report','گزارش پس از برگزاری',{type:'richtext'}),
  T('status','وضعیت',{type:'select',g:'side',opts:()=>[['draft','پیش‌نویس (نمایش داده نمی‌شود)'],['upcoming','پیش‌رو'],['past','برگزارشده'],['cancelled','لغوشده']]}),T('start','زمان و تاریخ',{type:'datetime',g:'side'}),T('duration','مدت',{g:'side'}),T('format','شیوهٔ برگزاری',{g:'side'}),
  T('visibility','دسترسی',{type:'select',g:'side',opts:()=>[['public','عمومی'],['private','خصوصی']]}),T('organizer','برگزارکننده',{g:'side'}),T('register_url','پیوند ثبت‌نام',{type:'url',g:'side'}),T('image','تصویر',{type:'media',kind:'image',g:'side'}),T('slug','نشانی (انگلیسی)',{type:'slug',g:'side'})]};
const BTN=(k,l)=>T(k,l,{type:'group',fields:[T('label','متن دکمه'),T('url','نشانی',{type:'url'})]});
const BLOCKS={
 hero:{l:'بخش آغازین (هیرو)',f:[T('title','عنوان اصلی'),T('text','متن',{type:'textarea'}),BTN('btn1','دکمهٔ اول'),BTN('btn2','دکمهٔ دوم'),T('show_art','نمایش طرح تزئینی',{type:'bool'})]},
 richtext:{l:'متن',f:[T('heading','عنوان بخش (اختیاری)'),T('style','سبک',{type:'select',opts:()=>[['plain','ساده'],['alt','با پس‌زمینهٔ متفاوت'],['split','عنوان کنار متن'],['split-alt','عنوان کنار متن + پس‌زمینه']]}),T('html','متن',{type:'richtext'})]},
 cards:{l:'کارت‌ها',f:[T('heading','عنوان'),T('intro','توضیح',{type:'textarea'}),T('cols','تعداد ستون',{type:'select',opts:()=>[[1,'۱'],[2,'۲'],[3,'۳'],[4,'۴']]}),T('style','سبک',{type:'select',opts:()=>[['plain','ساده'],['alt','پس‌زمینهٔ متفاوت']]}),T('accent','خط طلایی بالای کارت',{type:'bool'}),
  T('items','کارت‌ها',{type:'list',label:'title',fields:[T('title','عنوان'),T('text','متن',{type:'textarea'}),T('link_label','متن پیوند'),T('url','نشانی پیوند',{type:'url'}),T('image','تصویر',{type:'media',kind:'image'})]})]},
 latest:{l:'آخرین نوشته‌ها / رویدادها',f:[T('heading','عنوان'),T('intro','توضیح',{type:'textarea'}),T('source','منبع',{type:'select',opts:()=>[['works','نوشته‌ها'],['events','رویدادها']]}),T('count','تعداد',{type:'number'}),T('empty','پیام وقتی چیزی نیست'),T('style','سبک',{type:'select',opts:()=>[['plain','ساده'],['alt','پس‌زمینهٔ متفاوت']]})]},
 cta:{l:'دعوت پایانی',f:[T('heading','عنوان'),T('text','متن',{type:'textarea'}),BTN('btn','دکمه')]},
 media:{l:'تصویر / ویدیو / فایل',f:[T('kind','نوع',{type:'select',opts:()=>[['image','تصویر'],['video','ویدیوی بارگذاری‌شده'],['embed','ویدیوی آپارات/یوتیوب (نشانی embed)'],['files','فهرست فایل‌های دانلودی']]}),T('heading','عنوان (اختیاری)'),T('src','فایل یا نشانی',{type:'media',kind:'any'}),T('alt','متن جایگزین / عنوان'),T('caption','زیرنویس'),T('poster','تصویر روی ویدیو',{type:'media',kind:'image'}),
  T('items','فایل‌ها (برای نوع «فهرست فایل‌ها»)',{type:'list',label:'label',fields:[T('label','نام نمایشی'),T('url','فایل',{type:'media',kind:'file'})]})]},
 faq:{l:'پرسش و پاسخ',f:[T('heading','عنوان'),T('items','پرسش‌ها',{type:'list',label:'q',fields:[T('q','پرسش'),T('a','پاسخ',{type:'richtext',mini:true})]})]},
 notice:{l:'کادر اطلاعیه',f:[T('html','متن',{type:'richtext',mini:true})]},
 html:{l:'کد HTML دلخواه',f:[T('html','کد',{type:'textarea',mono:true,rows:8})]}};

/* ====== فیلدها ====== */
function fieldEl(d,obj,chg){
  const set=v=>{obj[d.k]=v;chg()};const w=h('div',{class:'f'});
  const lab=()=>h('label',{},d.l);const hint=()=>d.hint?h('div',{class:'hint'},d.hint):null;
  if(d.type==='bool'){const c=h('input',{type:'checkbox',onchange:e=>set(e.target.checked)});c.checked=obj[d.k]!==false&&!!(obj[d.k]===undefined?true:obj[d.k]);w.append(h('label',{},c,' '+d.l));return w}
  if(d.type==='group'){obj[d.k]=obj[d.k]||{};const fs=h('fieldset',{},h('legend',{},d.l));fs.append(...d.fields.map(x=>fieldEl(x,obj[d.k],chg)));return fs}
  if(d.type==='list')return listEl(d,obj,chg);
  if(d.type==='blocks')return blocksEl(d,obj,chg);
  w.append(lab());
  if(d.type==='richtext'){w.append(richEditor(obj[d.k]||'',set,d.mini))}
  else if(d.type==='textarea'||d.type==='lines'){const t=h('textarea',{rows:d.rows||3,class:d.mono?'mono':'',oninput:e=>set(d.type==='lines'?e.target.value.split('\n').map(s=>s.trim()).filter(Boolean):e.target.value)});t.value=d.type==='lines'?(obj[d.k]||[]).join('\n'):(obj[d.k]||'');w.append(t)}
  else if(d.type==='select'){const s=h('select',{onchange:e=>set(isNaN(e.target.value)||e.target.value===''?e.target.value:+e.target.value)});const o=(d.opts?d.opts():[]).slice();
    if(obj[d.k]&&!o.some(x=>String(x[0])===String(obj[d.k])))o.push([obj[d.k],obj[d.k]]);s.append(h('option',{value:''},'— انتخاب —'),...o.map(x=>h('option',{value:x[0]},x[1])));s.value=obj[d.k]==null?'':obj[d.k];w.append(s)}
  else if(d.type==='media'||d.type==='url'){
    const i=h('input',{type:'text',dir:'ltr',placeholder:d.type==='url'?'/about.html یا https://…':'',oninput:e=>{set(e.target.value);pv()}});i.value=obj[d.k]||'';
    if(d.type==='url')i.setAttribute('list','pages-dl');
    const pr=h('div',{});const pv=()=>{pr.innerHTML='';if(d.kind==='image'&&i.value)pr.append(h('img',{src:toEd(i.value),style:'max-height:90px;margin-top:6px;border-radius:6px',alt:''}))};pv();
    w.append(h('div',{class:'row'},i,h('button',{class:'btn s',type:'button',onclick:async()=>{const r=await pickMedia(d.kind||'any');if(r){i.value='/'+r.path;set(i.value);pv()}}},'کتابخانه / بارگذاری'),i.value?null:null),pr)}
  else{const ty={number:'number',date:'date',datetime:'datetime-local',color:'color'}[d.type]||'text';
    const i=h('input',{type:ty,dir:d.type==='slug'?'ltr':null,oninput:e=>set(d.type==='number'?+e.target.value:e.target.value)});i.value=obj[d.k]==null?'':obj[d.k];if(d.type==='slug'&&obj.__locked)i.disabled=true;w.append(i)}
  const hh=hint();if(hh)w.append(hh);return w}
function formEl(defs,obj,chg){const f=h('div');defs.forEach(d=>f.append(fieldEl(d,obj,chg)));return f}
function listEl(d,obj,chg){
  obj[d.k]=obj[d.k]||[];const box=h('div',{class:'f'});
  const build=()=>{box.innerHTML='';box.append(h('label',{},d.l));
    obj[d.k].forEach((it,i)=>{const r=repBox(it[d.label]||('مورد '+(i+1)),[
      h('button',{class:'btn s',type:'button',onclick:()=>mv(i,-1)},'↑'),h('button',{class:'btn s',type:'button',onclick:()=>mv(i,1)},'↓'),
      h('button',{class:'btn s d',type:'button',onclick:()=>{obj[d.k].splice(i,1);chg();build()}},'حذف')],formEl(d.fields,it,chg),true);box.append(r)});
    box.append(h('button',{class:'btn s',type:'button',onclick:()=>{obj[d.k].push({});chg();build()}},'+ افزودن'))};
  const mv=(i,s)=>{const a=obj[d.k],j=i+s;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];chg();build()};
  build();return box}
function repBox(title,btns,body,closed){const r=h('div',{class:'rep'+(closed?' closed':'')});
  r.append(h('div',{class:'rh'},h('b',{onclick:()=>r.classList.toggle('closed'),style:'cursor:pointer'},title),btns,h('button',{class:'btn s',type:'button',onclick:()=>r.classList.toggle('closed')},'باز/بسته')),h('div',{class:'rb'},body));return r}
function blocksEl(d,obj,chg){
  obj[d.k]=obj[d.k]||[];const box=h('div',{class:'f'});let drag=-1;
  const build=()=>{box.innerHTML='';box.append(h('label',{},d.l));const a=obj[d.k];
    a.forEach((b,i)=>{const def=BLOCKS[b.type]||{l:b.type,f:[]};
      const sum=b.heading||b.title||(b.html?b.html.replace(/<[^>]+>/g,' ').trim().slice(0,40):'')||'';
      const r=repBox(def.l+(sum?' — '+sum:''),[h('span',{class:'grip',title:'بکشید و جابه‌جا کنید',onmousedown:()=>{r.draggable=true}},'⠿'),
        h('button',{class:'btn s',type:'button',onclick:()=>mv(i,-1)},'↑'),h('button',{class:'btn s',type:'button',onclick:()=>mv(i,1)},'↓'),
        h('button',{class:'btn s',type:'button',onclick:()=>{a.splice(i+1,0,JSON.parse(JSON.stringify(b)));chg();build()}},'کپی'),
        h('button',{class:'btn s d',type:'button',onclick:async()=>{if(await confirmBox('این بخش حذف شود؟','حذف')){a.splice(i,1);chg();build()}}},'حذف')],formEl(def.f,b,chg),i>0||a.length>3);
      r.addEventListener('dragend',()=>{r.draggable=false});r.addEventListener('dragstart',e=>{drag=i;e.dataTransfer.effectAllowed='move'});r.addEventListener('dragover',e=>{e.preventDefault();r.classList.add('over')});
      r.addEventListener('dragleave',()=>r.classList.remove('over'));r.addEventListener('drop',e=>{e.preventDefault();if(drag>-1&&drag!==i){const [x]=a.splice(drag,1);a.splice(i,0,x);chg();build()}drag=-1});box.append(r)});
    box.append(h('div',{class:'addbar'},h('span',{class:'hint'},'افزودن بخش:'),Object.keys(BLOCKS).map(k=>h('button',{class:'btn s',type:'button',onclick:()=>{const nb={type:k};if(k==='cards'){nb.cols=3;nb.accent=true;nb.items=[]}if(k==='latest'){nb.source='works';nb.count=3}if(k==='richtext')nb.style='plain';a.push(nb);chg();build()}},BLOCKS[k].l))))};
  const mv=(i,s)=>{const a=obj[d.k],j=i+s;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];chg();build()};
  build();return box}

/* ====== ویرایشگر متن غنی ====== */
function cleanPaste(hh){const d=new DOMParser().parseFromString(hh,'text/html');d.querySelectorAll('script,style,meta,link,title').forEach(x=>x.remove());
  const ok=/^(P|H[1-6]|UL|OL|LI|A|B|STRONG|I|EM|U|BR|BLOCKQUOTE|TABLE|THEAD|TBODY|TR|TD|TH|IMG)$/;
  (function walk(n){[...n.childNodes].forEach(c=>{if(c.nodeType===1){walk(c);if(!ok.test(c.nodeName))c.replaceWith(...c.childNodes);else[...c.attributes].forEach(a=>{if(!/^(href|src|alt)$/.test(a.name))c.removeAttribute(a.name)})}else if(c.nodeType===8)c.remove()})})(d.body);return d.body.innerHTML}
function embedUrl(u){u=u.trim();let m;
  if(m=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/))return'https://www.youtube.com/embed/'+m[1];
  if(m=u.match(/vimeo\.com\/(\d+)/))return'https://player.vimeo.com/video/'+m[1];
  if(m=u.match(/aparat\.com\/v\/(\w+)/))return'https://www.aparat.com/video/video/embed/videohash/'+m[1]+'/vt/frame';
  return u}
function richEditor(val,onc,mini){
  const box=h('div',{class:'rte'});let range=null;
  const ed=h('div',{class:'rte-area',contenteditable:'true',dir:'rtl',spellcheck:'false',style:mini?'min-height:110px':null});ed.innerHTML=toEd(val);
  const src=h('textarea',{class:'rte-src',hidden:true,dir:'ltr'});
  const emit=()=>onc(fromEd(ed.innerHTML));
  const keep=()=>{const s=getSelection();if(s.rangeCount&&ed.contains(s.anchorNode))range=s.getRangeAt(0).cloneRange()};
  const back=()=>{ed.focus();if(range){const s=getSelection();s.removeAllRanges();s.addRange(range)}};
  ['keyup','mouseup','blur'].forEach(e=>ed.addEventListener(e,keep));ed.addEventListener('input',emit);
  ed.addEventListener('paste',e=>{e.preventDefault();const cd=e.clipboardData,hh=cd.getData('text/html');document.execCommand(hh?'insertHTML':'insertText',false,hh?cleanPaste(hh):cd.getData('text/plain'));emit()});
  const cmd=(c,v)=>{back();document.execCommand(c,false,v);emit();keep()};
  const ins=x=>{back();document.execCommand('insertHTML',false,x);emit()};
  const B=(l,t,fn)=>h('button',{type:'button',title:t,onmousedown:e=>e.preventDefault(),onclick:fn},l);const G=()=>h('span',{class:'g'});
  const blk=h('select',{title:'قالب پاراگراف',onchange:e=>{if(e.target.value)cmd('formatBlock','<'+e.target.value+'>');e.target.value=''}},
    h('option',{value:''},'قالب…'),...[['p','پاراگراف'],['h2','عنوان بخش'],['h3','زیرعنوان'],['h4','عنوان کوچک'],['blockquote','نقل‌قول']].map(x=>h('option',{value:x[0]},x[1])));
  const setDir=d=>{back();let n=range&&range.startContainer;while(n&&n!==ed&&!(n.nodeType===1&&/^(P|H[1-6]|LI|BLOCKQUOTE|DIV|UL|OL|TABLE)$/.test(n.nodeName)))n=n.parentNode;if(n&&n!==ed)n.setAttribute('dir',d);emit()};
  const linkDlg=async()=>{keep();const sel=range?range.toString():'';const u=h('input',{type:'text',dir:'ltr',placeholder:'https://… یا /about.html',style:'width:100%'});u.setAttribute('list','pages-dl');
    const nt=h('input',{type:'checkbox'});const tx=h('input',{type:'text',value:sel,placeholder:'متن پیوند',style:'width:100%'});await ensurePages();
    modal('افزودن پیوند',h('div',{},h('p',{},'نشانی (یکی از صفحه‌های سایت را از فهرست انتخاب کنید یا نشانی بنویسید):'),u,h('p',{},'متن پیوند:'),tx,h('p',{},h('label',{},nt,' باز شدن در زبانهٔ جدید'))),
      [{label:'افزودن',primary:true,fn:()=>{if(!u.value.trim())return false;const url=toEd(u.value.trim());back();
        if(sel)document.execCommand('createLink',false,url);else document.execCommand('insertHTML',false,'<a href="'+esc(url)+'">'+esc(tx.value||u.value)+'</a>');
        if(nt.checked)ed.querySelectorAll('a[href="'+url+'"]').forEach(a=>{a.target='_blank';a.rel='noopener noreferrer'});emit()}},{label:'انصراف',fn:()=>{}}])};
  const imgDlg=async()=>{keep();const r=await pickMedia('image');if(!r)return;const al=h('input',{type:'text',style:'width:100%',placeholder:'توضیح کوتاه تصویر (برای نابینایان و گوگل)'});
    modal('متن جایگزین تصویر',al,[{label:'درج تصویر',primary:true,fn:()=>{ins('<img src="'+toEd('/'+r.path)+'" alt="'+esc(al.value)+'">')}}])};
  const vidDlg=()=>{keep();const e=h('input',{type:'text',dir:'ltr',style:'width:100%',placeholder:'نشانی یوتیوب، ویمیو یا آپارات (https://www.aparat.com/v/…)'});
    modal('درج ویدیو',h('div',{},h('p',{},'ویدیو از لینک:'),e,h('p',{},'یا ویدیوی بارگذاری‌شده:'),h('button',{class:'btn',onclick:async()=>{const r=await pickMedia('video');if(r){ins('<video controls preload="metadata" src="'+toEd('/'+r.path)+'"></video>');document.querySelectorAll('.ov').forEach(o=>o.remove())}}},'انتخاب از کتابخانه')),
      [{label:'درج',primary:true,fn:()=>{if(!e.value.trim())return false;ins('<div class="embed"><iframe src="'+esc(embedUrl(e.value))+'" allowfullscreen loading="lazy" title="ویدیو"></iframe></div><p><br></p>')}}])};
  const fileDlg=async()=>{keep();const r=await pickMedia('any');if(!r)return;const t=h('input',{type:'text',style:'width:100%',value:r.name});
    modal('متن پیوند دانلود',t,[{label:'درج',primary:true,fn:()=>ins('<a href="'+toEd('/'+r.path)+'" download>'+esc(t.value)+'</a>')}])};
  const tblDlg=()=>{keep();const r=h('input',{type:'number',value:3,min:1,max:20}),c=h('input',{type:'number',value:3,min:1,max:10});
    modal('درج جدول',h('div',{},h('p',{},'تعداد سطر: '),r,h('p',{},'تعداد ستون: '),c),[{label:'درج',primary:true,fn:()=>{let t='<table><thead><tr>'+'<th>عنوان</th>'.repeat(c.value)+'</tr></thead><tbody>';for(let i=1;i<r.value;i++)t+='<tr>'+'<td><br></td>'.repeat(c.value)+'</tr>';ins(t+'</tbody></table><p><br></p>')}}])};
  let isSrc=false;const srcBtn=B('HTML','نمایش/ویرایش کد',()=>{isSrc=!isSrc;if(isSrc){src.value=fromEd(ed.innerHTML);ed.hidden=true;src.hidden=false}else{ed.innerHTML=toEd(src.value);ed.hidden=false;src.hidden=true;emit()}});
  src.addEventListener('input',()=>onc(src.value));
  const bar=h('div',{class:'rte-bar'},blk,G(),B('B','پررنگ',()=>cmd('bold')),B('I','کج',()=>cmd('italic')),B('U','زیرخط',()=>cmd('underline')),B('S','خط‌خورده',()=>cmd('strikeThrough')),G(),
    B('• لیست','فهرست نقطه‌ای',()=>cmd('insertUnorderedList')),B('۱. لیست','فهرست شماره‌دار',()=>cmd('insertOrderedList')),G(),
    B('راست','راست‌چین',()=>cmd('justifyRight')),B('وسط','وسط‌چین',()=>cmd('justifyCenter')),B('چپ','چپ‌چین',()=>cmd('justifyLeft')),B('تراز','تراز دوطرفه',()=>cmd('justifyFull')),B('LTR','جهت چپ‌به‌راست (برای متن انگلیسی)',()=>setDir('ltr')),B('RTL','جهت راست‌به‌چپ',()=>setDir('rtl')),G(),
    B('پیوند','افزودن پیوند',linkDlg),B('حذف پیوند','حذف پیوند',()=>cmd('unlink')),B('تصویر','درج تصویر',imgDlg),B('ویدیو','درج ویدیو',vidDlg),B('فایل','درج فایل دانلودی',fileDlg),B('جدول','درج جدول',tblDlg),B('خط','خط جداکننده',()=>cmd('insertHorizontalRule')),G(),
    B('پاک‌سازی','حذف قالب‌بندی',()=>cmd('removeFormat')),B('↶','واگرد',()=>cmd('undo')),B('↷','تکرار',()=>cmd('redo')),srcBtn,B('تمام‌صفحه','تمام‌صفحه',()=>box.classList.toggle('full')));
  box.append(bar,ed,src);return box}

/* ====== رسانه ====== */
async function loadMedia(force){if(S.media&&!force)return S.media;const out=[];
  for(const [d,k] of [['images','image'],['videos','video'],['files','file']]){(await listDir('assets/uploads/'+d)).filter(x=>x.type==='file'&&x.name!=='README.txt').forEach(x=>out.push({name:x.name,path:x.path,sha:x.sha,size:x.size,kind:k}))}
  return S.media=out}
const rawUrl=p=>'https://raw.githubusercontent.com/'+S.cfg.repo+'/'+S.cfg.branch+'/'+p;
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
async function optimizeImg(f){if(!/^image\/(jpeg|png|webp)$/.test(f.type))return null;const bm=await createImageBitmap(f);const sc=Math.min(1,2000/Math.max(bm.width,bm.height));
  if(sc===1&&f.size<400e3)return null;const c=document.createElement('canvas');c.width=Math.round(bm.width*sc);c.height=Math.round(bm.height*sc);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,'image/webp',.85));return b&&b.size<f.size?b:null}
async function uploadOne(f,optimize){let blob=f,ext=(f.name.split('.').pop()||'').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
  if(optimize&&f.type.startsWith('image/')){try{const o=await optimizeImg(f);if(o){blob=o;ext='webp'}}catch(e){}}
  if(blob.size>95*1048576)throw new Error('حجم فایل بیش از ۹۵ مگابایت است؛ ویدیوهای سنگین را در آپارات/یوتیوب بگذارید و لینک بدهید');
  const dir=f.type.startsWith('image/')?'images':f.type.startsWith('video/')?'videos':'files';
  const base=(f.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'file').slice(0,40)+'-'+Date.now().toString(36).slice(-4);
  const path='assets/uploads/'+dir+'/'+base+'.'+ext;const b64=u8ToB64(new Uint8Array(await blob.arrayBuffer()));
  const r=await gh('/contents/'+path,{method:'PUT',body:JSON.stringify({message:'بارگذاری فایل: '+base+'.'+ext,content:b64,branch:S.cfg.branch})});
  const it={name:base+'.'+ext,path,sha:r.content.sha,size:blob.size,kind:dir==='images'?'image':dir==='videos'?'video':'file'};if(S.media)S.media.push(it);return it}
function mediaPanel(kind,onPick){
  const root=h('div');let filt=kind&&kind!=='any'?kind:'all',q='';
  const opt=h('input',{type:'checkbox',checked:true});const inp=h('input',{type:'file',multiple:true,hidden:true});const log=h('div',{class:'hint'});
  const dz=h('div',{class:'dz'},h('p',{},'فایل‌ها را اینجا رها کنید یا ',h('button',{class:'btn s',type:'button',onclick:()=>inp.click()},'انتخاب از دستگاه')),
    h('label',{class:'hint'},opt,' بهینه‌سازی خودکار تصویرها (کوچک‌کردن و فشرده‌سازی؛ پیشنهاد می‌شود)'),log);
  const grid=h('div',{class:'mg'});
  const go=async files=>{for(const f of files){const l=h('div',{},'در حال بارگذاری '+f.name+'…');log.append(l);try{const it=await uploadOne(f,opt.checked);l.textContent='✓ '+f.name;draw();if(onPick&&files.length===1&&(kind==='any'||kind===it.kind))onPick(it)}catch(e){l.textContent='✗ '+f.name+': '+e.message}}};
  inp.onchange=()=>go([...inp.files]);dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};dz.ondragleave=()=>dz.classList.remove('over');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');go([...e.dataTransfer.files])};
  const chips=h('div',{class:'bar'},[['all','همه'],['image','تصویر'],['video','ویدیو'],['file','فایل']].map(x=>kind&&kind!=='any'&&x[0]!==kind&&x[0]!=='all'?null:h('button',{class:'btn s',onclick:()=>{filt=x[0];draw()}},x[1])),
    h('input',{type:'search',placeholder:'جست‌وجو در نام فایل…',oninput:e=>{q=e.target.value.toLowerCase();draw()}}),h('button',{class:'btn s',onclick:async()=>{await loadMedia(true);draw()}},'تازه‌سازی'));
  const draw=async()=>{grid.innerHTML='در حال بارگذاری…';let all;try{all=await loadMedia()}catch(e){grid.textContent='خطا: '+e.message;return}
    const l=all.filter(x=>(filt==='all'||x.kind===filt)&&(!q||x.name.toLowerCase().includes(q))).sort((a,b)=>b.name<a.name?-1:1);grid.innerHTML='';
    if(!l.length)grid.append(h('p',{class:'hint'},'فایلی نیست؛ از بالا بارگذاری کنید.'));
    l.forEach(x=>grid.append(h('div',{class:'mt',onclick:()=>onPick?onPick(x):detail(x)},h('div',{class:'th'},x.kind==='image'?h('img',{src:rawUrl(x.path),alt:'',loading:'lazy'}):x.kind==='video'?'▶':'📄'),h('div',{class:'nm'},x.name),h('div',{class:'nm',style:'color:var(--ink2)'},fmtSize(x.size)))))};
  const detail=x=>{const url='/'+x.path;modal(x.name,h('div',{},x.kind==='image'?h('img',{src:rawUrl(x.path),style:'max-width:100%;max-height:300px'}):null,h('p',{},'نشانی در سایت:'),h('pre',{class:'code'},url),h('p',{class:'hint'},fmtSize(x.size))),
    [{label:'کپی نشانی',primary:true,fn:async()=>{try{await navigator.clipboard.writeText(url);toast('کپی شد')}catch(e){toast(url)}return false}},
     {label:'حذف فایل',fn:async()=>{if(!await confirmBox('این فایل برای همیشه از سایت حذف شود؟ (در تاریخچهٔ گیت‌هاب باقی می‌ماند)','حذف'))return false;
       try{await delFile(x.path,x.sha,'حذف فایل: '+x.name);S.media=S.media.filter(m=>m.path!==x.path);draw();toast('حذف شد')}catch(e){toast(e.message,1);return false}}},{label:'بستن',fn:()=>{}}])};
  root.append(dz,chips,grid);draw();return root}
function pickMedia(kind){return new Promise(res=>{let close;const p=mediaPanel(kind,it=>{res(it);close()});close=modal('کتابخانهٔ رسانه',p,[],{wide:true,onclose:()=>res(null)})})}

/* ====== مجموعه‌ها ====== */
async function loadCol(col,force){if(S.col[col]&&!force)return S.col[col];
  const files=(await listDir(SCH[col].dir)).filter(f=>f.type==='file'&&f.name.endsWith('.json'));
  const items=await pool(files,6,async f=>{try{const r=await getFile(f.path);return{file:f.name,path:f.path,sha:r.sha,data:JSON.parse(r.text)}}catch(e){return{file:f.name,path:f.path,sha:f.sha,data:{title:f.name+' (خطا در خواندن)'},bad:true}}});
  return S.col[col]=items}
async function ensurePages(){if(S.pages)return;try{const l=await loadCol('pages');S.pages=l.map(x=>({t:x.data.title,u:'/'+(x.data.slug||'')+'.html'}))}catch(e){S.pages=[]}
  let dl=$('#pages-dl');if(!dl){dl=h('datalist',{id:'pages-dl'});document.body.append(dl)}dl.innerHTML='';S.pages.forEach(p=>dl.append(h('option',{value:p.u},p.t)));
  [['works',"/works/"],['events',"/events/"]].forEach(async([c,pre])=>{try{(await loadCol(c)).forEach(x=>dl.append(h('option',{value:pre+(x.data.slug||x.file.replace('.json',''))+'.html'},x.data.title)))}catch(e){}})}
const fileOf=(col,slug)=>(col==='pages'?slug.replace(/\//g,'--'):slug)+'.json';
const slugOk=(col,s)=>(col==='pages'?/^[a-z0-9]+([-_/][a-z0-9]+)*$/:/^[a-z0-9]+([-_][a-z0-9]+)*$/).test(s);
function statusBadge(d){const dt=d.date||d.added||'';if(d.status==='published'||(d.status==='upcoming'))return dt&&dt>today()&&d.date?h('span',{class:'badge sch'},'زمان‌بندی‌شده'):h('span',{class:'badge pub'},d.status==='upcoming'?'پیش‌رو':'منتشرشده');
  return h('span',{class:'badge'},{draft:'پیش‌نویس',past:'برگزارشده',cancelled:'لغوشده'}[d.status]||d.status||'—')}

async function listView(col){const m=$('#view');const sc=SCH[col];m.innerHTML='';
  const name={pages:'صفحه‌ها',works:'اندیشه‌ها و آثار',treasury:'گنجینهٔ تیشتر',events:'رویدادها'}[col];
  m.append(h('h2',{},name));const tb=h('tbody');let items;
  try{items=await loadCol(col,true)}catch(e){m.append(h('p',{class:'hint'},'خطا: '+e.message));return}
  let q='',st='';const draw=()=>{tb.innerHTML='';items.filter(x=>(!q||JSON.stringify(x.data).toLowerCase().includes(q))&&(!st||x.data.status===st)).sort((a,b)=>(b.data.date||b.data.added||b.data.start||'')>(a.data.date||a.data.added||a.data.start||'')?1:-1).forEach(x=>{
    const d=x.data,slug=x.file.replace('.json','').replace(/--/g,'/');
    tb.append(h('tr',{},h('td',{},h('a',{href:'#/'+col+'/'+encodeURIComponent(x.file)},d.title||'(بدون عنوان)'),col==='pages'?h('div',{class:'hint'},'/'+(d.slug||slug)+'.html'):null),h('td',{},statusBadge(d)),h('td',{},d.category||d.type||d.template||''),h('td',{},(d.date||d.added||(d.start||'').slice(0,10)||'')),
      h('td',{},h('button',{class:'btn s',onclick:async()=>{d.status=d.status==='published'?'draft':'published';try{x.sha=await putText(x.path,JSON.stringify(d,null,1),x.sha,(d.status==='published'?'انتشار: ':'پیش‌نویس شد: ')+d.title);toast('ذخیره شد');draw()}catch(e){toast(e.message,1)}}},d.status==='published'?'پیش‌نویس کن':'منتشر کن'),' ',
        h('button',{class:'btn s',onclick:()=>dup(x)},'کپی'),' ',h('button',{class:'btn s d',onclick:()=>del(x)},'حذف'))))});
    if(!tb.children.length)tb.append(h('tr',{},h('td',{colspan:5,class:'hint'},'موردی نیست. با «جدید» شروع کنید.')))};
  const dup=async x=>{const d=JSON.parse(JSON.stringify(x.data));const base=(x.file.replace('.json','')+'-copy');d.title+=' (کپی)';d.status='draft';if(d.slug)d.slug=base.replace(/--/g,'/');
    try{await putText(sc.dir+'/'+base+'.json',JSON.stringify(d,null,1),null,'کپی از: '+x.data.title);toast('کپی ساخته شد');S.col[col]=null;listView(col)}catch(e){toast(e.message,1)}};
  const del=async x=>{if(!await confirmBox('«'+(x.data.title||x.file)+'» حذف شود؟ (از تاریخچهٔ گیت‌هاب قابل بازگردانی است)','حذف'))return;try{await delFile(x.path,x.sha,'حذف: '+x.data.title);S.col[col]=null;S.pages=null;toast('حذف شد');listView(col)}catch(e){toast(e.message,1)}};
  m.append(h('div',{class:'bar'},h('button',{class:'btn p',onclick:()=>newItem(col)},'+ '+sc.label+' جدید'),h('input',{type:'search',placeholder:'جست‌وجو…',oninput:e=>{q=e.target.value.toLowerCase();draw()}}),
    h('select',{onchange:e=>{st=e.target.value;draw()}},h('option',{value:''},'همهٔ وضعیت‌ها'),h('option',{value:'published'},'منتشرشده'),h('option',{value:'draft'},'پیش‌نویس')),h('span',{class:'hint'},items.length+' مورد')),
    h('div',{class:'card',style:'padding:0;overflow:auto'},h('table',{},h('thead',{},h('tr',{},['عنوان','وضعیت','دسته / نوع','تاریخ','عملیات'].map(t=>h('th',{},t)))),tb)));draw()}
function newItem(col){const t=h('input',{type:'text',style:'width:100%'});const s=h('input',{type:'text',dir:'ltr',style:'width:100%',placeholder:'مثلاً my-first-post'});
  const needSlug=col!=='treasury';
  modal(SCH[col].label+' جدید',h('div',{},h('p',{},'عنوان:'),t,needSlug?h('p',{},'نشانی انگلیسی (فقط حروف کوچک، عدد و خط تیره'+(col==='pages'?'؛ برای زیرصفحه از / استفاده کنید':'')+'):'):null,needSlug?s:null),
    [{label:'ادامه',primary:true,fn:()=>{if(!t.value.trim())return false;let slug=s.value.trim();if(!needSlug)slug='r-'+Date.now().toString(36);if(!slugOk(col,slug)){toast('نشانی باید انگلیسی و بدون فاصله باشد',1);return false}
      const d=SCH[col].def();d.title=t.value.trim();if(needSlug||col==='pages')d.slug=slug;S.newItem={col,file:fileOf(col,slug),data:d};location.hash='#/'+col+'/'+encodeURIComponent(fileOf(col,slug))+'/new'}},{label:'انصراف',fn:()=>{}}])}

async function editView(col,file,isNew,preset){const m=$('#view');m.innerHTML='در حال بارگذاری…';const sc=SCH[col];let sha=null,data;
  if(isNew&&S.newItem&&S.newItem.file===file){data=S.newItem.data}
  else{try{const r=await getFile(sc.dir+'/'+file);sha=r.sha;data=JSON.parse(r.text)}catch(e){m.innerHTML='';m.append(h('p',{},'خطا در باز کردن: '+e.message));return}}
  if(preset)data=preset;await ensurePages();const path=sc.dir+'/'+file;if(sha)data.__locked=1;S.dirty=false;
  const chg=()=>{S.dirty=true;sv.disabled=false};
  const sv=h('button',{class:'btn p',disabled:!isNew,onclick:()=>save()},'ذخیره (Ctrl+S)');
  const save=async()=>{const d=JSON.parse(JSON.stringify(data));delete d.__locked;
    if(!d.title){toast('عنوان لازم است',1);return}if(d.slug!==undefined&&!slugOk(col,d.slug||'')){toast('نشانی باید انگلیسی باشد (حروف کوچک، عدد، خط تیره)',1);return}
    if(col==='works')d.updated=today();sv.disabled=true;sv.textContent='در حال ذخیره…';
    try{sha=await putText(path,JSON.stringify(d,null,1),sha,(sha?'ویرایش: ':'ایجاد: ')+d.title);S.dirty=false;S.col[col]=null;S.pages=null;data.__locked=1;S.newItem=null;toast('ذخیره شد. انتشار در سایت حدود ۱ تا ۳ دقیقه طول می‌کشد.');
      if(isNew){isNew=false;history.replaceState(null,'','#/'+col+'/'+encodeURIComponent(file));S.cur=location.hash}checkDeploy()}
    catch(e){toast(e.status===422||e.status===409?'ذخیره نشد: این مورد قبلاً تغییر کرده یا نشانی تکراری است. صفحه را تازه کنید.':e.message,1);sv.disabled=false}sv.textContent='ذخیره (Ctrl+S)'};
  S.onSave=save;
  const side=h('div'),main=h('div'),seo=h('details',{class:'card'},h('summary',{},'تنظیمات گوگل (سئو)'));
  FIELDS[col].forEach(d=>(d.g==='side'?side:d.g==='seo'?seo:main).append(fieldEl(d,data,chg)));
  const prevBtn=h('button',{class:'btn',onclick:()=>preview(col,data)},'پیش‌نمایش');
  const hist=h('button',{class:'btn',onclick:()=>history_(path,d=>{editView(col,file,isNew,d)})},'تاریخچه');
  m.innerHTML='';m.append(h('div',{class:'edhead'},h('a',{class:'btn',href:'#/'+col},'← بازگشت'),h('h2',{},data.title||'جدید'),prevBtn,sha?hist:null,sv),
    h('div',{class:'ed'},h('div',{},main,seo),h('div',{class:'card'},side)));
  if(isNew||preset){S.dirty=true;sv.disabled=false}}
async function history_(path,restore){let l;try{l=await gh('/commits?path='+encodeURIComponent(path)+'&sha='+encodeURIComponent(S.cfg.branch)+'&per_page=25')}catch(e){toast(e.message,1);return}
  const body=h('div',{},l.length?null:'سابقه‌ای نیست.',l.map(c=>h('div',{class:'row',style:'padding:6px 0;border-bottom:1px solid var(--line)'},h('span',{style:'flex:1'},new Date(c.commit.author.date).toLocaleString('fa-IR')+' — '+c.commit.message.split('\n')[0]),
    h('button',{class:'btn s',onclick:async()=>{try{const r=await gh('/contents/'+path+'?ref='+c.sha);restore(JSON.parse(b64ToStr(r.content)));toast('نسخه بارگذاری شد؛ برای ثبت، «ذخیره» را بزنید.')}catch(e){toast(e.message,1)}document.querySelectorAll('.ov').forEach(o=>o.remove())}},'بازگردانی این نسخه'))));
  modal('تاریخچهٔ تغییرات',body,[{label:'بستن',fn:()=>{}}])}

/* پیش‌نمایش */
function blocksHtml(bs){const e=esc;const bt=b=>b&&b.label?'<a class="btn btn-primary" href="'+e(b.url||'#')+'">'+e(b.label)+'</a> ':'';const S_=(c,i,w)=>'<section class="section '+c+'"><div class="'+(w||'wrap')+'">'+i+'</div></section>';
  return (bs||[]).map(b=>{switch(b.type){
    case'hero':return'<section class="hero"><div class="wrap grid"><div><h1>'+e(b.title)+'</h1><p>'+e(b.text)+'</p><div class="actions">'+bt(b.btn1)+bt(b.btn2)+'</div></div></div></section>';
    case'richtext':{const hh=b.heading?'<h2>'+e(b.heading)+'</h2>':'';const st=b.style||'plain';return(st.indexOf('split')===0&&hh)?S_(st.includes('alt')?'alt':'','<div>'+hh+'</div><div class="prose">'+b.html+'</div>','wrap split'):S_(st.includes('alt')?'alt':'','<div class="prose">'+hh+(b.html||'')+'</div>')}
    case'cards':return S_(b.style==='alt'?'alt':'',(b.heading?'<div class="sec-head"><h2>'+e(b.heading)+'</h2><p class="lead">'+e(b.intro)+'</p></div>':'')+'<div class="cards cols'+(b.cols||3)+'">'+(b.items||[]).map(i=>'<article class="card'+(b.accent!==false?' field':'')+'">'+(i.image?'<img src="'+e(i.image)+'">':'')+'<h3>'+e(i.title)+'</h3><p>'+e(i.text)+'</p>'+(i.url?'<a class="link" href="'+e(i.url)+'">'+e(i.link_label||'ادامه')+'</a>':'')+'</article>').join('')+'</div>');
    case'latest':return S_('','<div class="sec-head"><h2>'+e(b.heading)+'</h2></div><div class="empty">(اینجا آخرین '+(b.source==='events'?'رویدادها':'نوشته‌ها')+' خودکار نمایش داده می‌شود)</div>');
    case'cta':return S_('cta-final','<div class="prose"><h2>'+e(b.heading)+'</h2><p>'+e(b.text)+'</p>'+bt(b.btn)+'</div>');
    case'notice':return S_('','<div class="notice">'+(b.html||'')+'</div>');
    case'media':return S_('','<figure class="media prose">'+(b.heading?'<h2>'+e(b.heading)+'</h2>':'')+(b.kind==='video'?'<video controls src="'+e(b.src)+'"></video>':b.kind==='embed'?'<div class="embed"><iframe src="'+e(b.src)+'"></iframe></div>':b.kind==='files'?'<ul class="files">'+(b.items||[]).map(i=>'<li><a href="'+e(i.url)+'">'+e(i.label)+'</a></li>').join('')+'</ul>':'<img src="'+e(b.src)+'" alt="'+e(b.alt)+'">')+(b.caption?'<figcaption>'+e(b.caption)+'</figcaption>':'')+'</figure>');
    case'faq':return S_('','<div class="prose faq">'+(b.heading?'<h2>'+e(b.heading)+'</h2>':'')+(b.items||[]).map(i=>'<details open><summary>'+e(i.q)+'</summary><div>'+(i.a||'')+'</div></details>').join('')+'</div>');
    case'html':return S_('',b.html||'');default:return''}}).join('')}
function preview(col,d){let body;const e=esc;
  if(col==='pages')body=(d.template==='home'?'':'<div class="page-head"><div class="wrap"><h1>'+e(d.title)+'</h1><p class="lead">'+e(d.intro)+'</p></div></div>')+blocksHtml(d.blocks);
  else if(col==='works')body='<div class="page-head"><div class="wrap"><h1>'+e(d.title)+'</h1><p class="lead">'+e(d.summary)+'</p></div></div><article class="section"><div class="wrap article prose"><p class="meta">'+e(d.author)+' · '+e(d.date)+'</p>'+(d.image?'<img class="hero-img" src="'+e(d.image)+'">':'')+(d.body||'')+(d.sources?'<h2>منابع</h2>'+d.sources:'')+'</div></article>';
  else if(col==='events')body='<div class="page-head"><div class="wrap"><h1>'+e(d.title)+'</h1><p class="lead">'+e(d.summary)+'</p></div></div><section class="section"><div class="wrap prose"><p>'+e(d.goal)+'</p><p>'+e(d.topics)+'</p>'+(d.report||'')+'</div></section>';
  else body='<section class="section"><div class="wrap"><article class="card"><h3>'+e(d.title)+'</h3><p>'+e(d.summary)+'</p></article></div></section>';
  const html='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><base href="'+BASE+'"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap"><link rel="stylesheet" href="assets/css/style.css"><link rel="stylesheet" href="assets/css/theme.css"></head><body><main>'+toEd(body)+'</main></body></html>';
  const f=h('iframe',{class:'prev'});f.srcdoc=html;modal('پیش‌نمایش (فقط بدنهٔ محتوا؛ نسخهٔ نهایی سربرگ و پابرگ هم دارد)',f,[{label:'بستن',fn:()=>{}}],{wide:true})}

/* ====== تنظیمات سایت ====== */
const LNK=(k,l)=>T(k,l,{type:'list',label:'label',fields:[T('label','متن'),T('url','نشانی',{type:'url'})]});
const SITE_F=[T('name','نام سایت'),T('slogan','عنوان مجموعه'),T('footer_slogan','شعار پابرگ'),T('description','توضیح کلی سایت',{type:'textarea'}),T('site_url','نشانی نهایی سایت',{hint:'مثلاً https://username.github.io/repo-name یا دامنهٔ خودتان؛ برای نقشهٔ سایت و گوگل لازم است. بدون / در انتها.'}),
  T('logo','لوگو',{type:'media',kind:'image'}),T('copyright','متن حقوق نشر پابرگ (بدون سال)',{type:'textarea'}),
  T('colors','رنگ‌های سایت',{type:'group',fields:[T('lapis','لاجوردی (رنگ اصلی)',{type:'color'}),T('night','سرمه‌ای شب',{type:'color'}),T('ivory','عاجی (پس‌زمینه)',{type:'color'}),T('card','سفید گرم (کارت‌ها)',{type:'color'}),T('gold','طلایی مات',{type:'color'}),T('text','متن اصلی',{type:'color'}),T('muted','متن فرعی',{type:'color'}),T('line','خطوط',{type:'color'})]}),
  LNK('menu','منوی اصلی'),T('menu_button','دکمهٔ برجستهٔ منو',{type:'group',fields:[T('label','متن'),T('url','نشانی',{type:'url'})]}),T('members_link','پیوند ورود اعضا',{type:'group',fields:[T('label','متن'),T('url','نشانی',{type:'url'})]}),
  T('footer_columns','ستون‌های پابرگ',{type:'list',label:'title',fields:[T('title','عنوان ستون'),LNK('links','پیوندها')]}),LNK('social','شبکه‌های اجتماعی'),
  T('works_categories','دسته‌بندی‌های آثار (هر خط یکی)',{type:'lines',rows:6}),T('treasury_categories','موضوع‌های گنجینه (هر خط یکی)',{type:'lines',rows:8}),T('treasury_types','نوع منابع (هر خط یکی)',{type:'lines',rows:5}),
  T('head_code','کد اضافه در head (مثلاً آمار بازدید)',{type:'textarea',mono:true,rows:4,hint:'فقط کدی که از منبع مطمئن گرفته‌اید؛ باید با سیاست حریم خصوصی هماهنگ باشد.'})];
async function settingsView(){const m=$('#view');m.innerHTML='در حال بارگذاری…';let r;try{r=await getFile('content/site.json')}catch(e){m.textContent=e.message;return}
  const d=JSON.parse(r.text);let sha=r.sha;S.dirty=false;await ensurePages();
  const sv=h('button',{class:'btn p',disabled:true,onclick:()=>save()},'ذخیره (Ctrl+S)');
  const save=async()=>{sv.disabled=true;try{sha=await putText('content/site.json',JSON.stringify(d,null,1),sha,'ویرایش تنظیمات سایت');S.site=d;S.dirty=false;toast('ذخیره شد. انتشار حدود ۱ تا ۳ دقیقه طول می‌کشد.');checkDeploy()}catch(e){toast(e.message,1);sv.disabled=false}};
  S.onSave=save;const f=formEl(SITE_F,d,()=>{S.dirty=true;sv.disabled=false});
  m.innerHTML='';m.append(h('div',{class:'edhead'},h('h2',{},'تنظیمات سایت، منو و پابرگ'),sv),h('div',{class:'card'},f))}

/* ====== ابزارها ====== */
async function toolsView(){const m=$('#view');m.innerHTML='';m.append(h('h2',{},'ابزارها'));
  const out=h('div'),q=h('input',{type:'search',placeholder:'جست‌وجوی متن در همهٔ محتوا…',style:'width:100%;padding:8px 12px'});
  q.addEventListener('keydown',async e=>{if(e.key!=='Enter')return;out.textContent='در حال جست‌وجو…';const s=q.value.trim().toLowerCase();if(!s)return;out.innerHTML='';let n=0;
    for(const c of Object.keys(SCH)){let l;try{l=await loadCol(c)}catch(x){continue}l.filter(x=>JSON.stringify(x.data).toLowerCase().includes(s)).forEach(x=>{n++;out.append(h('div',{},h('a',{href:'#/'+c+'/'+encodeURIComponent(x.file)},x.data.title||x.file),' ',h('span',{class:'hint'},SCH[c].label)))})}
    if(!n)out.textContent='چیزی پیدا نشد.'});
  m.append(h('div',{class:'card'},h('h3',{},'جست‌وجو در همهٔ محتوا'),q,h('div',{class:'hint'},'عبارت را بنویسید و Enter بزنید.'),out));
  const bk=h('div',{class:'hint'});
  m.append(h('div',{class:'card'},h('h3',{},'پشتیبان‌گیری'),h('p',{},'تمام محتوا (صفحه‌ها، نوشته‌ها، منابع، رویدادها، تنظیمات) و فایل‌های بارگذاری‌شده را در یک فایل ZIP دانلود کنید. پیشنهاد: ماهی یک بار.'),
    h('button',{class:'btn p',onclick:async()=>{try{bk.textContent='در حال آماده‌سازی…';await backup(bk)}catch(e){bk.textContent='خطا: '+e.message}}},'دانلود پشتیبان کامل'),bk));
  m.append(h('div',{class:'card'},h('h3',{},'ساخت دوبارهٔ سایت'),h('p',{},'اگر سایت به‌روز نشد، ساخت را دستی اجرا کنید (توکن شما باید اجازهٔ Actions داشته باشد).'),
    h('button',{class:'btn',onclick:async()=>{try{await gh('/actions/workflows/deploy.yml/dispatches',{method:'POST',body:JSON.stringify({ref:S.cfg.branch})});toast('ساخت آغاز شد');checkDeploy()}catch(e){toast('انجام نشد: '+e.message+' — می‌توانید از تب Actions در گیت‌هاب «Run workflow» بزنید.',1)}}},'اجرای ساخت'),' ',h('a',{class:'btn',target:'_blank',href:'https://github.com/'+S.cfg.repo+'/actions'},'مشاهدهٔ Actions در گیت‌هاب')));
  m.append(h('div',{class:'card'},h('h3',{},'حساب'),h('p',{class:'hint'},'ورود به‌عنوان '+(S.user||'')+' · مخزن '+S.cfg.repo+' · شاخه '+S.cfg.branch),h('button',{class:'btn d',onclick:logout},'خروج و پاک‌کردن توکن از این مرورگر')))}
async function backup(bk){const t=await gh('/git/trees/'+encodeURIComponent(S.cfg.branch)+'?recursive=1');
  const files=t.tree.filter(x=>x.type==='blob'&&(x.path.startsWith('content/')||x.path.startsWith('assets/uploads/')||x.path==='assets/img/logo1.png'));
  if(!window.JSZip)await new Promise((ok,no)=>{const s=h('script',{src:'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'});s.onload=ok;s.onerror=()=>no(new Error('بارگذاری ابزار ZIP ممکن نشد'));document.head.append(s)});
  const z=new JSZip();let i=0;await pool(files,5,async f=>{const b=await gh('/git/blobs/'+f.sha);z.file(f.path,b.content.replace(/\s/g,''),{base64:true});bk.textContent='دریافت '+(++i)+' از '+files.length});
  const blob=await z.generateAsync({type:'blob'});const a=h('a',{href:URL.createObjectURL(blob),download:'lajavard-backup-'+today()+'.zip'});document.body.append(a);a.click();a.remove();bk.textContent='پشتیبان آماده شد ('+files.length+' فایل).'}

/* ====== داشبورد، راهنما و ورود ====== */
async function dashView(){const m=$('#view');m.innerHTML='';m.append(h('h2',{},'خوش آمدید'));
  const g=h('div',{class:'grid'});m.append(g);
  [['pages','صفحه‌ها'],['works','نوشته‌ها'],['treasury','منابع گنجینه'],['events','رویدادها']].forEach(async([c,l])=>{const card=h('a',{class:'card',href:'#/'+c,style:'text-decoration:none;color:inherit'},h('div',{class:'stat'},'…'),h('div',{},l));g.append(card);
    try{const n=(await listDir(SCH[c].dir)).filter(x=>x.name.endsWith('.json')).length;card.firstChild.textContent=n}catch(e){card.firstChild.textContent='؟'}});
  m.append(h('div',{class:'card'},h('h3',{},'شروع سریع'),h('div',{class:'bar'},h('button',{class:'btn p',onclick:()=>newItem('works')},'+ نوشتهٔ جدید'),h('a',{class:'btn',href:'#/media'},'بارگذاری تصویر / ویدیو / فایل'),h('button',{class:'btn',onclick:()=>newItem('treasury')},'+ منبع جدید'),h('button',{class:'btn',onclick:()=>newItem('events')},'+ رویداد جدید'),h('a',{class:'btn',href:'#/settings'},'منو و پابرگ'))));
  const rc=h('div',{class:'card'},h('h3',{},'آخرین تغییرات'),'در حال بارگذاری…');m.append(rc);
  try{const l=await gh('/commits?sha='+encodeURIComponent(S.cfg.branch)+'&per_page=8');rc.innerHTML='';rc.append(h('h3',{},'آخرین تغییرات'),...l.map(c=>h('div',{class:'hint',style:'padding:3px 0'},new Date(c.commit.author.date).toLocaleString('fa-IR')+' — '+c.commit.message.split('\n')[0])))}catch(e){rc.textContent=e.message}}
function helpView(){const m=$('#view');m.innerHTML='';m.append(h('h2',{},'راهنمای کوتاه'),h('div',{class:'card',html:`<ol>
<li><b>ذخیره = انتشار.</b> هر ذخیره یک تغییر در گیت‌هاب ثبت می‌کند و سایت خودکار بازسازی می‌شود (حدود ۱ تا ۳ دقیقه). وضعیت بالای صفحه نشان داده می‌شود.</li>
<li><b>پیش‌نویس:</b> مطلبی که وضعیتش «پیش‌نویس» است در سایت دیده نمی‌شود (اما فایلش در مخزن عمومی گیت‌هاب قابل مشاهده است؛ مطلب محرمانه ننویسید).</li>
<li><b>انتشار زمان‌بندی‌شده:</b> برای نوشته، تاریخ آینده بگذارید و «منتشرشده» را انتخاب کنید؛ سایت هر ساعت بررسی می‌کند.</li>
<li><b>تصویر و فایل:</b> از «کتابخانهٔ رسانه» بارگذاری کنید. تصویرها خودکار کوچک می‌شوند. ویدیوی سنگین‌تر از ۲۵ مگابایت را در آپارات یا یوتیوب بگذارید و از دکمهٔ «ویدیو» در ویرایشگر لینکش را بدهید.</li>
<li><b>اشتباه کردید؟</b> در هر ویرایشگر «تاریخچه» نسخه‌های قبلی را نشان می‌دهد و می‌توانید برگردانید.</li>
<li><b>امنیت:</b> توکن فقط در همین مرورگر ذخیره می‌شود. روی رایانهٔ عمومی «خروج» بزنید. هر کس توکن ندارد نمی‌تواند چیزی تغییر دهد. برای همکار جدید، او را در گیت‌هاب به مخزن اضافه کنید تا توکن خودش را بسازد.</li>
<li><b>پشتیبان:</b> از «ابزارها» ماهی یک بار پشتیبان بگیرید.</li></ol>`}))}
async function checkDeploy(){const c=$('#dep');if(!c||!S.cfg)return;try{const r=await gh('/actions/runs?per_page=1&t='+Date.now());const w=r.workflow_runs[0];
  if(!w){c.className='chip';c.textContent='هنوز ساختی انجام نشده';return}
  if(w.status!=='completed'){c.className='chip run';c.textContent='در حال انتشار…';setTimeout(checkDeploy,15000)}
  else if(w.conclusion==='success'){c.className='chip ok';c.textContent='سایت به‌روز است'}else{c.className='chip err';c.textContent='خطا در ساخت سایت';c.title='در تب Actions گیت‌هاب جزئیات را ببینید'}}catch(e){c.textContent=''}}
function logout(){localStorage.removeItem('lj_cfg');sessionStorage.removeItem('lj_cfg');S.cfg=null;S.dirty=false;location.hash='';render()}
function loginView(err){const app=$('#app');app.innerHTML='';
  const guess=()=>{const m=location.hostname.match(/^(.+)\.github\.io$/);if(!m)return'';const seg=location.pathname.split('/').filter(Boolean);return m[1]+'/'+(seg.length>1?seg[0]:m[1]+'.github.io')};
  const repo=h('input',{type:'text',dir:'ltr',value:guess(),placeholder:'username/repository',style:'width:100%'}),br=h('input',{type:'text',dir:'ltr',value:'main',style:'width:100%'}),tk=h('input',{type:'password',dir:'ltr',placeholder:'github_pat_…',style:'width:100%'}),rm=h('input',{type:'checkbox',checked:true});
  const msg=h('div',{style:'color:var(--err);margin:8px 0'},err||'');
  const go=async()=>{S.cfg={repo:repo.value.trim(),branch:br.value.trim()||'main',token:tk.value.trim()};msg.textContent='در حال بررسی…';
    try{const r=await gh('');if(!r.permissions||!r.permissions.push)throw new Error('این توکن اجازهٔ نوشتن در مخزن را ندارد (Contents: Read and write).');
      const u=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+S.cfg.token}});S.user=u.ok?(await u.json()).login:'';
      (rm.checked?localStorage:sessionStorage).setItem('lj_cfg',JSON.stringify(S.cfg));start()}catch(e){S.cfg=null;msg.textContent=e.status===401?'توکن نامعتبر یا منقضی است.':e.status===404?'مخزن پیدا نشد یا توکن به آن دسترسی ندارد.':e.message}};
  app.append(h('div',{class:'login'},h('div',{class:'card'},h('h2',{},'پنل مدیریت خانه لاجورد'),
    h('div',{class:'f'},h('label',{},'مخزن گیت‌هاب'),repo),h('div',{class:'f'},h('label',{},'شاخه'),br),h('div',{class:'f'},h('label',{},'توکن دسترسی (Personal Access Token)'),tk),
    h('label',{},rm,' مرا در این مرورگر به‌خاطر بسپار'),msg,h('button',{class:'btn p',onclick:go},'ورود')),
    h('div',{class:'card',html:`<b>توکن را چطور بسازم؟</b><ol><li>در گیت‌هاب: Settings ← Developer settings ← Personal access tokens ← <b>Fine-grained tokens</b> ← Generate new token</li>
<li>Repository access: <b>Only select repositories</b> و فقط مخزن همین سایت</li><li>Permissions ← Repository permissions: <b>Contents = Read and write</b>، <b>Actions = Read and write</b> (برای دکمهٔ ساخت دوباره؛ اختیاری)، Metadata = Read-only</li>
<li>مدت اعتبار (Expiration) را مثلاً ۹۰ روز بگذارید، بسازید و متن توکن را اینجا بچسبانید. توکن را به کسی ندهید.</li></ol>`})))}

/* ====== مسیریاب ====== */
const NAV=[['dashboard','داشبورد'],['pages','صفحه‌ها'],['works','اندیشه‌ها و آثار'],['treasury','گنجینهٔ تیشتر'],['events','رویدادها'],['media','کتابخانهٔ رسانه'],['settings','تنظیمات، منو و پابرگ'],['tools','ابزارها و پشتیبان'],['help','راهنما']];
function shell(){const app=$('#app');app.innerHTML='';const nav=h('nav',{class:'side'},h('h1',{},'خانه لاجورد'),NAV.map((n,i)=>[i===6||i===7?h('div',{class:'sep'}):null,h('a',{href:'#/'+n[0],'data-k':n[0]},n[1])]));
  app.append(h('div',{class:'shell'},nav,h('div',{class:'main'},h('div',{class:'top'},h('a',{class:'btn s',href:BASE,target:'_blank'},'مشاهدهٔ سایت'),h('span',{id:'dep',class:'chip'}),h('span',{class:'sp'}),h('span',{class:'hint'},S.user||''),h('button',{class:'btn s',onclick:logout},'خروج')),h('div',{class:'page',id:'view'}))))}
async function route(){if(!S.cfg)return;const hash=location.hash||'#/dashboard';
  if(hash===S.cur)return;if(S.dirty&&!confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')){location.hash=S.cur;return}
  S.cur=hash;S.dirty=false;S.onSave=null;const p=hash.slice(2).split('/').map(decodeURIComponent);
  document.querySelectorAll('.side a').forEach(a=>a.classList.toggle('on',a.dataset.k===p[0]));window.scrollTo(0,0);
  try{if(SCH[p[0]]){p[1]?await editView(p[0],p[1],p[2]==='new'):await listView(p[0])}
    else if(p[0]==='media'){const m=$('#view');m.innerHTML='';m.append(h('h2',{},'کتابخانهٔ رسانه'),h('div',{class:'card'},mediaPanel('any',null)))}
    else if(p[0]==='settings')await settingsView();else if(p[0]==='tools')await toolsView();else if(p[0]==='help')helpView();else await dashView()}
  catch(e){const m=$('#view');if(m)m.textContent='خطا: '+e.message}}
async function start(){shell();try{S.site=JSON.parse((await getFile('content/site.json')).text)}catch(e){S.site={}}ensurePages();checkDeploy();setInterval(checkDeploy,60000);S.cur='';route()}
function render(){S.cfg=S.cfg||(()=>{try{return JSON.parse(localStorage.getItem('lj_cfg')||sessionStorage.getItem('lj_cfg')||'null')}catch(e){return null}})();
  if(!S.cfg){loginView();return}
  gh('').then(r=>{fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+S.cfg.token}}).then(u=>u.json()).then(u=>{S.user=u.login||''}).finally(start)}).catch(e=>{S.cfg=null;loginView(e.status===401?'نشست منقضی شده؛ دوباره وارد شوید.':e.message)})}
window.addEventListener('hashchange',route);
window.addEventListener('beforeunload',e=>{if(S.dirty){e.preventDefault();e.returnValue=''}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(S.onSave)S.onSave()}});
render();
})();
