/* Wokeness-Rate — frontend only. Keys stay in localStorage. */
const $ = (id) => document.getElementById(id);
const titleInput = $("titleInput"), yearInput = $("yearInput"), typeInput = $("typeInput");
const searchBtn = $("searchBtn"), demoBtn = $("demoBtn"), statusLine = $("statusLine"), spinner = $("spinner");
const resultSection = $("resultSection"), resultText = $("resultText");
const scoreStrip = $("scoreStrip"), wokeNum = $("wokeNum"), meterFill = $("meterFill"), wokeReason = $("wokeReason");
const copyBtn = $("copyBtn"), verifiedBadge = $("verifiedBadge");
const historyList = $("historyList");

const LS = { provider: "wr_provider", model: "wr_model", key: "wr_key", omdb: "wr_omdb", hist: "wr_hist" };
const DEFAULT_MODELS = { openrouter: "openai/gpt-4o-mini", openai: "gpt-4o-mini", gemini: "gemini-1.5-flash" };

function getSettings() {
  const provider = localStorage.getItem(LS.provider) || "openrouter";
  const model = localStorage.getItem(LS.model) || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openrouter;
  return { provider, model, apiKey: localStorage.getItem(LS.key) || "", omdbKey: localStorage.getItem(LS.omdb) || "" };
}

/* ---------- System prompt: exact user criteria + format ---------- */
function buildMessages(title, year, kind) {
  const kindFa = kind === "movie" ? "فیلم" : kind === "series" ? "سریال" : "فیلم/سریال";
  const system = `تو یک منتقد دقیق فیلم و سریال هستی که هم امتیازها را می‌دانی و هم «درجه‌ی Wokeness» را با نهایت دقت و سخت‌گیری محاسبه می‌کنی.

تعریف Wokeness (فقط و فقط همین موارد — هرچه بیشتر و مصنوعی‌تر، نمره بالاتر از ۰ تا ۱۰):
۱) تغییر نژاد، جنسیت یا گرایش جنسی شخصیت‌ها نسبت به منبع اصلی اقتباس بدون دلیل و منطق داستانی.
۲) تنوع نژادی/جنسیتی چک‌لیستی و تحمیلی (مثلاً در محیط تاریخی/فرهنگی که منطقی نیست).
۳) دیالوگ مستقیم و شعاری فمینیستی و ضد مرد، یا اصرار غیرمنطقی که «زن‌ها در هر کاری قوی‌ترند».
۴) اشاره‌های مکرر و غیرطبیعی به نژادپرستی نهادی، حقوق ترنس‌ها، هویت جنسیتی، تغییرات اقلیمی یا موعظه‌ی سیاسی چپ مدرن.
۵) زوم کردن روی گرایش جنسی یا هویت نژادی یک شخصیت فقط برای نمایش تنوع.
۶) حس کلی تبلیغاتی و «باید درست رفتار کنیم» به‌جای داستان‌گویی طبیعی.
- هر چیزی که از دل داستان، شخصیت یا موقعیت واقعی دربیاید (حتی نقد مذهب، خشونت یا مسائل اجتماعی) Woke حساب نمی‌شود. فقط تزریق ایدئولوژیک اجباری نمره را بالا می‌برد.
- مثال مرجع: سریال The Night Agent شعار مستقیم نمی‌دهد اما زن‌سالار است؛ زنان ریزجثه به‌طرز غیرواقعی مردان درشت‌هیکل را کتک می‌زنند، تقریباً همه‌ی مردان (جز خلافکارها) مطیع یک زن‌اند و جز نقش اول، مردان سفیدپوست منفی‌اند → چنین الگویی باید نمره‌ی بالای ۵ بگیرد.
- برای سریال‌ها: برآیند کل فصل‌ها (نه یک/دو فصل خاص).

قواعد امتیازها:
- IMDb از ۱۰، Rotten Tomatoes درصد منتقدان و مخاطبان، Metacritic از ۱۰۰ (اگر ندارد بنویس —).
- اگر از عددی مطمئن نیستی، نزدیک‌ترین مقدار شناخته‌شده را بنویس و حدس نزن.

خروجی: فقط یک JSON معتبر (بدون markdown، بدون توضیح اضافه) با همین کلیدها:
{"imdb":"?","rt_critics":"?","rt_audience":"?","metacritic":"?","title_en":"?","year":"?","genres":"?","director":"?","network":"?","plot_fa":"خلاصه ۳ تا ۴ خط به فارسی","wokeness_score":0,"wokeness_reason":"علت ۲ تا ۴ جمله به فارسی، مشخص و مصداقی"}`;

  const user = `نام ${kindFa}: ${title}\nسال ساخت: ${year}\nاطلاعات + درجه Wokeness را فقط در قالب JSON بالا بده. عنوان انگلیسی رسمی، سال انتشار، ژانرها (فارسی)، کارگردان اصلی، کمپانی/شبکه پخش اصلی، خلاصه ۳-۴ خط.`;
  return { system, user };
}

