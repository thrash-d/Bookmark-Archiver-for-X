(function (root) {
  function build(records, supportUrl) {
    const data = JSON.stringify(records).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X Bookmarks</title>
<style>
  :root {
    --bg:#0f1419; --panel:#16202a; --line:#242e38; --line-strong:#3a4652;
    --fg:#e7e9ea; --muted:#8b98a5; --link:#1d9bf0;
    --radius:6px; --radius-sm:4px;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif; font-variant-numeric:tabular-nums; }
  header { position:sticky; top:0; background:var(--bg); border-bottom:1px solid var(--line); padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; z-index:10; max-width:720px; margin:0 auto; }
  header h1 { font-size:14px; margin:0; font-weight:600; }
  #count { color:var(--muted); font-size:12px; }
  input, select { background:var(--panel); border:1px solid var(--line); color:var(--fg); border-radius:var(--radius); padding:6px 10px; font:inherit; font-size:13px; }
  input:focus, select:focus { outline:2px solid var(--link); outline-offset:-1px; }
  input { flex:1; min-width:160px; }
  main { max-width:720px; margin:0 auto; padding:16px; }
  #list { border:1px solid var(--line); border-radius:var(--radius); }
  .card { padding:14px 16px; border-bottom:1px solid var(--line); }
  .card:last-child { border-bottom:0; }
  .meta { display:flex; gap:10px; align-items:baseline; font-size:12px; margin-bottom:4px; flex-wrap:wrap; }
  .handle { color:var(--fg); font-weight:500; text-decoration:none; }
  .handle:hover { text-decoration:underline; }
  .date, .qt, .folder { color:var(--muted); }
  .folder::before { content:"\\00b7"; margin-right:10px; }
  .text { white-space:pre-wrap; word-wrap:break-word; margin:2px 0 10px; }
  .media { display:grid; gap:6px; }
  .media.n2 { grid-template-columns:1fr 1fr; }
  .media img, .media video { width:100%; border-radius:var(--radius-sm); border:1px solid var(--line); display:block; }
  .missing { color:var(--muted); font-size:12px; padding:4px 0; }
  a.src { color:var(--link); text-decoration:none; font-size:12px; }
  a.src:hover { text-decoration:underline; }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:24px 16px 40px; }
  footer a { color:var(--link); }
  .empty { color:var(--muted); text-align:center; padding:24px; }
</style>
</head>
<body>
<header>
  <h1>X Bookmarks</h1>
  <span id="count"></span>
  <input id="q" placeholder="Search text or @handle…">
  <select id="filter">
    <option value="all">All</option>
    <option value="photo">Photos</option>
    <option value="video">Videos</option>
    <option value="text">Text only</option>
  </select>
  <select id="folderFilter"></select>
</header>
<main id="list"></main>
<footer>
  Archived locally with Bookmark Archiver for X. Nothing left your machine.
  <br>Like it? <a href="${supportUrl}" target="_blank" rel="noopener">Buy me a coffee ☕</a>
</footer>
<script id="data" type="application/json">${data}</script>
<script>
  const DATA = JSON.parse(document.getElementById("data").textContent);
  const list = document.getElementById("list");
  const q = document.getElementById("q");
  const filter = document.getElementById("filter");
  const folderFilter = document.getElementById("folderFilter");
  const countEl = document.getElementById("count");

  const folders = Array.from(new Set(DATA.map(r => r.folder).filter(Boolean))).sort();
  folderFilter.innerHTML = '<option value="all">All folders</option>'
    + (folders.length ? '<option value="__none">(No folder)</option>' : '')
    + folders.map(f => '<option value="'+esc(f)+'">'+esc(f)+'</option>').join("");
  folderFilter.style.display = folders.length ? "" : "none";
  function esc(s){ return (s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function hasType(r,t){ return (r.media||[]).some(m => t==="photo" ? m.type==="photo" : m.type==="video"||m.type==="video_hls"); }
  function mediaHtml(r){
    const ms = r.media||[];
    if(!ms.length) return "";
    const cls = ms.length>1 ? "media n2" : "media";
    const items = ms.map(m => {
      if(m.file && m.type==="photo") return '<img loading="lazy" src="media/'+encodeURIComponent(m.file)+'">';
      if(m.file) return '<video controls preload="none" src="media/'+encodeURIComponent(m.file)+'"></video>';
      return '<div class="missing">Not downloaded — <a class="src" href="'+esc(r.url)+'" target="_blank" rel="noopener">view on X</a></div>';
    }).join("");
    return '<div class="'+cls+'">'+items+'</div>';
  }
  function render(){
    const term = q.value.trim().toLowerCase();
    const f = filter.value;
    const fld = folderFilter.value;
    let n=0;
    const html = DATA.filter(r=>{
      if(f==="photo" && !hasType(r,"photo")) return false;
      if(f==="video" && !hasType(r,"video")) return false;
      if(f==="text" && (r.media||[]).length) return false;
      if(fld==="__none" && r.folder) return false;
      if(fld!=="all" && fld!=="__none" && r.folder!==fld) return false;
      if(term && !((r.text||"").toLowerCase().includes(term) || (r.screen_name||"").toLowerCase().includes(term))) return false;
      return true;
    }).map(r=>{
      n++;
      return '<div class="card">'
        + '<div class="meta"><a class="handle" href="https://x.com/'+esc(r.screen_name)+'" target="_blank" rel="noopener">@'+esc(r.screen_name)+'</a>'
        + '<span class="date">'+esc(r.created_at)+'</span>'
        + (r.quoted_of ? '<span class="qt">↺ quotes @'+esc(r.quoted_of)+'</span>' : '')
        + (r.folder ? '<span class="folder">'+esc(r.folder)+'</span>' : '')
        + '</div>'
        + (r.text ? '<div class="text">'+esc(r.text)+'</div>' : '')
        + mediaHtml(r)
        + '<div style="margin-top:8px"><a class="src" href="'+esc(r.url)+'" target="_blank" rel="noopener">Open on X ↗</a></div>'
        + '</div>';
    }).join("");
    list.innerHTML = html || '<div class="empty">No matches.</div>';
    countEl.textContent = n + " of " + DATA.length;
  }
  q.addEventListener("input", render);
  filter.addEventListener("change", render);
  folderFilter.addEventListener("change", render);
  render();
</script>
</body>
</html>`;
  }

  const api = { build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.XBAGallery = api;
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this));
