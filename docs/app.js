"use strict";
/* 2027 国考选岗助手 —— 纯前端筛选/检索/导出 */
const S = { jobs:null, catalog:null, rows:[], page:1, PAGE:18, favs:new Set(), cmp:new Set(), favView:false, lastMatcher:null, index:{} };
const $ = id => document.getElementById(id);
const esc = t => (t==null?"":String(t)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- 工具 ---------- */
function toHalf(s){return (s||"").replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));}
function norm(s){return toHalf(s).replace(/\s+/g,"").replace(/[（(]/g,"(").replace(/[）)]/g,")").toLowerCase();}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2200);}
function optName(key,i){const v=S.jobs.opts[key][i];return v==null?"—":v;}
function txt(it,k){
  switch(k){
    case "deptId":return S.jobs.deptOpts[it.deptId]||"—";
    case "orgNatureId":return optName("orgNature",it.orgNatureId);
    case "attrId":return optName("attr",it.attrId);
    case "distId":return optName("dist",it.distId);
    case "orgLevelId":return optName("orgLevel",it.orgLevelId);
    case "examTypeId":return optName("examType",it.examTypeId);
    case "eduId":return optName("edu",it.eduId);
    case "degreeId":return optName("degree",it.degreeId);
    case "polId":return optName("pol",it.polId);
    case "grassId":return optName("grass",it.grassId);
    case "proTestId":return optName("proTest",it.proTestId);
    case "ratioId":return optName("ratio",it.ratioId);
    case "provId":return S.jobs.provOpts[it.provId]||"—";
    default:return it[k]!=null&&it[k]!==""?String(it[k]):"—";
  }
}
const DETAIL=[["deptCode","部门代码"],["deptId","部门名称"],["office","用人司局"],["orgNatureId","机构性质"],
 ["position","招考职位"],["attrId","职位属性"],["distId","职位分布"],["intro","职位简介"],["jobCode","职位代码"],
 ["orgLevelId","机构层级"],["examTypeId","考试类别"],["headcount","招考人数"],["major","专业要求"],["eduId","学历"],
 ["degreeId","学位"],["polId","政治面貌"],["grassId","基层工作最低年限"],["grassProj","服务基层项目工作经历"],
 ["proTestId","面试专业能力测试"],["ratioId","面试人员比例"],["workLoc","工作地点"],["hukouLoc","落户地点"],
 ["remark","备注"],["website","部门网站"],["tel","咨询电话"]];

/* ---------- 加载 ---------- */
async function loadData(){
  try{
    const [j,c]=await Promise.all([
      fetch("data/jobs.json").then(r=>{if(!r.ok)throw 0;return r.json();}),
      fetch("data/catalog.json").then(r=>{if(!r.ok)throw 0;return r.json();})
    ]);
    S.jobs=j; S.catalog=c;
    j.items.forEach(it=>S.index[it.jobCode]=it);
    init();
  }catch(e){
    $("resultStat").textContent="数据加载失败：请通过本地服务器或 GitHub Pages 网址访问，不要直接双击 index.html 打开。";
  }
}

/* ---------- 初始化 ---------- */
function init(){
  const J=S.jobs;
  J.provOpts.forEach((p,i)=>{const o=document.createElement("option");o.value=i;o.textContent=p;$("provSel").appendChild(o);});
  [["polSel","pol"],["grassSel","grass"],["examSel","examType"],["levelSel","orgLevel"],["attrSel","attr"],["distSel","dist"],["proTestSel","proTest"]]
    .forEach(([sel,key])=>J.opts[key].forEach((v,i)=>{const o=document.createElement("option");o.value=i;o.textContent=v;$(sel).appendChild(o);}));
  J.deptOpts.forEach(d=>{const o=document.createElement("option");o.value=d;$("deptList").appendChild(o);});
  try{S.favs=new Set(JSON.parse(localStorage.getItem("gk_favs")||"[]"));}catch(e){}
  bindEvents();
  if(!readHash()) apply();
  updateBadges();
}

function getForm(){
  const v=id=>$(id).value.trim();
  return {
    major:v("majorInput"), edu:$("myEdu").value, prov:$("provSel").value, city:v("cityInput"),
    dept:v("deptInput"), kw:v("kwInput"), pol:$("polSel").value, grass:$("grassSel").value,
    exam:$("examSel").value, level:$("levelSel").value, attr:$("attrSel").value, dist:$("distSel").value,
    proTest:$("proTestSel").value, hc:v("hcInput"), tax:$("taxOnly").checked, noGrass:$("noGrass").checked
  };
}

