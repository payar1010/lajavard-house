# -*- coding: utf-8 -*-
"""سازندهٔ سایت خانه لاجورد: محتوای پوشهٔ content را به صفحات HTML در پوشهٔ _site تبدیل می‌کند.
این فایل روی گیت‌هاب (GitHub Actions) خودکار اجرا می‌شود؛ نیازی به اجرای دستی نیست."""
import os, json, re, html, shutil, datetime
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "_site")
TODAY = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
esc = html.escape

def jload(p, default=None):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except Exception as e:
        if default is not None: return default
        raise

def collection(name):
    d = os.path.join(ROOT, "content", name); items = []
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".json"):
                try: it = jload(os.path.join(d, fn)); it.setdefault("slug", fn[:-5]); items.append(it)
                except Exception as e: print("خطا در فایل", name, fn, e)
    return items

def parse_dt(s):
    s = (s or "").strip()
    for n, fmt in ((16, "%Y-%m-%dT%H:%M"), (10, "%Y-%m-%d")):
        try: return datetime.datetime.strptime(s[:n], fmt)
        except Exception: pass
    return None

def live(it):
    """منتشرشده و زمان انتشار رسیده."""
    if it.get("status", "published") != "published": return False
    d = parse_dt(it.get("date") or it.get("added") or "")
    return not (d and d > TODAY)

FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
def fa(x): return str(x).translate(FA)

SITE = jload(os.path.join(ROOT, "content", "site.json"))
SITE_URL = (SITE.get("site_url") or "").rstrip("/")
BASE = urlparse(SITE_URL).path.rstrip("/") + "/" if SITE_URL else "/"

def fix(h, r):
    return re.sub(r'(href|src|poster|content)="/(?!/)', lambda m: '%s="%s' % (m.group(1), r), h or "")

def strip_tags(h): return re.sub(r"<[^>]+>", " ", h or "")

def link_btn(b, cls="btn-primary"):
    if not b or not b.get("label") or not b.get("url"): return ""
    return '<a class="btn %s" href="%s">%s</a>' % (cls, esc(b["url"]), esc(b["label"]))

HERO_ART = '''<svg viewBox="0 0 320 400" role="img" aria-label="طرح هندسی طاق" fill="none" stroke="#B49A63" stroke-width="1.5"><path d="M40 380V170a120 120 0 0 1 240 0v210z"/><path d="M70 380V176a90 90 0 0 1 180 0v204z" opacity=".8"/><path d="M100 380V182a60 60 0 0 1 120 0v198z" opacity=".6"/><path d="M130 380V188a30 30 0 0 1 60 0v192z" opacity=".45"/><path d="M160 20v30M160 50l14 14-14 14-14-14z"/><path d="M20 380h280" stroke-width="2"/></svg>'''

# ---------- کارت‌های محتوا ----------
def article_card(a):
    img = '<img src="%s" alt="" loading="lazy">' % esc(a["image"]) if a.get("image") else ""
    return ('<article class="card post" data-cat="%s" data-text="%s">%s<span class="badge">%s</span><h3><a href="/works/%s.html">%s</a></h3><p>%s</p>'
            '<p class="meta">%s%s</p><a class="link" href="/works/%s.html">ادامهٔ مطلب</a></article>') % (
        esc(a.get("category","")), esc((a.get("title","")+" "+a.get("summary","")+" "+a.get("author","")+" "+a.get("tags","")).lower()),
        img, esc(a.get("category","")), a["slug"], esc(a.get("title","")), esc(a.get("summary","")),
        esc(a.get("author","")), (' · <time datetime="%s">%s</time>' % (esc(a.get("date","")[:10]), esc(a.get("date","")[:10])) if a.get("date") else ""), a["slug"])

