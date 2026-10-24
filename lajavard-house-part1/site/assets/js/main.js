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