/* ---------- 专业匹配引擎 ---------- */
function buildMatcher(qRaw){
  const cat=S.catalog;
  const qn=norm(qRaw);
  const cats=new Set(); let matchedName="";
  if(qn){
    if(cat.majorIndex[qRaw.trim()]){cat.majorIndex[qRaw.trim()].forEach(id=>cats.add(id));matchedName=qRaw.trim();}
    for(const name in cat.majorIndex){
      const nn=norm(name);
      if(nn.length>=2&&(nn.includes(qn)||(qn.length>=2&&qn.includes(nn)))){
        cat.majorIndex[name].forEach(id=>cats.add(id)); if(!matchedName)matchedName=name;
      }
    }
    cat.categories.forEach(c=>{ if(norm(c.name).includes(qn)) cats.add(c.id); });
  }
  const catNames=[];
  cats.forEach(id=>{
    const c=cat.categories.find(x=>x.id===id); if(!c)return;
    const n=norm(c.name); catNames.push({raw:c.name,n});
    if(c.name==="英语相关专业")catNames.push({raw:"英语相关专业",n:"英语"});
    if(c.name==="其他外语语种")catNames.push({raw:"其他外语语种",n:"外语"});
  });
  return {raw:qRaw.trim(),qn,cats,catNames,matchedName,isCode:/^[0-9a-z]{4,}$/.test(qn)};
}

function matchMajor(it,m){
  const tn=norm(it.major);
  const reasons=[]; const hl=[];
  // 1) 代码命中
  if(m.isCode){
    const re=new RegExp("(?<![0-9a-z])"+m.qn.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![0-9a-z])");
    if(re.test(tn)){reasons.push({lv:"direct",t:"专业代码匹配"});hl.push({t:m.qn,lv:"direct"});}
  }
  // 2) 专业名称直接命中
  if(m.qn.length>=2 && tn.includes(m.qn)){
    if(!reasons.length)reasons.push({lv:"direct",t:"专业名称直接命中"});
    hl.push({t:m.qn,lv:"direct"});
  }
  // 3) 所属大类命中
  m.catNames.forEach(c=>{
    if(c.n.length>=2&&tn.includes(c.n)){
      if(!reasons.some(r=>r.lv==="direct"))reasons.push({lv:"cat",t:"所属大类「"+c.raw+"」"});
      hl.push({t:c.n,lv:"cat"});
    }
  });
  // 4) 拆分单元宽松双向包含
  if(!reasons.length&&m.qn.length>=2){
    const units=toHalf(it.major).split(/[，,、；;\n/／]/);
    for(const u of units){
      const core=norm(u).replace(/\(.*?\)/g,"");
      if(core.length>=2&&(core.includes(m.qn)||m.qn.includes(core))){
        reasons.push({lv:"fuzzy",t:"相近专业「"+u.replace(/\(.*?\)/g,"").trim()+"」"});
        hl.push({t:core,lv:"fuzzy"}); break;
      }
    }
  }
  if(!reasons.length)return null;
  const lv=reasons.some(r=>r.lv==="direct")?"direct":reasons.some(r=>r.lv==="cat")?"cat":"fuzzy";
  return {lv,reasons:reasons.filter((r,i,a)=>a.findIndex(x=>x.t===r.t)===i),hl,catNames:m.catNames||[]};
}