/* ---------- LLM calls ---------- */
async function callLLM(title, year, kind) {
  const { provider, model, apiKey } = getSettings();
  if (!apiKey) throw new Error("NO_KEY");
  const { system, user } = buildMessages(title, year, kind);

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { temperature: 0.3 } }) });
    if (!r.ok) throw new Error("خطای Gemini: " + r.status);
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    return txt;
  }
  const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
  if (provider === "openrouter") { headers["HTTP-Referer"] = location.href; headers["X-Title"] = "Wokeness-Rate"; }
  const r = await fetch(url, { method: "POST", headers,
    body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("خطای API (" + r.status + "): " + t.slice(0, 200)); }
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

function extractJSON(txt) {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("پاسخ هوش مصنوعی JSON نبود.");
  return JSON.parse(m[0]);
}

/* ---------- OMDb (optional, for real ratings) ---------- */
async function fetchOMDb(title, year, omdbKey) {
  const u = `https://www.omdbapi.com/?apikey=${encodeURIComponent(omdbKey)}&t=${encodeURIComponent(title)}&y=${encodeURIComponent(year)}&plot=short&r=json`;
  const r = await fetch(u);
  const j = await r.json();
  if (j?.Response === "False") return null;
  const get = (src) => (j?.Ratings || []).find(x => x.Source === src)?.Value || null;
  return {
    title_en: j.Title, year: (j.Year || "").slice(0, 4),
    imdb: j.imdbRating && j.imdbRating !== "N/A" ? j.imdbRating : null,
    rt_critics: get("Rotten Tomatoes"), metacritic: j.Metascore && j.Metascore !== "N/A" ? j.Metascore : null,
    genres: j.Genre, director: j.Director, network: j.Production && j.Production !== "N/A" ? j.Production : null,
    plot_en: j.Plot,
  };
}

/* ---------- Render: exact user format ---------- */
function toFa(s) { return String(s ?? "—"); }

function formatOutput(d) {
  const mc = d.metacritic && d.metacritic !== "N/A" ? d.metacritic : "—";
  return `- امتیازها:\nIMDb: ${toFa(d.imdb)}/۱۰\nRotten Tomatoes: ${toFa(d.rt_critics)} (Critics) / ${toFa(d.rt_audience)} (Audience)\nMetacritic: ${toFa(mc)}/۱۰۰\n- عنوان (به انگلیسی)\n${toFa(d.title_en)}\n- سال انتشار\n${toFa(d.year)}\n- ژانرها\n${toFa(d.genres)}\n- کارگردان اصلی\n${toFa(d.director)}\n- کمپانی/شبکه پخش اصلی\n${toFa(d.network)}\n- خلاصه داستان کوتاه\n${toFa(d.plot_fa)}\n- درجه‌ی Wokeness به همراه علت: ${toFa(d.wokeness_score)}/۱۰\n${toFa(d.wokeness_reason)}`;
}

function render(d, verified) {
  resultSection.hidden = false;
  resultText.textContent = formatOutput(d);
  verifiedBadge.hidden = !verified;
  scoreStrip.innerHTML = "";
  const pills = [`IMDb ${d.imdb ?? "—"}/۱۰`, `RT 🍅 ${d.rt_critics ?? "—"} / 🎟️ ${d.rt_audience ?? "—"}`, `Meta ${d.metacritic ?? "—"}/۱۰۰`, `Wokeness ${d.wokeness_score ?? "—"}/۱۰`];
  pills.forEach(t => { const s = document.createElement("span"); s.className = "pill"; s.textContent = t; scoreStrip.appendChild(s); });
  const w = Number(d.wokeness_score);
  wokeNum.textContent = Number.isFinite(w) ? `${w}/۱۰` : "—";
  meterFill.style.width = Number.isFinite(w) ? `${Math.max(0, Math.min(10, w)) * 10}%` : "0%";
  wokeReason.textContent = d.wokeness_reason || "";
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Curated offline demo ---------- */
const DEMO_DB = {
  "the night agent|2023": { imdb: "7.5", rt_critics: "74%", rt_audience: "78%", metacritic: "—", title_en: "The Night Agent", year: "2023", genres: "اکشن، جاسوسی، تریلر", director: "شاون رایان (خالق سریال)", network: "Netflix", plot_fa: "یک مأمور رده‌پایین اف‌بی‌آی که پشت خط تلفن اضطراری کاخ سفید نشسته، تماس زنی را جواب می‌دهد که او را وارد توطئه‌ای بزرگ در قلب دولت آمریکا می‌کند. او باید با کمک آن زن، از یک حمله‌ی تروریستی جلوگیری کند و خائنان را پیدا کند.\nسریال ریتم تندی دارد و روی تعقیب، خیانت و بقا تمرکز می‌کند.", wokeness_score: 7, wokeness_reason: "شعار مستقیم سیاسی ندارد اما الگوی زن‌سالارانه پررنگ است: زنان ریزجثه به‌طرز غیرواقعی مردان ورزیده را شکست می‌دهند، تقریباً همه‌ی مردان (جز تبهکاران) تحت امر یک زن عمل می‌کنند و مردان سفیدپوست — به‌جز نقش اول — عمدتاً منفی یا ضعیف تصویر شده‌اند. تنوع نیز حس چک‌لیستی دارد تا طبیعی." },
};
function demoFor(title, year) {
  const k = `${title.trim().toLowerCase()}|${String(year).trim()}`;
  if (DEMO_DB[k]) return DEMO_DB[k];
  return { imdb: "—", rt_critics: "—", rt_audience: "—", metacritic: "—", title_en: title, year: String(year), genres: "—", director: "—", network: "—", plot_fa: "حالت نمایشی: برای این عنوان داده‌ی آفلاین ندارم. کلید API را در «تنظیمات API» وارد کن تا تحلیل دقیق و کامل بگیری.", wokeness_score: "—", wokeness_reason: "در حالت نمایشی بدون کلید، درجه‌ی Wokeness محاسبه نمی‌شود. با وارد کردن کلید (OpenRouter/OpenAI/Gemini) تحلیل کامل بر اساس معیارهای شش‌گانه و برآیند کل فصل‌ها انجام می‌شود." };
}

/* ---------- Local library (auto-save, offline access, no re-search) ---------- */
const MAX_SAVED = 200;
function loadHist() { try { return JSON.parse(localStorage.getItem(LS.hist) || "[]"); } catch { return []; } }
function saveResultToLibrary(title, year, data, verified) {
  const h = loadHist();
  const key = `${String(title).trim().toLowerCase()}|${String(year).trim()}`;
  const entry = { key, title, year, w: data?.wokeness_score ?? "—", data, verified: !!verified, savedAt: new Date().toISOString() };
  const rest = h.filter(x => x.key !== key);
  rest.unshift(entry);
  localStorage.setItem(LS.hist, JSON.stringify(rest.slice(0, MAX_SAVED)));
  paintHist();
}
function saveHist(h) { localStorage.setItem(LS.hist, JSON.stringify(h.slice(0, MAX_SAVED))); paintHist(); }
function faNum(n) { return Number(n).toLocaleString("fa-IR"); }
function paintHist() {
  const q = ($("histSearch")?.value || "").trim().toLowerCase();
  const h = loadHist();
  const filtered = q ? h.filter(x => (`${x.title} ${x.data?.title_en || ""} ${x.year}`).toLowerCase().includes(q)) : h;
  const count = $("histCount"); if (count) count.textContent = faNum(h.length);
  historyList.innerHTML = "";
  if (!h.length) { historyList.innerHTML = '<p class="muted">هنوز چیزی ذخیره نشده — کافیست یک عنوان را جست‌وجو کنی تا اینجا بماند.</p>'; return; }
  if (!filtered.length) { historyList.innerHTML = '<p class="muted">چیزی با این جست‌وجو پیدا نشد.</p>'; return; }
  filtered.forEach(item => {
    const div = document.createElement("div"); div.className = "hist-item";
    const info = document.createElement("div"); info.className = "hist-info";
    const name = document.createElement("strong"); name.textContent = `${item.title} (${item.year})`;
    const meta = document.createElement("small"); meta.className = "muted";
    const d = new Date(item.savedAt); const dateFa = isNaN(d) ? "" : d.toLocaleDateString("fa-IR");
    meta.textContent = `Wokeness: ${item.w ?? "—"} — ${item.data?.title_en || ""} ${dateFa ? "· " + dateFa : ""}${item.verified ? " · ✓ OMDb" : ""}`;
    info.append(name, meta);
    const tools = document.createElement("div"); tools.className = "hist-tools";
    const open = document.createElement("button"); open.textContent = "نمایش فوری"; open.type = "button"; open.className = "link-btn";
    open.onclick = () => {
      titleInput.value = item.title; yearInput.value = item.year;
      if (item.data) { render(item.data, item.verified); statusLine.textContent = "نمایش از حافظه‌ی محلی — بدون جست‌وجوی دوباره و بدون مصرف API."; }
    };
    const del = document.createElement("button"); del.textContent = "✕"; del.type = "button"; del.className = "link-btn danger"; del.title = "حذف";
    del.onclick = () => { saveHist(loadHist().filter(x => x.key !== item.key)); };
    tools.append(open, del);
    div.append(info, tools); historyList.appendChild(div);
  });
}

/* ---------- Main flow ---------- */
async function runSearch(title, year) {
  const kind = typeInput.value;
  setBusy(true);
  try {
    const { apiKey, omdbKey } = getSettings();
    let data, verified = false;
    if (!apiKey) {
      statusLine.textContent = "کلید API وارد نشده — نمایش نمونه‌ی آفلاین. برای تحلیل دقیق، «تنظیمات API» را باز کن.";
      data = demoFor(title, year);
    } else {
      statusLine.textContent = "در حال تحلیل با هوش مصنوعی… (امتیازها + برآیند کل فصل‌ها برای Wokeness)";
      const raw = await callLLM(title, year, kind);
      data = extractJSON(raw);
      if (omdbKey) {
        try {
          const om = await fetchOMDb(data.title_en || title, data.year || year, omdbKey);
          if (om) {
            if (om.imdb) data.imdb = om.imdb;
            if (om.rt_critics) { const m = om.rt_critics.match(/(\d+%)/); if (m) data.rt_critics = m[1]; }
            if (om.metacritic) data.metacritic = om.metacritic;
            if (om.title_en) data.title_en = om.title_en;
            verified = true;
          }
        } catch { /* ignore, keep LLM data */ }
      }
      statusLine.textContent = "";
    }
    render(data, verified);
    saveResultToLibrary(title, year, data, verified);
    if (getSettings().apiKey) statusLine.textContent = "✓ ذخیره شد در کتابخانه‌ی محلی — دفعه‌ی بعد بدون جست‌وجو از پایین صفحه بازش کن.";
  } catch (e) {
    statusLine.textContent = e.message === "NO_KEY"
      ? "کلید API وارد نشده است. دکمه‌ی «تنظیمات API» را بزن."
      : "خطا: " + e.message;
  } finally { setBusy(false); }
}

function setBusy(b) {
  searchBtn.disabled = b; spinner.hidden = !b;
  searchBtn.querySelector(".btn-label").textContent = b ? "در حال تحلیل…" : "دریافت اطلاعات + درجه Wokeness";
}

/* ---------- Events ---------- */
searchBtn.onclick = () => {
  const t = titleInput.value.trim(), y = yearInput.value.trim();
  if (!t || !y) { statusLine.textContent = "نام و سال ساخت هر دو لازم است."; return; }
  runSearch(t, y);
};
demoBtn.onclick = () => { titleInput.value = "The Night Agent"; yearInput.value = "2023"; runSearch("The Night Agent", "2023"); };
document.querySelectorAll("[data-sample]").forEach(ch => ch.onclick = () => {
  const [t, y] = ch.dataset.sample.split("|"); titleInput.value = t; yearInput.value = y; runSearch(t, y);
});
copyBtn.onclick = async () => {
  try { await navigator.clipboard.writeText(resultText.textContent); copyBtn.textContent = "کپی شد ✓"; setTimeout(() => copyBtn.textContent = "کپی متن", 1500); }
  catch { copyBtn.textContent = "کپی نشد"; }
};
$("clearHist").onclick = () => { if (confirm("همه‌ی موارد ذخیره‌شده پاک شود؟")) { localStorage.removeItem(LS.hist); paintHist(); } };
$("histSearch").oninput = () => paintHist();
$("exportBtn").onclick = () => {
  const blob = new Blob([localStorage.getItem(LS.hist) || "[]"], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "wokeness-library.json"; a.click();
  URL.revokeObjectURL(a.href);
};
$("importFile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const arr = JSON.parse(r.result); if (Array.isArray(arr)) saveHist([...arr, ...loadHist()]); } catch { alert("فایل معتبر نیست."); } };
  r.readAsText(f); e.target.value = "";
};

/* settings dialog */
const dlg = $("settingsDialog");
$("settingsBtn").onclick = () => {
  const s = getSettings();
  $("providerInput").value = s.provider; $("modelInput").value = s.model;
  $("apiKeyInput").value = s.apiKey; $("omdbKeyInput").value = s.omdbKey;
  dlg.showModal();
};
$("saveSettings").onclick = () => {
  const p = $("providerInput").value;
  localStorage.setItem(LS.provider, p);
  localStorage.setItem(LS.model, $("modelInput").value.trim() || DEFAULT_MODELS[p]);
  localStorage.setItem(LS.key, $("apiKeyInput").value.trim());
  localStorage.setItem(LS.omdb, $("omdbKeyInput").value.trim());
};
$("providerInput")?.addEventListener("change", (e) => { $("modelInput").value = DEFAULT_MODELS[e.target.value]; });

paintHist();