def event_card(e):
    st = {"upcoming":"پیش‌رو","past":"برگزارشده","cancelled":"لغوشده"}.get(e.get("status"),"")
    return ('<article class="card"><span class="badge">%s</span><h3><a href="/events/%s.html">%s</a></h3><p>%s</p><p class="meta">%s</p><a class="link" href="/events/%s.html">جزئیات</a></article>') % (
        st, e["slug"], esc(e.get("title","")), esc(e.get("summary","")),
        '<time datetime="%s">%s</time>' % (esc(e.get("start","")), esc(e.get("start","")[:10])) if e.get("start") else "", e["slug"])

def res_card(t):
    rv = {"unreviewed":"بررسی‌نشده","reviewed":"بررسی‌شده","featured":"منتخب"}.get(t.get("review_status"),"")
    tags = "".join('<li>%s</li>' % esc(x.strip()) for x in (t.get("tags") or "").split(",") if x.strip())
    meta = " · ".join(esc(str(x)) for x in [t.get("type"), t.get("creator"), t.get("year"), t.get("language")] if x)
    link = '<a class="link" href="%s" target="_blank" rel="noopener noreferrer">مشاهدهٔ منبع اصلی</a>' % esc(t["url"]) if t.get("url") else ""
    why = '<p class="meta">%s</p>' % esc(t["why"]) if t.get("why") else ""
    return ('<article class="card" data-cat="%s" data-rv="%s" data-text="%s"><span class="badge">%s</span><h3>%s</h3><p class="meta">%s</p><p>%s</p>%s<ul class="tags">%s</ul>%s</article>') % (
        esc(t.get("subject","")), esc(t.get("review_status","")), esc((t.get("title","")+" "+t.get("creator","")+" "+t.get("summary","")+" "+t.get("tags","")).lower()),
        rv, esc(t.get("title","")), meta, esc(t.get("summary","")), why, tags, link)

def filters(cats, extra=""):
    opts = '<option value="">همهٔ دسته‌ها</option>' + "".join('<option>%s</option>' % esc(c) for c in cats)
    return ('<div class="filters" data-filter-bar><label class="sr">جست‌وجو<input type="search" placeholder="جست‌وجو…" data-q></label>'
            '<label class="sr">دسته<select data-cat>%s</select></label>%s</div>') % (opts, extra)

NO_RESULT = '<p class="empty" hidden data-none>موردی با این عبارت پیدا نشد. می‌توانید عبارت دیگری را امتحان کنید یا دسته‌بندی‌ها را مرور کنید.</p>'

# ---------- بلوک‌ها ----------
def sec(inner, cls="", wrap="wrap"):
    return '<section class="section %s"><div class="%s">%s</div></section>' % (cls, wrap, inner)