/* ---------- 筛选 ---------- */
function apply(){
  const f=getForm();
  S.lastMatcher=f.major?buildMatcher(f.major):null;
  updateMajorHint(f.major);
  const hc=f.hc?parseInt(f.hc,10):0;
  const J=S.jobs, out=[];
  const items=S.favView?S.favsList:J.items;
  for(const it of items){
    if(f.tax&&!it.isTax)continue;
    if(f.prov!==""&&it.provId!==+f.prov)continue;
    if(f.edu!==""&&!(it.eduMask&+f.edu))continue;
    if(f.pol!==""&&it.polId!==+f.pol)continue;
    if(f.grass!==""&&it.grassId!==+f.grass)continue;
    if(f.exam!==""&&it.examTypeId!==+f.exam)continue;
    if(f.level!==""&&it.orgLevelId!==+f.level)continue;
    if(f.attr!==""&&it.attrId!==+f.attr)continue;
    if(f.dist!==""&&it.distId!==+f.dist)continue;
    if(f.proTest!==""&&it.proTestId!==+f.proTest)continue;
    if(hc&&it.headcount<hc)continue;
    if(f.noGrass&&it.grassNeed)continue;
    if(f.dept&&!(J.deptOpts[it.deptId]||"").includes(f.dept))continue;
    if(f.city&&!toHalf(it.workLoc).includes(f.city))continue;
    if(f.kw){
      const hay=[it.position,it.intro,it.office,J.deptOpts[it.deptId],it.remark].join("");
      if(!toHalf(hay).includes(f.kw))continue;
    }
    let m=null;
    if(S.lastMatcher){m=matchMajor(it,S.lastMatcher);if(!m)continue;}
    out.push({it,m});
  }
  if(S.lastMatcher){
    const rank={direct:0,cat:1,fuzzy:2};
    out.sort((a,b)=>rank[a.m.lv]-rank[b.m.lv]||b.it.headcount-a.it.headcount);
  }
  S.rows=out; S.page=1;
  $("legend").hidden=!S.lastMatcher;
  render();
  writeHash();
}

/* ---------- 渲染 ---------- */
function render(){
  const total=S.rows.length;
  const totalAll=S.jobs.total;
  $("resultStat").innerHTML=S.favView
    ? `我的收藏 <b>${total}</b> 个岗位`
    : `为你找到 <b>${total.toLocaleString()}</b> 个可报岗位 <span class="muted">（全国共 ${totalAll.toLocaleString()} 个）</span>`;
  $("emptyTip").hidden=total!==0;
  const start=(S.page-1)*S.PAGE, slice=S.rows.slice(start,start+S.PAGE);
  $("jobList").innerHTML=slice.map(r=>renderCard(r)).join("");
  renderPager(total);
}

