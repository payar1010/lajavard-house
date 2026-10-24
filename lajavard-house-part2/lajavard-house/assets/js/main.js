(function(){
  var btn=document.getElementById('menu-btn'),nav=document.getElementById('site-nav'),hdr=document.querySelector('.site-header');
  function close(){nav.classList.remove('open');btn.setAttribute('aria-expanded','false')}
  btn.addEventListener('click',function(e){e.stopPropagation();var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o)});
  document.addEventListener('click',function(e){if(!nav.contains(e.target)&&e.target!==btn)close()});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  window.addEventListener('scroll',function(){hdr.classList.toggle('compact',window.scrollY>40)},{passive:true});
  var y=document.getElementById('year');if(y)y.textContent=new Intl.DateTimeFormat('fa-IR',{year:'numeric'}).format(new Date());
})();

(function(){
  try{var f=new Intl.DateTimeFormat('fa-IR',{dateStyle:'long'});
    document.querySelectorAll('time[datetime]').forEach(function(t){var d=new Date(t.getAttribute('datetime'));if(!isNaN(d))t.textContent=f.format(d)})}catch(e){}
  var bar=document.querySelector('[data-filter-bar]');if(!bar)return;
  var list=document.querySelector('[data-list]'),none=document.querySelector('[data-none]');if(!list)return;
  var q=bar.querySelector('[data-q]'),c=bar.querySelector('[data-cat]'),r=bar.querySelector('[data-rv]');
  function run(){var n=0,s=q.value.trim().toLowerCase();
    list.querySelectorAll('.card').forEach(function(el){
      var ok=(!s||(el.dataset.text||'').indexOf(s)>-1)&&(!c.value||el.dataset.cat===c.value)&&(!r||!r.value||el.dataset.rv===r.value);
      el.hidden=!ok;if(ok)n++});
    if(none)none.hidden=n>0}
  [q,c,r].forEach(function(x){if(x)x.addEventListener('input',run)});
})();
