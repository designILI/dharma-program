import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const contentRoot = path.join(root, 'content');
const lessonsDir = path.join(root, 'lessons');
fs.mkdirSync(lessonsDir, { recursive: true });

const esc = (s='') => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const inline = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g,'<em>$1</em>')
  .replace(/`([^`]+)`/g,'<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');

function markdown(md, {skipFirst=0}={}) {
  const lines = md.split(/\r?\n/).slice(skipFirst); let out='', para=[], list=null, quote=[];
  const flushPara=()=>{if(para.length){out+=`<p>${inline(para.join(' '))}</p>`;para=[]}};
  const flushList=()=>{if(list){out+=`</${list}>`;list=null}};
  const flushQuote=()=>{if(quote.length){out+=`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`;quote=[]}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trimEnd(), t=line.trim();
    if(t.startsWith('|') && i+1<lines.length && /^\s*\|?\s*:?-+/.test(lines[i+1])){
      flushPara();flushList();flushQuote();const heads=t.replace(/^\||\|$/g,'').split('|').map(x=>x.trim());i+=2;const rows=[];
      while(i<lines.length && lines[i].trim().startsWith('|')){rows.push(lines[i].trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));i++}i--;
      out+='<table><thead><tr>'+heads.map(x=>`<th>${inline(x)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>`<td>${inline(x)}</td>`).join('')+'</tr>').join('')+'</tbody></table>';continue;
    }
    if(t.startsWith('>')){flushPara();flushList();quote.push(t.replace(/^>\s?/,''));continue}else flushQuote();
    const h=t.match(/^(#{2,4})\s+(.+)$/);if(h){flushPara();flushList();const n=h[1].length;const id=slug(h[2]);out+=`<h${n} id="${id}">${inline(h[2])}</h${n}>`;continue}
    if(/^---+$/.test(t)){flushPara();flushList();out+='<hr>';continue}
    const ul=t.match(/^[-*]\s+(.+)$/), ol=t.match(/^\d+\.\s+(.+)$/);
    if(ul||ol){flushPara();const type=ul?'ul':'ol';if(list!==type){flushList();out+=`<${type}>`;list=type}out+=`<li>${inline((ul||ol)[1])}</li>`;continue}else flushList();
    if(/^\*\*[^*]+:\*\*/.test(t)){flushPara();out+=`<p class="label-block">${inline(t)}</p>`;continue}
    if(!t){flushPara();continue}para.push(t);
  }flushPara();flushList();flushQuote();return out;
}