def render_block(b, ctx):
    t = b.get("type")
    if t == "hero":
        art = '<div class="art">%s</div>' % HERO_ART if b.get("show_art", True) else ""
        return ('<section class="hero"><div class="wrap grid"><div><h1>%s</h1><p>%s</p><div class="actions">%s%s</div></div>%s</div></section>') % (
            esc(b.get("title","")), esc(b.get("text","")), link_btn(b.get("btn1")), link_btn(b.get("btn2"), "btn-secondary"), art)
    if t == "richtext":
        h = '<h2>%s</h2>' % esc(b["heading"]) if b.get("heading") else ""
        st = b.get("style", "plain")
        if st.startswith("split") and h:
            return sec('<div>%s</div><div class="prose">%s</div>' % (h, b.get("html","")), "alt" if "alt" in st else "", "wrap split")
        return sec('<div class="prose">%s%s</div>' % (h, b.get("html","")), "alt" if "alt" in st else "")
    if t == "cards":
        items = "".join('<article class="card%s">%s<h3>%s</h3><p>%s</p>%s</article>' % (
            " field" if b.get("accent", True) else "",
            '<img src="%s" alt="" loading="lazy">' % esc(i["image"]) if i.get("image") else "",
            esc(i.get("title","")), esc(i.get("text","")),
            '<a class="link" href="%s">%s</a>' % (esc(i["url"]), esc(i.get("link_label") or "ادامه")) if i.get("url") else "") for i in b.get("items", []))
        head = ""
        if b.get("heading") or b.get("intro"):
            head = '<div class="sec-head">%s%s</div>' % ('<h2>%s</h2>' % esc(b["heading"]) if b.get("heading") else "", '<p class="lead">%s</p>' % esc(b["intro"]) if b.get("intro") else "")
        return sec(head + '<div class="cards cols%s">%s</div>' % (esc(str(b.get("cols", 3))), items), "alt" if b.get("style") == "alt" else "")
    if t == "latest":
        src = b.get("source", "works"); n = int(b.get("count", 3) or 3)
        lst = {"works": ctx["works"], "events": ctx["events"]}.get(src, ctx["works"])[:n]
        fn = event_card if src == "events" else article_card
        head = '<div class="sec-head"><h2>%s</h2>%s</div>' % (esc(b.get("heading","")), '<p class="lead">%s</p>' % esc(b["intro"]) if b.get("intro") else "")
        body = '<div class="cards">%s</div>' % "".join(fn(x) for x in lst) if lst else '<div class="empty">%s</div>' % esc(b.get("empty") or "هنوز موردی منتشر نشده است.")
        return sec(head + body, "alt" if b.get("style") == "alt" else "")
    if t == "cta":
        return sec('<div class="prose"><h2>%s</h2><p>%s</p>%s</div>' % (esc(b.get("heading","")), esc(b.get("text","")), link_btn(b.get("btn"))), "cta-final")
    if t == "notice":
        return sec('<div class="notice">%s</div>' % b.get("html",""))
    if t == "media":
        k = b.get("kind", "image"); cap = '<figcaption>%s</figcaption>' % esc(b["caption"]) if b.get("caption") else ""
        if k == "image" and b.get("src"):
            m = '<img src="%s" alt="%s" loading="lazy">' % (esc(b["src"]), esc(b.get("alt","")))
        elif k == "video" and b.get("src"):
            m = '<video controls preload="metadata" src="%s"%s></video>' % (esc(b["src"]), ' poster="%s"' % esc(b["poster"]) if b.get("poster") else "")
        elif k == "embed" and b.get("src"):
            m = '<div class="embed"><iframe src="%s" title="%s" allowfullscreen loading="lazy"></iframe></div>' % (esc(b["src"]), esc(b.get("alt","ویدیو")))
        elif k == "files":
            m = '<ul class="files">%s</ul>' % "".join('<li><a href="%s" download>%s</a></li>' % (esc(i.get("url","")), esc(i.get("label","فایل"))) for i in b.get("items", []))
        else: return ""
        h = '<h2>%s</h2>' % esc(b["heading"]) if b.get("heading") else ""
        return sec('<figure class="media prose">%s%s%s</figure>' % (h, m, cap))
    if t == "faq":
        its = "".join('<details><summary>%s</summary><div>%s</div></details>' % (esc(i.get("q","")), i.get("a","")) for i in b.get("items", []))
        h = '<h2>%s</h2>' % esc(b["heading"]) if b.get("heading") else ""
        return sec('<div class="prose faq">%s%s</div>' % (h, its))
    if t == "html":
        return sec(b.get("html", ""))
    return ""