function renderCard(r){
  const it=r.it, J=S.jobs, f=getForm();
  const dept=J.deptOpts[it.deptId]||"";
  const tags=[];
  tags.push(`<span class="tag k">${esc(it.workLoc)}</span>`);
  tags.push(`<span class="tag ${f.edu?"ok":""}">${esc(optName("edu",it.eduId))}</span>`);
  tags.push(`<span class="tag">${esc(optName("examType",it.examTypeId))}</span>`);
  const pol=optName("pol",it.polId); if(pol!=="不限")tags.push(`<span class="tag warn">${esc(pol)}</span>`);
  const gr=optName("grass",it.grassId); if(gr!=="无限制")tags.push(`<span class="tag warn">基层${esc(gr)}</span>`);
  const at=optName("attr",it.attrId); if(at!=="普通职位")tags.push(`<span class="tag">${esc(at)}</span>`);
  const dist=optName("dist",it.distId); if(dist!=="其他职位")tags.push(`<span class="tag warn">${esc(dist)}</span>`);
  if(optName("proTest",it.proTestId)==="是")tags.push(`<span class="tag warn">需专业能力测试</span>`);
  const majorHtml=r.m?highlight(it.major,r.m.hl):esc(it.major);
  const reasons=r.m?`<div class="hit-reason">${r.m.reasons.map(x=>`<span class="reason ${x.lv}">${esc(x.t)}</span>`).join("")}</div>`:"";
  const fav=S.favs.has(it.jobCode), cmp=S.cmp.has(it.jobCode);
  return `<div class="card ${r.m?"hit-"+r.m.lv:""}" data-code="${esc(it.jobCode)}">
    <div class="card-top">
      <div style="min-width:0">
        <div class="c-title">${esc(it.position)}</div>
        <div class="c-dept">${esc(dept)} · ${esc(it.office)}</div>
      </div>
      <div class="c-head">${it.isTax?'<span class="tax-tag">税务</span>':""}<span class="hc">${it.headcount}<small> 人</small></span></div>
    </div>
    <div class="c-row">${tags.join("")}</div>
    <div class="c-major"><span class="lab">专业</span>${majorHtml}</div>
    ${reasons}
    <div class="c-actions">
      <button class="act word" data-act="word">下载 Word 分析</button>
      <button class="act fav ${fav?"on":""}" data-act="fav">${fav?"已收藏":"收藏"}</button>
      <button class="act cmp ${cmp?"on":""}" data-act="cmp">${cmp?"已加入对比":"加入对比"}</button>
      <button class="act expand" data-act="expand">展开全部字段</button>
    </div>
    <div class="detail"><table class="dtable"><tbody>${DETAIL.map(([k,l])=>`<tr><th>${l}</th><td>${esc(txt(it,k))}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

function highlight(text,hl){
  let html=esc(text);
  const terms=[...new Map(hl.map(x=>[x.t,x])).values()]
    .filter(x=>x.t&&x.t.length>=2).sort((a,b)=>b.t.length-a.t.length);
  terms.forEach(x=>{
    const safe=x.t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    // 仅在转义后的纯文本片段上替换（中文与代码不受 escape 影响）
    html=html.replace(new RegExp(safe,"g"),m=>`<mark class="mk-${x.lv}">${m}</mark>`);
  });
  return html;
}

function renderPager(total){
  const pages=Math.ceil(total/S.PAGE), cur=S.page, p=$("pager");
  if(pages<=1){p.innerHTML="";return;}
  let h=`<button ${cur===1?"disabled":""} data-pg="${cur-1}">上一页</button>`;
  const range=[];
  for(let i=Math.max(1,cur-2);i<=Math.min(pages,cur+2);i++)range.push(i);
  if(range[0]>1){h+=`<button data-pg="1">1</button>`;if(range[0]>2)h+=`<span class="muted">…</span>`;}
  range.forEach(i=>h+=`<button class="${i===cur?"cur":""}" data-pg="${i}">${i}</button>`);
  if(range[range.length-1]<pages){if(range[range.length-1]<pages-1)h+=`<span class="muted">…</span>`;h+=`<button data-pg="${pages}">${pages}</button>`;}
  h+=`<button ${cur===pages?"disabled":""} data-pg="${cur+1}">下一页</button>`;
  p.innerHTML=h;
}

/* ---------- 专业建议 ---------- */
let sgTimer=null;
function onMajorInput(){
  clearTimeout(sgTimer);
  sgTimer=setTimeout(()=>{
    const q=$("majorInput").value.trim();
    suggest(q);
    apply();
  },220);
}
function suggest(q){
  const box=$("majorSuggest");
  if(!q){box.hidden=true;box.innerHTML="";return;}
  const qn=norm(q), cat=S.catalog, res=[];
  if(qn.length>=1){
    for(const name in cat.majorIndex){
      if(norm(name).includes(qn)){
        const cid=cat.majorIndex[name][0];
        const c=cat.categories.find(x=>x.id===cid);
        res.push({name,cat:c?c.name:""});
        if(res.length>=8)break;
      }
    }
    cat.categories.forEach(c=>{if(norm(c.name).includes(qn)&&res.length<10)res.push({name:c.name,cat:"专业大类"});});
  }
  if(!res.length){box.hidden=true;box.innerHTML="";return;}
  box.innerHTML=res.map(x=>`<div class="sg-item" data-name="${esc(x.name)}"><span class="sg-name">${esc(x.name)}</span><span class="sg-cat">${esc(x.cat)}</span></div>`).join("");
  box.hidden=false;
}
function updateMajorHint(q){
  const el=$("majorHint");
  if(!q){el.innerHTML="";return;}
  const m=buildMatcher(q);
  const cats=[...new Set(m.catNames.map(x=>x.raw))];
  if(cats.length){
    el.innerHTML=`识别为：<b>${esc(m.matchedName||q)}</b>　所属大类：${cats.map(c=>`<span class="pill">${esc(c)}</span>`).join("")}`;
  }else{
    el.innerHTML=`未在专业目录中找到「${esc(q)}」，将按名称直接/相近匹配，结果请自行核对。`;
  }
}

/* ---------- 收藏 / 对比 / 导出 ---------- */
function updateBadges(){
  $("favCount").textContent=S.favs.size;
  $("cmpCount").textContent=S.cmp.size;
  S.favsList=[...S.favs].map(c=>S.index[c]).filter(Boolean);
}
function toggleFav(code){
  S.favs.has(code)?S.favs.delete(code):S.favs.add(code);
  localStorage.setItem("gk_favs",JSON.stringify([...S.favs]));
  updateBadges();
}
function toggleCmp(code){
  if(!S.cmp.has(code)&&S.cmp.size>=3){toast("最多对比 3 个岗位");return;}
  S.cmp.has(code)?S.cmp.delete(code):S.cmp.add(code);
  updateBadges();
}
function csvCell(v){v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function buildCsvText(){
  const head=["命中方式"].concat(DETAIL.map(x=>x[1]));
  const lines=[head.join(",")];
  S.rows.forEach(r=>{
    const lv=r.m?{direct:"直接命中",cat:"大类命中",fuzzy:"相近匹配"}[r.m.lv]:"";
    lines.push([lv].concat(DETAIL.map(([k])=>csvCell(txt(r.it,k)))).join(","));
  });
  return lines.join("\r\n");
}
function exportCsv(){
  if(!S.rows.length){toast("当前没有可导出的结果");return;}
  const blob=new Blob(["\ufeff"+buildCsvText()],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`国考岗位筛选_${S.rows.length}条.csv`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("已导出 "+S.rows.length+" 条（Excel 可直接打开）");
  bumpAction();
}

/* ---------- 单岗位 Word 分析 ---------- */
function sanitize(s){return (s||"").replace(/[\\/:*?"<>|]/g,"_").slice(0,40);}
function buildWordHtml(it,m){
  const f=getForm(), J=S.jobs;
  const cell=(k,l)=>`<tr><th>${l}</th><td>${esc(txt(it,k))}</td></tr>`;
  let matchSec="";
  if(m){
    const catNames=[...new Set(m.catNames.map(x=>x.raw))];
    matchSec=`<h3>一、专业匹配分析</h3>
      <p>你输入的专业：<b>${esc(f.major)}</b>；目录归类：${catNames.length?catNames.map(esc).join("、"):"未识别（按名称匹配）"}。</p>
      <p>命中方式：<b>${m.reasons.map(x=>x.t).join("；")}</b>。</p>
      <p style="color:#b45309">说明：专业匹配为模糊结果，专业名称、培养方向、研究生学科等以招录机关解释为准，<b>报名前务必致电咨询电话确认</b>。</p>`;
  }
  const checks=[];
  checks.push(["学历","要求："+optName("edu",it.eduId)+(f.edu?"；你所选学历在可报范围内。":"；请确认与你的学历一致。")]);
  checks.push(["学位","要求："+optName("degree",it.degreeId)]);
  checks.push(["政治面貌","要求："+optName("pol",it.polId)]);
  checks.push(["基层工作最低年限","要求："+optName("grass",it.grassId)]);
  checks.push(["服务基层项目",it.grassNeed?"要求："+esc(it.grassProj):"无限制"]);
  checks.push(["面试专业能力测试",optName("proTest",it.proTestId)==="是"?"<b style='color:#b45309'>需要</b>组织专业能力测试":"不需要"]);
  checks.push(["面试人员比例",optName("ratio",it.ratioId)]);
  checks.push(["职位分布",optName("dist",it.distId)]);
  checks.push(["招考人数",it.headcount+" 人"]);
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>岗位报考分析</title>
<style>
body{font-family:"宋体","SimSun",serif;font-size:12pt;line-height:1.8;color:#1a1a1a}
h1{font-size:18pt;text-align:center;font-family:"黑体";margin-bottom:4px}
.sub{text-align:center;color:#666;font-size:10.5pt;margin-bottom:18px}
h3{font-size:13pt;font-family:"黑体";border-left:4px solid #1d4ed8;padding-left:8px;margin-top:22px}
table{border-collapse:collapse;width:100%;font-size:11pt}
th,td{border:1px solid #888;padding:6px 8px;vertical-align:top}
th{background:#f0f4f8;width:130px;text-align:left}
ul{margin:6px 0;padding-left:22px}
.note{background:#fffbeb;border:1px solid #fcd34d;padding:8px 12px;font-size:11pt}
.disc{color:#666;font-size:10pt;border-top:1px solid #ccc;padding-top:10px;margin-top:20px}
</style></head><body>
<h1>国家公务员考试岗位报考分析</h1>
<p class="sub">${esc(txt(it,"deptId"))} · ${esc(it.position)}（职位代码 ${esc(it.jobCode)}）</p>
${matchSec||"<h3>一、专业匹配分析</h3><p>未输入专业条件，未做专业匹配。</p>"}
<h3>二、岗位基本信息</h3>
<table>${DETAIL.map(([k,l])=>cell(k,l)).join("")}</table>
<h3>三、报考条件自检</h3>
<ul>${checks.map(c=>`<li><b>${c[0]}：</b>${c[1]}</li>`).join("")}</ul>
<h3>四、重点提醒</h3>
<div class="note">备注栏常含户籍、性别、职业资格、应届身份等附加限制，请逐条核对原文：<br>${esc(it.remark||"—")}</div>
<p>工作地点：${esc(it.workLoc)}　落户地点：${esc(it.hukouLoc)}</p>
<p>咨询电话：${esc(it.tel||"—")}<br>部门网站：${esc(it.website||"—")}</p>
<p class="disc">本分析由「2027 国考选岗助手」依据公开招考简章自动生成，为非官方信息检索辅助，不代表任何招录机关意见；专业匹配为模糊结果，一切报考条件、专业认定与最终结果以国家公务员局官方公告及报名系统为准。</p>
</body></html>`;
  return html;
}
function downloadWord(it,m){
  const blob=new Blob(["\ufeff"+buildWordHtml(it,m)],{type:"application/msword;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`岗位分析_${sanitize(it.jobCode)}_${sanitize(it.position)}.doc`;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("Word 分析已开始下载");
}

/* ---------- 对比 ---------- */
function openCompare(){
  const codes=[...S.cmp];
  if(!codes.length){toast("还没有勾选要对比的岗位");return;}
  const rows=codes.map(c=>S.index[c]);
  const h=`<table class="cmp-table"><thead><tr><th>对比项</th>${rows.map(it=>`<th>${esc(it.position)}</th>`).join("")}</tr></thead><tbody>
    ${DETAIL.map(([k,l])=>`<tr><td class="k">${l}</td>${rows.map(it=>`<td>${esc(txt(it,k))}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
  $("compareBody").innerHTML=h;
  $("compareModal").hidden=false;
}

/* ---------- 赞赏（定期弹窗，自愿、不强制） ---------- */
const DONATE_FIRST=10;        // 首次：累计约 10 次有效操作后提示
const DONATE_STEP=40;         // 之后每累计 40 次操作再提示一次
const DONATE_THANK_STEP=140;  // 点过“我已赞赏”后，间隔更久再提示
function dGet(k,def){const v=localStorage.getItem(k);return v==null?def:+v;}
function bumpAction(){
  if(sessionStorage.getItem("gk_donate_session"))return;  // 本次会话已自动弹过，不再打扰
  const c=dGet("gk_donate_act",0)+1;
  localStorage.setItem("gk_donate_act",c);
  if(c>=dGet("gk_donate_next",DONATE_FIRST))openDonate(true);
}
function openDonate(auto){
  $("donateModal").hidden=false;
  if(auto){
    sessionStorage.setItem("gk_donate_session","1");
    localStorage.setItem("gk_donate_next",dGet("gk_donate_act",0)+DONATE_STEP);
  }
}
function closeDonate(thank){
  $("donateModal").hidden=true;
  if(thank){
    localStorage.setItem("gk_donate_next",dGet("gk_donate_act",0)+DONATE_THANK_STEP);
    sessionStorage.setItem("gk_donate_session","1");
    toast("感谢你的支持，祝你成功上岸！");
  }
}

/* ---------- 分享链接 ---------- */
function writeHash(){
  const f=getForm();const p=new URLSearchParams();
  Object.entries(f).forEach(([k,v])=>{if(v===true)v="1";if(v)p.set(k,v);});
  history.replaceState(null,"","#"+p.toString());
}
function readHash(){
  const h=location.hash.slice(1);if(!h)return false;
  const p=new URLSearchParams(h);const g=k=>p.get(k)||"";
  $("majorInput").value=g("major");$("myEdu").value=g("edu");$("provSel").value=g("prov");
  $("cityInput").value=g("city");$("deptInput").value=g("dept");$("kwInput").value=g("kw");
  $("polSel").value=g("pol");$("grassSel").value=g("grass");$("examSel").value=g("exam");
  $("levelSel").value=g("level");$("attrSel").value=g("attr");$("distSel").value=g("dist");
  $("proTestSel").value=g("proTest");$("hcInput").value=g("hc");
  $("taxOnly").checked=g("tax")==="1";$("noGrass").checked=g("noGrass")==="1";
  apply();return true;
}

/* ---------- 事件 ---------- */
function bindEvents(){
  let deb=null;
  const onAny=()=>{clearTimeout(deb);deb=setTimeout(apply,180);};
  ["myEdu","provSel","cityInput","deptInput","kwInput","polSel","grassSel","examSel","levelSel","attrSel","distSel","proTestSel","hcInput","taxOnly","noGrass"]
    .forEach(id=>{const el=$(id);el.addEventListener("input",onAny);el.addEventListener("change",onAny);});
  $("majorInput").addEventListener("input",onMajorInput);
  $("majorInput").addEventListener("blur",()=>setTimeout(()=>$("majorSuggest").hidden=true,180));
  $("majorSuggest").addEventListener("mousedown",e=>{
    const it=e.target.closest(".sg-item");if(!it)return;
    $("majorInput").value=it.dataset.name;$("majorSuggest").hidden=true;apply();
  });
  $("applyBtn").addEventListener("click",()=>{apply();bumpAction();window.scrollTo({top:document.querySelector(".results").offsetTop-70,behavior:"smooth"});});
  $("resetBtn").addEventListener("click",()=>{
    ["majorInput","cityInput","deptInput","kwInput","hcInput"].forEach(id=>$(id).value="");
    ["myEdu","provSel","polSel","grassSel","examSel","levelSel","attrSel","distSel","proTestSel"].forEach(id=>$(id).value="");
    $("taxOnly").checked=false;$("noGrass").checked=false;$("majorHint").innerHTML="";apply();
  });
  $("filterToggle").addEventListener("click",()=>$("filters").classList.toggle("open"));
  $("shareBtn").addEventListener("click",()=>{
    const u=location.href;
    navigator.clipboard?.writeText(u).then(()=>toast("筛选链接已复制，打开即可还原条件"),()=>toast("复制失败，请手动复制地址栏链接"));
  });
  $("exportBtn").addEventListener("click",exportCsv);
  $("compareBtn").addEventListener("click",openCompare);
  $("compareClose").addEventListener("click",()=>$("compareModal").hidden=true);
  $("compareModal").addEventListener("click",e=>{if(e.target.id==="compareModal")e.currentTarget.hidden=true;});
  $("donateBtn").addEventListener("click",()=>openDonate(false));
  $("donateClose").addEventListener("click",()=>closeDonate(false));
  $("donateLater").addEventListener("click",()=>closeDonate(false));
  $("donateDone").addEventListener("click",()=>closeDonate(true));
  $("donateModal").addEventListener("click",e=>{if(e.target.id==="donateModal")closeDonate(false);});
  $("favViewBtn").addEventListener("click",()=>{
    S.favView=!S.favView;
    $("favViewBtn").style.background=S.favView?"#eff4ff":"";
    $("exportBtn").disabled=false;
    if(S.favView){S.favsList=[...S.favs].map(c=>S.index[c]).filter(Boolean);}
    apply();
  });
  // 卡片事件委托
  $("jobList").addEventListener("click",e=>{
    const card=e.target.closest(".card");if(!card)return;
    const code=card.dataset.code,it=S.index[code];if(!it)return;
    const act=e.target.closest("[data-act]");
    if(act){
      const type=act.dataset.act;
      if(type==="word"){const r=S.rows.find(x=>x.it.jobCode===code);downloadWord(it,r?r.m:null);bumpAction();}
      else if(type==="fav"){toggleFav(code);render();}
      else if(type==="cmp"){toggleCmp(code);render();}
      else if(type==="expand"){
        const d=card.querySelector(".detail");d.classList.toggle("show");
        act.textContent=d.classList.contains("show")?"收起":"展开全部字段";
        bumpAction();
      }
    }
  });
  $("pager").addEventListener("click",e=>{
    const b=e.target.closest("button[data-pg]");if(!b||b.disabled)return;
    S.page=+b.dataset.pg;render();bumpAction();window.scrollTo({top:document.querySelector(".results").offsetTop-70,behavior:"smooth"});
  });
}

loadData();