function shell(title, body, nav='') {return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | The Dharma Program</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&family=Lora:ital,wght@0,400;1,400&display=swap" rel="stylesheet"><link rel="stylesheet" href="${nav}assets/curriculum.css"></head><body><nav class="nav"><a class="nav-logo" href="${nav}index.html">The Dharma Program</a><div class="nav-links"><a href="${nav}index.html">Overview</a><a href="${nav}grade-1.html">Grade 1</a><a href="${nav}grade-2.html">Grade 2</a><a href="${nav}grade-3.html">Grade 3</a><a href="${nav}grade-4.html">Grade 4</a><a href="${nav}grade-5.html">Grade 5</a><a href="${nav}grade-6.html">Grade 6</a><a href="${nav}grade-7.html">Grade 7</a></div></nav>${body}</body></html>`}

const all=[];
for(let grade=1;grade<=7;grade++){
  const dir=path.join(contentRoot,`Grade-${grade}`);
  for(const file of fs.readdirSync(dir).filter(f=>/^G\d+\.U\d+\.C\d+.*\.md$/.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
    const md=fs.readFileSync(path.join(dir,file),'utf8');const code=file.match(/G(\d+)\.U(\d+)\.C(\d+)/);const [,g,u,c]=code;
    const title=(md.match(/^#\s+.+?—\s+(.+)$/m)?.[1]||file.replace(/\.md$/,'').split('_')[1].replaceAll('-',' ')).trim();
    const duration=md.match(/\*Duration:\s*([^*]+)\*/i)?.[1].trim()||'40 minutes';
    const cognitive=md.match(/\*\*Cognitive Principle Featured:\*\*\s*([^—\n]+)/i)?.[1].trim()||'See lesson plan';
    const bloom=md.match(/\*\*Bloom's Level:\*\*\s*([^—\n]+)/i)?.[1].trim()||'See lesson plan';
    const summary=md.match(/\*\*Topic \(Concrete and Invisible\):\*\*\s*([^\n]+)/i)?.[1].trim()||`Complete teaching plan for ${title}.`;
    const filename=`g${g}-u${u}-c${c}.html`;all.push({grade:+g,unit:+u,lesson:+c,title,duration,cognitive,bloom,summary,filename,md});
  }
}

for(let i=0;i<all.length;i++){
  const x=all[i], same=all.filter(y=>y.grade===x.grade), pos=same.findIndex(y=>y.filename===x.filename), prev=same[pos-1],next=same[pos+1];
  const rendered=markdown(x.md,{skipFirst:3});const heads=[...rendered.matchAll(/<h[23] id="([^"]+)">([^<]+)<\/h[23]>/g)].map(m=>({id:m[1],label:m[2]}));
  const body=`<div class="wrap"><header class="hero"><div class="eyebrow">Grade ${x.grade} &nbsp;·&nbsp; Unit ${x.unit} &nbsp;·&nbsp; Class ${x.lesson}</div><h1>${esc(x.title)}</h1><p class="summary">${inline(x.summary)}</p><div class="meta-grid"><div class="meta-item"><span class="meta-label">Duration</span><span class="meta-value">${esc(x.duration)}</span></div><div class="meta-item"><span class="meta-label">Cognitive principle</span><span class="meta-value">${esc(x.cognitive)}</span></div><div class="meta-item"><span class="meta-label">Bloom's level</span><span class="meta-value">${esc(x.bloom)}</span></div><div class="meta-item"><span class="meta-label">Lesson</span><span class="meta-value">G${x.grade}.U${x.unit}.C${x.lesson}</span></div></div></header><div class="layout"><article class="content">${rendered}</article><aside class="toc"><strong>In this lesson</strong>${heads.map(h=>`<a href="#${h.id}">${h.label}</a>`).join('')}</aside></div><div class="pager">${prev?`<a href="${prev.filename}">← ${esc(prev.title)}</a>`:'<span></span>'}<span>Grade ${x.grade} · ${pos+1} of ${same.length}</span>${next?`<a href="${next.filename}">${esc(next.title)} →</a>`:`<a href="../grade-${x.grade}.html">Grade ${x.grade} overview →</a>`}</div></div>`;
  fs.writeFileSync(path.join(lessonsDir,x.filename),shell(x.title,body,'../'));
}

for(let grade=1;grade<=7;grade++){
  const items=all.filter(x=>x.grade===grade), overviewFile=path.join(contentRoot,`Grade-${grade}`,`GRADE-${grade}-OVERVIEW.md`), overviewMd=fs.readFileSync(overviewFile,'utf8');
  const rawTitle=overviewMd.match(/^#\s+(.+)$/m)?.[1]||`Grade ${grade}`;const subtitle=overviewMd.match(/^##\s+(.+)$/m)?.[1]||'';
  const titleMap={1:'The Circle of Kindness',2:'The Widening Circle',3:'Compassion in Action',4:'The Language of Ritual',5:'The Wheel of Existence',6:'Death & What It Asks of Us',7:'Teaching as Practice'};const ageMap={1:'6–7',2:'7–8',3:'8–9',4:'9–10',5:'10–11',6:'11–12',7:'12–13'};
  const unitTitleMap={
    1:{1:'Om Mani Padme Hung & Prayer Flags',2:'The Giving Tree & Unconditional Love',3:"Guru Rinpoche's Birth",4:'Patience & the Bugs',5:"Buddha's Birth",6:'Jataka Stories'},
    2:{1:'Prayer Flags & Expanding Compassion',2:'The Life of the Buddha',3:'Guru Rinpoche, Deeper'},
    3:{1:'Tsethar — Life Release',2:'Kindness in Action',3:'Saga Dawa'},
    4:{1:'The Seven-Bowl Offering',2:'Making Tormas',3:'Instruments & Ritual Objects'},
    5:{1:'The Wheel of Life',2:'The Six Realms',3:'Padmasambhava & the Coming of the Dharma'},
    6:{1:'Rebirth: Three Frameworks',2:'The Bardo',3:'White Tara & Green Tara',4:'Cham Dance'},
    7:{1:'Empathy & Responsibility',2:'Near-Peer Teaching Project',3:'Medicine Buddha',4:'Panglhabsol / Protector Practice'}
  };
  const units=[...new Set(items.map(x=>x.unit))];
  const blocks=units.map(u=>{const list=items.filter(x=>x.unit===u);return `<section class="unit-block"><div class="unit-head"><div><span class="section-label">Unit ${u} · ${list.length} classes</span><h2>${esc(unitTitleMap[grade][u])}</h2></div><ul class="lesson-list">${list.map(x=>`<li><a href="lessons/${x.filename}"><span class="lesson-code">C${x.lesson}</span><span class="lesson-title">${esc(x.title)}</span><span class="lesson-time">${esc(x.duration)}</span></a></li>`).join('')}</ul></div></section>`}).join('');
  const body=`<div class="wrap"><header class="grade-hero"><div class="eyebrow">Grade ${grade} · Ages ${ageMap[grade]} · ${items.length} lessons</div><h1>Grade ${grade} —<br><em>${titleMap[grade]}</em></h1><p class="grade-summary">${inline(subtitle.replace(/^Dharma Program\s*[|·]\s*/,''))}</p></header>${blocks}<section class="overview"><details><summary>Read the complete Grade ${grade} teaching overview</summary><article class="content">${markdown(overviewMd,{skipFirst:2})}</article></details></section><div class="pager"><a href="${grade>1?`grade-${grade-1}.html`:'index.html'}">← ${grade>1?`Grade ${grade-1}`:'All grades'}</a><span>${items.length} complete lessons</span>${grade<7?`<a href="grade-${grade+1}.html">Grade ${grade+1} →</a>`:'<a href="index.html">All grades →</a>'}</div></div>`;
  fs.writeFileSync(path.join(root,`grade-${grade}.html`),shell(rawTitle,body));
}

console.log(`Generated ${all.length} lesson pages and 7 grade pages.`);