# ---------- قالب کلی ----------
def layout(path, title, desc, body, og=None, noindex=False):
    r = "../" * path.count("/")
    cur = "/" + path
    nav = ""
    for m in SITE.get("menu", []):
        c = ' aria-current="page"' if m.get("url") == cur else ""
        nav += '<a href="%s"%s>%s</a>' % (esc(m["url"]), c, esc(m["label"]))
    mb = SITE.get("menu_button")
    if mb and mb.get("url"): nav += '<a class="btn btn-primary" href="%s">%s</a>' % (esc(mb["url"]), esc(mb["label"]))
    ml = SITE.get("members_link")
    if ml and ml.get("url"): nav += '<a class="members" href="%s">%s</a>' % (esc(ml["url"]), esc(ml["label"]))
    logo = SITE.get("logo") or ""
    limg = '<img src="%s" alt="" onerror="this.remove()">' % esc(logo) if logo else ""
    cols = ""
    for c in SITE.get("footer_columns", []):
        cols += '<nav aria-label="%s"><h2>%s</h2><ul>%s</ul></nav>' % (esc(c.get("title","")), esc(c.get("title","")),
            "".join('<li><a href="%s">%s</a></li>' % (esc(l["url"]), esc(l["label"])) for l in c.get("links", [])))
    soc = "".join('<li><a href="%s" rel="noopener noreferrer" target="_blank">%s</a></li>' % (esc(s["url"]), esc(s["label"])) for s in SITE.get("social", []) if s.get("url"))
    if soc: cols += '<nav aria-label="شبکه‌ها"><h2>پیوندها</h2><ul>%s</ul></nav>' % soc
    name = SITE.get("name", "")
    ft = title if title.startswith(name) else "%s | %s" % (title, name)
    canon = '<link rel="canonical" href="%s/%s">' % (SITE_URL, esc(path)) if SITE_URL else ""
    ogm = ('<meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta property="og:type" content="website">%s' % (
        esc(ft), esc(desc), '<meta property="og:image" content="%s%s">' % (SITE_URL, og) if og and SITE_URL else ""))
    out = '''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title><meta name="description" content="%s">%s%s%s<meta name="theme-color" content="#142B4A">
<link rel="icon" href="%s"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/style.css"><link rel="stylesheet" href="/assets/css/theme.css">%s</head><body>
<a class="skip" href="#main">رفتن به محتوای اصلی</a>
<header class="site-header"><div class="wrap bar"><a class="brand" href="/index.html">%s<span>%s</span></a>
<button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="منو"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
<nav class="nav" id="site-nav" aria-label="منوی اصلی">%s</nav></div></header>
<main id="main">%s</main>
<footer class="site-footer"><div class="wrap"><div class="cols"><div><div class="brand" style="color:#F5F1E8;margin-bottom:12px">%s<span>%s</span></div><p>%s</p><p class="slogan">%s</p></div>%s</div>
<p class="copy">© <span id="year"></span> %s</p></div></footer><script src="/assets/js/main.js"></script></body></html>''' % (
        esc(ft), esc(desc), canon, '<meta name="robots" content="noindex">' if noindex else "", ogm, esc(logo or "/assets/img/logo1.png"),
        SITE.get("head_code", ""), limg, esc(name), nav, body, limg, esc(name), esc(SITE.get("slogan","")), esc(SITE.get("footer_slogan","")),
        cols, esc(SITE.get("copyright","")))
    out = fix(out, r)
    p = os.path.join(OUT, path); os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(out)

def head(title, intro="", crumbs=""):
    return '<div class="page-head"><div class="wrap">%s<h1>%s</h1>%s</div></div>' % (
        '<div class="crumbs">%s</div>' % crumbs if crumbs else "", esc(title), '<p class="lead">%s</p>' % esc(intro) if intro else "")

def add_ids(h):
    n = [0]
    def rep(m):
        n[0] += 1
        if "id=" in m.group(1): return m.group(0)
        return '<h2%s id="s%d">' % (m.group(1), n[0])
    return re.sub(r"<h2([^>]*)>", rep, h or "")

# ---------- ساخت ----------
def main():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    for d in ("assets", "admin"):
        if os.path.isdir(os.path.join(ROOT, d)): shutil.copytree(os.path.join(ROOT, d), os.path.join(OUT, d))
    open(os.path.join(OUT, ".nojekyll"), "w").close()
    c = SITE.get("colors", {}); names = {"lapis":"lapis","night":"night","ivory":"ivory","card":"card","gold":"gold","text":"text","muted":"muted","line":"line","error":"error","ok":"ok"}
    css = ":root{%s}" % "".join("--%s:%s;" % (k, v) for k, v in c.items() if k in names and re.match(r"^#[0-9a-fA-F]{3,8}$", str(v)))
    with open(os.path.join(OUT, "assets/css/theme.css"), "w") as f: f.write(css)

    works = sorted([w for w in collection("works") if live(w)], key=lambda x: x.get("date",""), reverse=True)
    events = sorted([e for e in collection("events") if e.get("status","upcoming") != "draft"], key=lambda x: x.get("start",""), reverse=True)
    treasury = sorted([t for t in collection("treasury") if t.get("status","published") == "published"], key=lambda x: (x.get("review_status") != "featured", x.get("title","")))
    ctx = {"works": works, "events": events}
    pages = [p for p in collection("pages") if p.get("status","published") == "published"]
    pmap = {p["slug"]: p for p in pages}
    urls = []

    for p in pages:
        slug = p["slug"]; path = slug + ".html"; tpl = p.get("template", "page")
        body = "".join(render_block(b, ctx) for b in p.get("blocks", []))
        crumbs = ""
        if "/" in slug:
            par = slug.rsplit("/", 1)[0]
            crumbs = '<a href="/index.html">خانه</a> / %s%s' % ('<a href="/%s.html">%s</a> / ' % (par, esc(pmap[par]["title"])) if par in pmap else "", esc(p["title"]))
        pre = "" if tpl == "home" else head(p["title"], p.get("intro",""), crumbs)
        extra = ""
        if tpl == "works":
            extra = sec(filters(sorted({w.get("category","") for w in works if w.get("category")})) +
                (('<div class="cards" data-list>%s</div>' % "".join(article_card(w) for w in works)) if works else '<div class="empty">نوشته‌های خانه لاجورد به‌تدریج در این بخش منتشر خواهند شد.</div>') + NO_RESULT)
        elif tpl == "treasury":
            rv = '<label class="sr">وضعیت<select data-rv><option value="">همهٔ وضعیت‌ها</option><option value="featured">منتخب</option><option value="reviewed">بررسی‌شده</option><option value="unreviewed">بررسی‌نشده</option></select></label>'
            extra = sec(filters(SITE.get("treasury_categories", []), rv) +
                (('<div class="cards" data-list>%s</div>' % "".join(res_card(t) for t in treasury)) if treasury else '<div class="empty">منابع گنجینه به‌تدریج در این بخش افزوده خواهند شد.</div>') + NO_RESULT)
        elif tpl == "events":
            up = [e for e in events if e.get("status") == "upcoming"][::-1]; past = [e for e in events if e.get("status") == "past"]
            blk = lambda title, l: '<h2>%s</h2><div class="cards">%s</div><br>' % (title, "".join(event_card(e) for e in l)) if l else ""
            extra = sec(blk("رویدادهای پیش‌رو", up) + blk("رویدادهای گذشته", past)) if (up or past) else sec('<div class="empty">رویدادهای خانه لاجورد پس از اعلام در این بخش نمایش داده می‌شوند.</div>')
        layout(path, p.get("seo_title") or p["title"], p.get("description") or p.get("intro") or "", pre + body + extra, p.get("image"))
        urls.append(path)

    for w in works:
        path = "works/%s.html" % w["slug"]
        words = len(strip_tags(w.get("body","")).split()); mins = max(1, round(words / 180))
        h2s = re.findall(r"<h2[^>]*>(.*?)</h2>", w.get("body",""), re.S)
        body_html = add_ids(w.get("body","")); toc = ""
        if len(h2s) >= 3:
            toc = '<details class="toc"><summary>فهرست مطالب</summary><ol>%s</ol></details>' % "".join('<li><a href="#s%d">%s</a></li>' % (i+1, strip_tags(t)) for i, t in enumerate(h2s))
        rel = [x for x in works if x["slug"] != w["slug"] and x.get("category") == w.get("category")][:3]
        relh = '<section class="section alt"><div class="wrap"><h2>مطالب مرتبط</h2><div class="cards">%s</div></div></section>' % "".join(article_card(x) for x in rel) if rel else ""
        upd = ' · آخرین ویرایش: <time datetime="%s">%s</time>' % (esc(w["updated"][:10]), esc(w["updated"][:10])) if w.get("updated") else ""
        body = head(w.get("title",""), w.get("summary",""), '<a href="/index.html">خانه</a> / <a href="/works.html">اندیشه‌ها و آثار</a> / %s' % esc(w.get("category",""))) + \
            '<article class="section"><div class="wrap article prose"><p class="meta">%s%s · زمان مطالعه: %s دقیقه%s</p>%s%s%s%s%s<p><a class="link" href="/works.html">بازگشت به آرشیو</a></p></div></article>%s' % (
            esc(w.get("author","")), (' · <time datetime="%s">%s</time>' % (esc(w["date"][:10]), esc(w["date"][:10]))) if w.get("date") else "", fa(mins), upd,
            '<img class="hero-img" src="%s" alt="">' % esc(w["image"]) if w.get("image") else "", toc, body_html,
            '<h2>منابع</h2>%s' % w["sources"] if w.get("sources") else "", "", relh)
        layout(path, w.get("seo_title") or w.get("title",""), w.get("seo_desc") or w.get("summary",""), body, w.get("image"))
        urls.append(path)

    for e in events:
        if e.get("status") == "draft": continue
        path = "events/%s.html" % e["slug"]
        rows = [("هدف", e.get("goal")), ("محورهای بحث", e.get("topics")), ("زمان", e.get("start")), ("مدت", e.get("duration")), ("شیوهٔ برگزاری", e.get("format")),
                ("دسترسی", {"public":"عمومی","private":"خصوصی"}.get(e.get("visibility"), "")), ("شرایط ثبت‌نام", e.get("conditions")), ("برگزارکننده", e.get("organizer"))]
        dl = "".join("<dt>%s</dt><dd>%s</dd>" % (k, esc(v)) for k, v in rows if v)
        reg = '<p>%s</p>' % link_btn({"label":"ثبت‌نام","url":e["register_url"]}) if e.get("register_url") and e.get("status") == "upcoming" else ""
        rep = '<h2>گزارش و جمع‌بندی</h2>%s' % e["report"] if e.get("report") else ""
        body = head(e.get("title",""), e.get("summary",""), '<a href="/index.html">خانه</a> / <a href="/events.html">رویدادها</a> / %s' % esc(e.get("title",""))) + \
            '<section class="section"><div class="wrap prose">%s<dl class="info">%s</dl>%s%s<p><a class="link" href="/events.html">بازگشت به رویدادها</a></p></div></section>' % (
            '<img class="hero-img" src="%s" alt="">' % esc(e["image"]) if e.get("image") else "", dl, reg, rep)
        layout(path, e.get("title",""), e.get("summary",""), body, e.get("image")); urls.append(path)

    layout("404.html", "صفحه پیدا نشد", "صفحهٔ مورد نظر پیدا نشد.", head("صفحه‌ای که دنبالش بودید پیدا نشد", "ممکن است نشانی تغییر کرده باشد.") +
           '<section class="section"><div class="wrap"><a class="btn btn-primary" href="/index.html">بازگشت به صفحهٔ نخست</a></div></section>', noindex=True)
    # 404 باید نشانی‌های مطلق داشته باشد
    p404 = os.path.join(OUT, "404.html"); s = open(p404, encoding="utf-8").read()
    s = re.sub(r'(href|src)="(assets/|index\.html)', lambda m: '%s="%s%s' % (m.group(1), BASE, m.group(2)), s)
    open(p404, "w", encoding="utf-8").write(s)

    if SITE_URL:
        sm = "".join("<url><loc>%s/%s</loc></url>" % (SITE_URL, u) for u in urls)
        open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">%s</urlset>' % sm)
    open(os.path.join(OUT, "robots.txt"), "w").write("User-agent: *\nDisallow: /admin/\n" + ("Sitemap: %s/sitemap.xml\n" % SITE_URL if SITE_URL else ""))
    print("ساخت کامل شد: %d صفحه" % len(urls))

if __name__ == "__main__": main()
