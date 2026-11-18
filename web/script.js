/* =========================================================
   UrbanoAcessível S.A. — script.js
   Interações (tabs, filtros, topologia, terminal C) + GSAP
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* armazenamento indisponível */ } }
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  /* ------------------------------------------------ navegação */
  const navToggle = $(".nav-toggle");
  const menu = $("#menu");
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    menu.classList.toggle("open", !open);
  });
  $$("#menu a").forEach((a) => a.addEventListener("click", () => {
    navToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
  }));
  const navLinks = $$(".nav-links a");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach((s) => spy.observe(s));

  /* ------------------------------------------------ barra de acessibilidade */
  let fontPx = parseInt(store.get("ua-font") || "16", 10);
  const applyFont = () => { document.documentElement.style.setProperty("--fs", fontPx + "px"); store.set("ua-font", fontPx); };
  applyFont();
  const sysReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = store.get("ua-motion") === "1" || sysReduce.matches;
  if (store.get("ua-contrast") === "1") document.body.classList.add("high-contrast");

  const a11yToggle = $(".a11y-toggle");
  a11yToggle.addEventListener("click", () => {
    const open = $(".a11y-bar").classList.toggle("open");
    a11yToggle.setAttribute("aria-expanded", String(open));
  });
  $$(".a11y-bar button[data-a11y]").forEach((b) => {
    const act = b.dataset.a11y;
    if (act === "contrast") b.setAttribute("aria-pressed", String(document.body.classList.contains("high-contrast")));
    if (act === "motion") b.setAttribute("aria-pressed", String(reduceMotion));
    b.addEventListener("click", () => {
      if (act === "font-up") { fontPx = Math.min(fontPx + 2, 24); applyFont(); }
      if (act === "font-down") { fontPx = Math.max(fontPx - 2, 12); applyFont(); }
      if (act === "contrast") {
        const on = document.body.classList.toggle("high-contrast");
        b.setAttribute("aria-pressed", String(on));
        store.set("ua-contrast", on ? "1" : "0");
      }
      if (act === "motion") {
        reduceMotion = !reduceMotion;
        b.setAttribute("aria-pressed", String(reduceMotion));
        store.set("ua-motion", reduceMotion ? "1" : "0");
        setupAnimations();
        toast(reduceMotion ? "Animações reduzidas." : "Animações reativadas.");
      }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });

  /* ------------------------------------------------ tabs (ARIA) */
  $$("[data-tabs]").forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
      const panel = $("#" + tab.getAttribute("aria-controls"));
      if (window.gsap && !reduceMotion) gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" });
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        let n = null;
        if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  });

  /* ------------------------------------------------ topologia */
  const VLANS = {
    all: { nome: "Visão geral da rede", cor: "var(--blue)", rede: "10.0.0.0/16", gw: "SVIs no Core 3560", uso: "Topologia hierárquica em estrela estendida: borda, núcleo L3 e acesso L2.", hosts: "4 sub-redes /24 · 254 hosts cada" },
    10: { nome: "VLAN 10 — Operações", cor: "var(--blue)", rede: "10.0.10.0/24", gw: "10.0.10.1", uso: "Estações das equipes de tráfego e gestão de frota que usam o sistema de OS.", hosts: "SW-A · portas Fa0/1–10 (access)" },
    20: { nome: "VLAN 20 — Servidores locais", cor: "var(--green)", rede: "10.0.20.0/24", gw: "10.0.20.1", uso: "Banco de dados local, DNS e DHCP (ip helper-address aponta para cá).", hosts: "SW-A · portas Fa0/11–16 (access)" },
    30: { nome: "VLAN 30 — IoT Telemetria", cor: "var(--purple)", rede: "10.0.30.0/24", gw: "10.0.30.1", uso: "Concentradores que recebem os dados dos ônibus na garagem e encaminham ao broker MQTT.", hosts: "SW-B · portas Fa0/1–12 (access)" },
    40: { nome: "VLAN 40 — Visitantes", cor: "var(--orange)", rede: "10.0.40.0/24", gw: "10.0.40.1", uso: "Wi-Fi para passageiros na sede. ACL 140 bloqueia acesso às redes internas: só sai para a internet.", hosts: "SW-B · AP-PT corporativo" }
  };
  const topo = $("#topo-diagram svg");
  const vlanInfo = $("#vlan-info");
  function showVlan(v) {
    const d = VLANS[v];
    $$(".topo-panel .chip").forEach((c) => c.classList.toggle("active", c.dataset.vlan === v));
    vlanInfo.innerHTML = `<h4 style="color:${d.cor}">${d.nome}</h4><p class="muted">${d.uso}</p>
      <dl class="vlan-meta"><dt>Rede</dt><dd>${d.rede}</dd><dt>Gateway</dt><dd>${d.gw}</dd><dt>Acesso</dt><dd>${d.hosts}</dd></dl>`;
    if (!topo) return;
    topo.classList.toggle("topo-dim", v !== "all");
    $$(".topo-dev, .topo-link", topo).forEach((el) => {
      const ev = el.dataset.vlan;
      el.classList.toggle("on", v !== "all" && (ev === v || ev === "all"));
    });
  }
  $$(".topo-panel .chip").forEach((c) => c.addEventListener("click", () => showVlan(c.dataset.vlan)));
  if (topo) {
    $$(".topo-dev", topo).forEach((g) => {
      g.setAttribute("role", "button");
      const go = () => showVlan(g.dataset.vlan === "all" ? "all" : g.dataset.vlan);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }
  showVlan("all");

  /* ------------------------------------------------ tabela CLI */
  const CLI = [
    ["enable", "User EXEC", "verificacao", "Sobe do modo usuário para o modo privilegiado, onde é possível ver e salvar configurações."],
    ["configure terminal", "Privileged", "verificacao", "Entra no modo de configuração global: a partir daqui os comandos alteram o equipamento."],
    ["vlan 10\n name OPERACOES", "Config", "vlan", "Cria a VLAN 10 e dá a ela um nome legível. Repetido para 20, 30 e 40."],
    ["interface range fa0/1 - 10\n switchport mode access\n switchport access vlan 10", "Config-if", "vlan", "Coloca as portas 1 a 10 do switch de acesso como portas de um único computador, todas na VLAN 10."],
    ["interface gi0/1\n switchport trunk encapsulation dot1q\n switchport mode trunk", "Config-if", "trunk", "Transforma o cabo entre switches em um tronco que carrega várias VLANs, marcando cada quadro com a etiqueta 802.1Q."],
    ["switchport trunk allowed vlan 10,20,30,40", "Config-if", "trunk", "Limita o tronco às VLANs da empresa; qualquer outra VLAN é descartada."],
    ["ip routing", "Config", "roteamento", "Liga o roteamento no switch 3560 (Layer 3), permitindo que as VLANs conversem entre si sem roteador externo."],
    ["interface vlan 10\n ip address 10.0.10.1 255.255.255.0\n no shutdown", "Config-if", "roteamento", "Cria a SVI — a interface virtual que serve de gateway padrão para os computadores da VLAN 10."],
    ["ip helper-address 10.0.20.10", "Config-if", "roteamento", "Encaminha pedidos DHCP de outras VLANs ao servidor 10.0.20.10, que fica na VLAN de servidores."],
    ["ip route 0.0.0.0 0.0.0.0 10.0.0.1", "Config", "roteamento", "Rota padrão: tudo que não é da rede interna segue para o roteador de borda 2911 e de lá para a nuvem."],
    ["access-list 140 deny ip 10.0.40.0 0.0.0.255 10.0.0.0 0.0.255.255\naccess-list 140 permit ip any any", "Config", "seguranca", "Regra que impede a rede de visitantes de alcançar qualquer rede interna 10.0.x.x, liberando só a internet."],
    ["interface vlan 40\n ip access-group 140 in", "Config-if", "seguranca", "Aplica a regra acima na entrada da VLAN 40."],
    ["service password-encryption\nenable secret ********", "Config", "seguranca", "Cifra as senhas no arquivo de configuração e protege o modo privilegiado com hash."],
    ["show vlan brief", "Privileged", "verificacao", "Lista as VLANs e quais portas pertencem a cada uma — primeiro comando para conferir a segmentação."],
    ["show interfaces trunk", "Privileged", "verificacao", "Mostra quais portas estão em modo tronco e quais VLANs passam por elas."],
    ["show ip route", "Privileged", "verificacao", "Exibe a tabela de rotas: as quatro redes /24 diretamente conectadas e a rota padrão."],
    ["copy running-config startup-config", "Privileged", "verificacao", "Salva a configuração na memória NVRAM para que ela sobreviva a um reinício do equipamento."]
  ];
  let cliCat = "todos";
  const cliBody = $("#cli-body");
  const cliSearch = $("#cli-search");
  function renderCli() {
    const q = cliSearch.value.trim().toLowerCase();
    const rows = CLI.filter(([cmd, , cat, txt]) =>
      (cliCat === "todos" || cat === cliCat) && (!q || (cmd + " " + txt).toLowerCase().includes(q)));
    cliBody.innerHTML = rows.map(([cmd, mode, , txt]) =>
      `<tr><td class="cli-cmd">${esc(cmd)}</td><td class="cli-mode">${mode}</td><td>${esc(txt)}</td></tr>`).join("");
    $("#cli-empty").hidden = rows.length > 0;
  }
  $$(".cli-tools .chip").forEach((c) => c.addEventListener("click", () => {
    cliCat = c.dataset.cat;
    $$(".cli-tools .chip").forEach((x) => x.classList.toggle("active", x === c));
    renderCli();
  }));
  cliSearch.addEventListener("input", renderCli);
  renderCli();

  /* ------------------------------------------------ requisitos */
  const REQS = [
    ["RF01", "Cadastrar ônibus", "Placa, prefixo IoT, modelo e ano; placa e prefixo únicos.", "cadastrarVeiculo()"],
    ["RF02", "Registrar diagnóstico", "Elevador e rampa: OPERACIONAL, ALERTA ou QUEBRADO.", "registrarDiagnostico()"],
    ["RF03", "Abrir ordem de serviço", "Manual pelo mecânico ou automática quando o sensor envia FAIL.", "abrirOrdem()"],
    ["RF04", "Agendar preventiva", "Revisão periódica com data marcada na garagem.", "agendarPreventiva()"],
    ["RF05", "Consultar histórico", "Todas as OS de uma placa, corretivas e preventivas.", "consultarHistorico()"],
    ["RF06", "Relatório de frota operacional", "Percentual de veículos com acessibilidade 100% ativa.", "relatorioFrotaOperacional()"],
    ["RF07", "Autenticação de operadores", "Perfis Gestor, Mecânico e Fiscal com permissões distintas.", "autenticar() · permitido()"],
    ["RF08", "Ingestão de log telemétrico", "Lê pacotes JSON do broker e grava em telemetria_log.txt.", "processarPacote()"],
    ["RNF01", "Desempenho", "Consultas de frota respondidas em menos de 2 segundos.", "dados em memória + índice SQL"],
    ["RNF02", "Persistência em disco", "Nenhum dado se perde após reiniciar o programa.", "gravação via arquivo .tmp + rename"],
    ["RNF03", "Portabilidade", "Compila com GCC no Linux e MinGW no Windows.", "C99 · sem APIs de SO"],
    ["RNF04", "Integridade referencial", "Não existe OS para veículo inexistente.", "FOREIGN KEY · buscarVeiculoPorPlaca()"],
    ["RNF05", "Usabilidade", "Menu interativo em C e dashboard web responsivo.", "lerInteiro() valida entradas"]
  ];
  const reqGrid = $("#req-grid");
  function renderReqs(f) {
    reqGrid.innerHTML = REQS.filter(([id]) => f === "todos" || (f === "RF" ? !id.startsWith("RNF") : id.startsWith("RNF")))
      .map(([id, t, d, w]) => `<article class="req ${id.startsWith("RNF") ? "rnf" : ""}"><span class="id">${id}</span><h4>${t}</h4><p>${d}</p><span class="where">→ ${esc(w)}</span></article>`).join("");
    if (window.gsap && !reduceMotion) gsap.from(".req", { autoAlpha: 0, y: 16, stagger: .04, duration: .4, ease: "power2.out" });
  }
  $$("[data-req]").forEach((c) => c.addEventListener("click", () => {
    $$("[data-req]").forEach((x) => x.classList.toggle("active", x === c));
    renderReqs(c.dataset.req);
  }));
  renderReqs("todos");

  /* ------------------------------------------------ realce de sintaxe */
  const KW = {
    sql: /\b(CREATE|TABLE|INT|VARCHAR|TEXT|DATETIME|TIMESTAMP|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|UNIQUE|DEFAULT|AUTO_INCREMENT|CHECK|IN|INDEX|ON|SELECT|FROM|WHERE|INNER|LEFT|JOIN|ORDER|BY|DESC|AS|INSERT|INTO|VALUES|UPDATE|SET|COUNT|SUM|CASE|WHEN|THEN|ELSE|END|ROUND|COALESCE|START|TRANSACTION|COMMIT|AND|CURRENT_TIMESTAMP|NOW)\b/,
    c: /\b(void|int|char|double|const|return|if|else|for|while|typedef|struct|FILE|NULL|sizeof|static)\b/,
    js: /\b(db|createIndex|expireAfterSeconds)\b/,
    json: /\b(true|false|null)\b/
  };
  function highlight(code, lang) {
    const src = code.textContent;
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b-?\d+(?:\.\d+)?\b)|(#include|[A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
    let out = "", m;
    while ((m = re.exec(src))) {
      if (m[1]) out += `<span class="tok-c">${esc(m[1])}</span>`;
      else if (m[2]) {
        const isKey = lang === "json" && /^\s*:/.test(src.slice(re.lastIndex));
        out += `<span class="${isKey ? "tok-t" : "tok-s"}">${esc(m[2])}</span>`;
      } else if (m[3]) out += `<span class="tok-n">${m[3]}</span>`;
      else if (m[4]) {
        if (m[4] === "#include") out += `<span class="tok-p">${m[4]}</span>`;
        else if (KW[lang] && KW[lang].test(m[4]) && m[4].match(KW[lang])[0] === m[4]) out += `<span class="tok-k">${m[4]}</span>`;
        else if (/^(TB_|Veiculo|Frota|OrdemServico)/.test(m[4])) out += `<span class="tok-t">${m[4]}</span>`;
        else out += esc(m[4]);
      } else out += esc(m[5]);
    }
    code.innerHTML = out;
  }
  $$("code[class^='lang-']").forEach((c) => highlight(c, c.className.replace("lang-", "")));

  $$(".copy-btn").forEach((b) => b.addEventListener("click", async () => {
    const txt = b.parentElement.querySelector("code").textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = "Copiado ✓"; }
    catch (e) { b.textContent = "Selecione e copie"; }
    setTimeout(() => { b.textContent = "Copiar"; }, 1800);
  }));

  /* ------------------------------------------------ botão PDF */
  $("#btn-pdf").addEventListener("click", async (e) => {
    const a = e.currentTarget;
    if (location.protocol === "file:") return;
    e.preventDefault();
    try {
      const r = await fetch(a.getAttribute("href"), { method: "HEAD" });
      if (!r.ok) throw new Error("ausente");
      window.location.href = a.getAttribute("href");
    } catch (err) {
      toast("O relatório em PDF acompanha o pacote do projeto (pasta docs/). Publique-a junto com o site para ativar o download.");
    }
  });

  /* =================================================
     TERMINAL — simulação do executável em C
     ================================================= */
  const screen = $("#term-screen");
  const form = $("#term-form");
  const input = $("#term-in");
  const promptEl = $("#term-prompt");
  const SEED_FROTA = [
    { id: 1, placa: "BRA2E19", prefixo: "BUS-9042", modelo: "Caio Millennium BRT", ano: 2021, el: "OPERACIONAL", ra: "OPERACIONAL" },
    { id: 2, placa: "FIX3D45", prefixo: "BUS-7110", modelo: "Marcopolo Torino", ano: 2019, el: "OPERACIONAL", ra: "OPERACIONAL" }
  ];
  const ENTRADA_IOT = [
    '{"bus_id": "BUS-9042", "timestamp": "2026-11-18T14:30:00Z", "accessibility_sensors": {"hydraulic_ramp_status": "OK"}, "battery_voltage": 24.8}',
    '{"bus_id": "BUS-7110", "timestamp": "2026-11-18T14:30:05Z", "accessibility_sensors": {"hydraulic_ramp_status": "WARN"}, "battery_voltage": 23.9}',
    '{"bus_id": "BUS-9042", "timestamp": "2026-11-18T14:30:10Z", "accessibility_sensors": {"hydraulic_ramp_status": "FAIL"}, "battery_voltage": 24.6}',
    '{"bus_id": "BUS-3307", "timestamp": "2026-11-18T14:30:15Z", "accessibility_sensors": {"hydraulic_ramp_status": "OK"}, "battery_voltage": 24.1}',
    '{"bus_id": "BUS-0001", "timestamp": "2026-11-18T14:30:20Z", "accessibility_sensors": {"hydraulic_ramp_status": "OK"}, "battery_voltage": 24.0}'
  ];
  const OPERADORES = { gestor: ["gestor123", "GESTOR"], mecanico: ["mec123", "MECANICO"], fiscal: ["fiscal123", "FISCAL"] };
  /* "disco" virtual: sobrevive ao botão Reiniciar, como os arquivos .txt reais */
  const disk = { frota: "", ordens: "", tele: "" };
  const serializeFrota = (f) => f.map((v) => [v.id, v.placa, v.prefixo, v.modelo, v.ano, v.el, v.ra].join(";")).join("\n");
  const serializeOS = (o) => o.map((x) => [x.id, x.placa, x.tipo, x.desc, x.ab, x.ag, x.co, x.st].join(";")).join("\n");
  function resetDisk() { disk.frota = serializeFrota(SEED_FROTA); disk.ordens = ""; disk.tele = ""; renderDisk(); }
  function renderDisk(changed) {
    const set = (id, txt) => {
      const el = $(id);
      el.textContent = txt ? txt + "\n" : "(vazio)";
      if (changed && changed.includes(id)) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
    };
    set("#file-frota", disk.frota); set("#file-ordens", disk.ordens); set("#file-tele", disk.tele);
  }
  const loadFrota = () => disk.frota.split("\n").filter(Boolean).map((l) => {
    const p = l.split(";"); return { id: +p[0], placa: p[1], prefixo: p[2], modelo: p[3], ano: +p[4], el: p[5], ra: p[6] };
  });
  const loadOS = () => disk.ordens.split("\n").filter(Boolean).map((l) => {
    const p = l.split(";"); return { id: +p[0], placa: p[1], tipo: p[2], desc: p[3], ab: p[4], ag: p[5], co: p[6], st: p[7] };
  });

  let runId = 0, pending = null, busy = false, demoRunning = false;
  function out(text, cls) {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    screen.appendChild(span);
    screen.scrollTop = screen.scrollHeight;
  }
  function ask(label, opts = {}) {
    out(label);
    promptEl.textContent = label.trim() || ">";
    input.type = opts.password ? "password" : "text";
    const myRun = runId;
    return new Promise((resolve, reject) => { pending = { resolve, reject, myRun, opts }; });
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (demoRunning && !e.isDemo) return;          /* durante a demo, o teclado fica bloqueado */
    const v = input.value;
    input.value = "";
    if (!pending) {                                  /* programa encerrado: não acumula texto */
      out("\n(o programa nao esta aguardando entrada — clique em \"Reiniciar programa\")\n", "err");
      return;
    }
    out((pending.opts.password ? "•".repeat(v.length) : v) + "\n", "in");
    const p = pending; pending = null;
    p.resolve(v);
  });
  const abort = () => { runId++; if (pending) { pending.reject("abort"); pending = null; } };

  const pad = (s, n) => String(s).padEnd(n);
  const now = () => { const d = new Date(), z = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };

  async function lerTexto(label, size) {
    for (;;) {
      let v = (await ask(label)).slice(0, size - 1);
      if (v.includes(";")) { out("  [!] O caractere ';' e reservado ao arquivo de dados.\n", "err"); continue; }
      if (v.trim() !== "") return v.trim();
    }
  }
  async function lerInteiro(label, min, max) {
    for (;;) {
      const v = (await ask(label)).trim();
      if (/^-?\d+$/.test(v) && +v >= min && +v <= max) return +v;
      out(`  [!] Valor invalido. Informe um numero entre ${min} e ${max}.\n`, "err");
    }
  }

  async function programa() {
    const my = ++runId;
    screen.textContent = "";
    let frota = loadFrota(), ordens = loadOS();
    const salvarFrota = () => { disk.frota = serializeFrota(frota); renderDisk(["#file-frota"]); };
    const salvarOS = () => { disk.ordens = serializeOS(ordens); renderDisk(["#file-ordens"]); };
    const porPlaca = (p) => frota.findIndex((v) => v.placa === p);
    const proxId = (arr) => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    out("$ ./urbano\n", "hd");
    out("Operadores padrao (criados no primeiro acesso):\n  gestor   / gestor123  -> acesso total\n  mecanico / mec123     -> diagnostico e ordens de servico\n  fiscal   / fiscal123  -> somente consultas e relatorios\n", "ok");
    out(`Dados carregados do disco: ${frota.length} veiculo(s), ${ordens.length} ordem(ns).\n`);

    let login = null, perfil = null;
    for (let t = 3; t > 0 && !perfil; t--) {
      out("\n--- LOGIN DE OPERADOR (RF07) ---\n", "hd");
      const u = await lerTexto("Usuario: ", 20);
      const s = await ask("Senha: ", { password: true });
      if (OPERADORES[u] && OPERADORES[u][0] === s) { login = u; perfil = OPERADORES[u][1]; }
      else out(`  [!] Credenciais invalidas. Tentativas restantes: ${t - 1}\n`, "err");
    }
    if (!perfil) { out("Acesso bloqueado apos 3 tentativas.\n", "err"); promptEl.textContent = "processo encerrado"; return; }

    const permitido = (op) => {
      if ([1, 9].includes(op)) return perfil === "GESTOR";
      if ([2, 3, 4, 7, 10].includes(op)) return perfil !== "FISCAL";
      return true;
    };
    const escolherStatus = async (rot) => {
      out(`${rot}\n  1 - OPERACIONAL\n  2 - ALERTA\n  3 - QUEBRADO\n`);
      return ["OPERACIONAL", "ALERTA", "QUEBRADO"][(await lerInteiro("  Opcao: ", 1, 3)) - 1];
    };
    const abrirOrdem = (placa, tipo, desc, agendada) => {
      const o = { id: proxId(ordens), placa, tipo, desc: desc.slice(0, 99), ab: now(), ag: agendada || "-", co: "-", st: agendada ? "AGENDADA" : "EM_ABERTO" };
      ordens.push(o); salvarOS(); return o.id;
    };
    const processarPacote = (json) => {
      const g = (k) => { const m = json.match(new RegExp(`"${k}"\\s*:\\s*"?([^",}\\s]+)`)); return m ? m[1] : null; };
      const bus = g("bus_id"), st = g("hydraulic_ramp_status");
      if (!bus || !st) { out("  [!] Pacote mal formado descartado.\n", "err"); return 0; }
      const v = frota.find((x) => x.prefixo === bus);
      if (!v) { out(`  [!] ${bus} nao pertence a frota cadastrada. Pacote ignorado.\n`, "err"); return 0; }
      disk.tele += (disk.tele ? "\n" : "") + `${g("timestamp") || "-"};${bus};${st};${(+g("battery_voltage") || 0).toFixed(1)}`;
      renderDisk(["#file-tele"]);
      if (st === "OK") { out(`  ${bus} (${v.placa}): sensores OK.\n`, "ok"); return 1; }
      v.el = st === "WARN" ? "ALERTA" : "QUEBRADO"; salvarFrota();
      const aberta = ordens.some((o) => o.placa === v.placa && o.tipo === "CORRETIVA" && o.st === "EM_ABERTO");
      if (v.el !== "QUEBRADO" || aberta) { out(`  ${bus} (${v.placa}): status ${v.el} registrado.\n`); return 1; }
      const id = abrirOrdem(v.placa, "CORRETIVA", `[AUTO IoT] Falha no elevador reportada pelo sensor ${bus}`);
      out(`  ${bus} (${v.placa}): FALHA! OS automatica #${id} aberta.\n`, "err");
      return 2;
    };

    const acoes = {
      1: async () => {
        out("\n=== RF01 - CADASTRO DE ONIBUS ===\n", "hd");
        const placa = (await lerTexto("Placa (ex.: BRA2E19): ", 9)).toUpperCase();
        if (placa.length < 7) return out("  [!] Placa deve ter ao menos 7 caracteres.\n", "err");
        if (porPlaca(placa) >= 0) return out(`  [!] Ja existe um veiculo com a placa ${placa}.\n`, "err");
        const prefixo = (await lerTexto("Prefixo IoT (ex.: BUS-9042): ", 12)).toUpperCase();
        if (frota.some((v) => v.prefixo === prefixo)) return out(`  [!] Prefixo ${prefixo} ja esta associado a outro veiculo.\n`, "err");
        const modelo = await lerTexto("Modelo: ", 30);
        const ano = await lerInteiro("Ano de fabricacao (1990-2027): ", 1990, 2027);
        const v = { id: proxId(frota), placa, prefixo, modelo, ano, el: "OPERACIONAL", ra: "OPERACIONAL" };
        frota.push(v); salvarFrota();
        out(`>> Veiculo ${placa} (ID ${v.id}) cadastrado e salvo em frota_urbanoacessivel.txt.\n`, "ok");
      },
      2: async () => {
        out("\n=== RF02 - DIAGNOSTICO DE ACESSIBILIDADE ===\n", "hd");
        const placa = (await lerTexto("Placa do veiculo: ", 9)).toUpperCase();
        const i = porPlaca(placa);
        if (i < 0) return out(`  [!] Veiculo ${placa} nao encontrado.\n`, "err");
        frota[i].el = await escolherStatus("Status do elevador hidraulico:");
        frota[i].ra = await escolherStatus("Status da rampa de acesso:");
        salvarFrota();
        out(`>> Diagnostico salvo: elevador ${frota[i].el}, rampa ${frota[i].ra}.\n`, "ok");
      },
      3: async () => {
        out("\n=== RF03 - ABRIR ORDEM DE SERVICO ===\n", "hd");
        const placa = (await lerTexto("Placa do veiculo: ", 9)).toUpperCase();
        if (porPlaca(placa) < 0) return out(`  [RNF04] Recusado: veiculo ${placa} nao existe na frota.\n`, "err");
        const desc = await lerTexto("Descricao da falha: ", 100);
        out(`>> OS #${abrirOrdem(placa, "CORRETIVA", desc)} aberta para o veiculo ${placa}.\n`, "ok");
      },
      4: async () => {
        out("\n=== RF04 - AGENDAR MANUTENCAO PREVENTIVA ===\n", "hd");
        const placa = (await lerTexto("Placa do veiculo: ", 9)).toUpperCase();
        if (porPlaca(placa) < 0) return out(`  [RNF04] Recusado: veiculo ${placa} nao existe na frota.\n`, "err");
        const d = await lerInteiro("Dia (1-31): ", 1, 31), m = await lerInteiro("Mes (1-12): ", 1, 12), a = await lerInteiro("Ano (2026-2030): ", 2026, 2030);
        const data = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} 08:00`;
        const desc = await lerTexto("Servico previsto: ", 100);
        out(`>> Preventiva #${abrirOrdem(placa, "PREVENTIVA", desc, data)} agendada para ${data}.\n`, "ok");
      },
      5: async () => {
        out("\n=== RF05 - HISTORICO DO VEICULO ===\n", "hd");
        const placa = (await lerTexto("Placa: ", 9)).toUpperCase();
        if (porPlaca(placa) < 0) return out(`  [!] Veiculo ${placa} nao cadastrado.\n`, "err");
        const h = ordens.filter((o) => o.placa === placa);
        h.forEach((o) => out(`OS #${pad(o.id, 4)} ${pad(o.tipo, 10)} ${pad(o.st, 10)} aberta ${o.ab} | agendada ${o.ag} | concluida ${o.co}\n    ${o.desc}\n`));
        out(`-- ${h.length} registro(s) para ${placa}.\n`);
      },
      6: async () => {
        out("\n=== RF06 - RELATORIO DE FROTA OPERACIONAL ===\n", "hd");
        if (!frota.length) return out("Frota vazia.\n");
        let at = 0, al = 0, qb = 0;
        frota.forEach((v) => {
          if (v.el === "QUEBRADO" || v.ra === "QUEBRADO") qb++;
          else if (v.el === "ALERTA" || v.ra === "ALERTA") al++;
          else at++;
        });
        const pc = (n) => (100 * n / frota.length).toFixed(1) + "%";
        out(`Total de veiculos ........: ${frota.length}\nAcessibilidade 100% ativa : ${at} (${pc(at)})\nEm alerta ................: ${al} (${pc(al)})\nCom equipamento quebrado .: ${qb} (${pc(qb)})\n`);
      },
      7: async () => {
        out("\n=== CONCLUIR ORDEM DE SERVICO ===\n", "hd");
        const id = await lerInteiro("Numero da OS: ", 1, 999999);
        const o = ordens.find((x) => x.id === id);
        if (!o) return out(`  [!] OS #${id} nao encontrada.\n`, "err");
        if (o.st === "CONCLUIDA") return out(`  [!] A OS #${id} ja esta concluida.\n`, "err");
        o.st = "CONCLUIDA"; o.co = now(); salvarOS();
        const i = porPlaca(o.placa);
        if (i >= 0 && o.tipo === "CORRETIVA") { frota[i].el = "OPERACIONAL"; frota[i].ra = "OPERACIONAL"; salvarFrota(); }
        out(`>> OS #${id} concluida em ${o.co}.\n`, "ok");
      },
      8: async () => {
        out("\n=== RELATORIO DE FROTA CADASTRADA (ARQUIVO EM DISCO) ===\n", "hd");
        if (!frota.length) out("Nenhum registro de frota encontrado.\n");
        else {
          out(`${pad("ID", 4)} ${pad("PLACA", 9)} ${pad("PREFIXO", 10)} ${pad("MODELO", 22)} ${pad("ANO", 5)} ${pad("ELEVADOR", 12)} RAMPA\n`);
          frota.forEach((v) => out(`${pad(v.id, 4)} ${pad(v.placa, 9)} ${pad(v.prefixo, 10)} ${pad(v.modelo, 22)} ${pad(v.ano, 5)} ${pad(v.el, 12)} ${v.ra}\n`));
        }
        out("\n=== ORDENS EM ABERTO / AGENDADAS ===\n", "hd");
        const p = ordens.filter((o) => o.st !== "CONCLUIDA");
        if (!p.length) out("Nenhuma ordem pendente.\n");
        p.forEach((o) => out(`OS #${pad(o.id, 4)} ${pad(o.placa, 9)} ${pad(o.tipo, 10)} ${pad(o.st, 10)} ${o.desc}\n`));
      },
      9: async () => {
        out("\n=== RF08 - INGESTAO DE LOG TELEMETRICO ===\n", "hd");
        let tot = 0, os = 0;
        ENTRADA_IOT.forEach((l) => { const r = processarPacote(l); if (r) tot++; if (r === 2) os++; });
        out(`>> ${tot} pacote(s) gravados em telemetria_log.txt; ${os} OS automatica(s).\n`, "ok");
      },
      10: async () => {
        out("\nCole o pacote JSON em uma unica linha:\n");
        processarPacote(await lerTexto("> ", 400));
      }
    };

    for (;;) {
      if (my !== runId) return;
      out(`\n==========================================================\n  URBANOACESSIVEL S.A. - Gestao de Frota e Acessibilidade\n  Operador: ${login} (${perfil})\n==========================================================\n`, "hd");
      out("  1  - Cadastrar onibus                 (RF01)\n  2  - Registrar diagnostico            (RF02)\n  3  - Abrir ordem de servico           (RF03)\n  4  - Agendar manutencao preventiva    (RF04)\n  5  - Consultar historico do veiculo   (RF05)\n  6  - Relatorio de frota operacional   (RF06)\n  7  - Concluir ordem de servico\n  8  - Listar frota / ordens pendentes\n  9  - Ingerir arquivo de telemetria    (RF08)\n  10 - Ingerir pacote JSON avulso       (RF08)\n  0  - Sair\n");
      const op = await lerInteiro("Escolha: ", 0, 10);
      if (op === 0) { out("Dados persistidos. Ate logo!\n", "ok"); promptEl.textContent = "processo encerrado — clique em Reiniciar"; return; }
      if (!permitido(op)) { out(`  [RF07] Perfil ${perfil} sem permissao para esta operacao.\n`, "err"); continue; }
      await acoes[op]();
    }
  }
  const start = () => {
    abort();
    programa().catch((e) => {
      if (e === "abort") return;
      console.error(e);
      out("\n[erro interno do simulador] clique em \"Reiniciar programa\".\n", "err");
    });
  };

  /* Envia um valor ao programa como se fosse digitado, esperando ele pedir a entrada */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function digitar(valor, myRun, speed) {
    for (let t = 0; !pending && t < 100; t++) await wait(20);
    if (!pending || myRun !== runId) return false;
    for (const ch of valor) { input.value += ch; if (speed) await wait(45); }
    if (speed) await wait(150);
    const ev = new Event("submit", { cancelable: true });
    ev.isDemo = true;
    form.dispatchEvent(ev);
    return true;
  }
  function travarTerminal(on) {
    busy = demoRunning = on;
    input.readOnly = on;
    $$(".term-btn, .cred-btn").forEach((b) => { b.disabled = on; });
    $("#term-hint").textContent = on
      ? "Demonstração em andamento — o teclado volta a funcionar ao final."
      : "Digite e pressione Enter. Use as credenciais do painel acima do terminal.";
  }

  /* Botões "Entrar como ..." do painel de credenciais */
  $$(".cred-btn").forEach((b) => b.addEventListener("click", async () => {
    if (busy) return;
    travarTerminal(true);
    start();
    const my = runId;
    await digitar(b.dataset.user, my, 1) && await digitar(b.dataset.pass, my, 1);
    travarTerminal(false);
    input.focus({ preventScroll: true });
  }));

  $("#term-restart").addEventListener("click", () => { if (!busy) { start(); input.focus({ preventScroll: true }); } });
  $("#term-demo").addEventListener("click", async () => {
    if (busy) return;
    travarTerminal(true);
    input.value = "";
    resetDisk();
    start();
    const my = runId;
    out("(demo: disco restaurado para o estado inicial)\n", "hd");
    const seq = ["gestor", "gestor123", "1", "GHT5J88", "BUS-3307", "Mercedes-Benz O500U", "2022",
      "3", "XYZ9999", "9", "6", "5", "BRA2E19", "7", "1", "6"];
    const speed = reduceMotion ? 0 : 1;
    for (const s of seq) {
      await wait(450 * speed + 30);
      if (!(await digitar(s, my, speed))) break;     /* programa reiniciado: interrompe a demo */
    }
    travarTerminal(false);
  });
  resetDisk();
  start();
  screen.addEventListener("click", () => input.focus({ preventScroll: true }));

  /* =================================================
     GSAP · ScrollTrigger · Parallax
     ================================================= */
  let ctx = null;
  function setupAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;   /* sem CDN: conteúdo continua visível */
    gsap.registerPlugin(ScrollTrigger);
    if (ctx) ctx.revert();
    document.body.classList.toggle("reduce-motion", reduceMotion);
    $$(".trunk").forEach((t) => t.classList.toggle("pulse", !reduceMotion));
    if (reduceMotion) { ctx = null; return; }

    ctx = gsap.context(() => {
      /* Entrada do hero */
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-title .line", { yPercent: 60, autoAlpha: 0, duration: .9, stagger: .12 })
        .from(".hero .reveal", { y: 24, autoAlpha: 0, duration: .7, stagger: .1 }, "-=.5")
        .from(".bus", { xPercent: -140, duration: 1.6, ease: "power2.out" }, 0.2)
        .from(".bus-ramp", { scaleX: 0, autoAlpha: 0, duration: .6 }, "-=.2");
      gsap.to(".bus-signal path", { opacity: .15, duration: .7, stagger: { each: .2, repeat: -1, yoyo: true } });

      /* Contadores */
      $$("[data-count]").forEach((el) => {
        const o = { v: 0 };
        gsap.to(o, { v: +el.dataset.count, duration: 1.4, delay: .6, ease: "power1.out", onUpdate: () => { el.textContent = Math.round(o.v); } });
      });

      /* Parallax das camadas do hero (velocidades diferentes) */
      $$(".hero .layer").forEach((layer) => {
        gsap.to(layer, {
          yPercent: -40 * parseFloat(layer.dataset.speed || 0.3), ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
        });
      });
      gsap.to(".bus", { x: () => window.innerWidth * .45, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });
      gsap.to(".hero-content", { y: -80, autoAlpha: .2, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

      /* Parallax por movimento do mouse (somente telas com ponteiro fino) */
      if (window.matchMedia("(pointer: fine)").matches) {
        const hero = $(".hero");
        const layers = $$(".layer-nodes, .layer-glow, .layer-city", hero);
        hero.addEventListener("mousemove", (e) => {
          const cx = e.clientX / window.innerWidth - .5, cy = e.clientY / window.innerHeight - .5;
          layers.forEach((l, i) => gsap.to(l, { x: cx * (12 + i * 14), y: cy * (8 + i * 8), duration: .8, overwrite: "auto" }));
        });
      }

      /* Decorações das seções */
      $$(".parallax-deco").forEach((d) => {
        gsap.to(d, { yPercent: 100 * parseFloat(d.dataset.speed), ease: "none",
          scrollTrigger: { trigger: d.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });

      /* Cabeçalhos de seção */
      $$(".section-head").forEach((h) => {
        gsap.from(h.children, { y: 30, autoAlpha: 0, duration: .8, stagger: .1, ease: "power3.out",
          scrollTrigger: { trigger: h, start: "top 82%" } });
      });

      /* Linha do tempo: preenchimento com scrub + cartões alternados */
      gsap.fromTo(".track-fill", { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none",
        scrollTrigger: { trigger: ".timeline", start: "top 70%", end: "bottom 60%", scrub: true } });
      $$(".milestone").forEach((m) => {
        const fromX = window.innerWidth > 820 ? (m.classList.contains("left") ? -60 : 60) : 30;
        gsap.from(m.querySelector(".card"), { x: fromX, autoAlpha: 0, duration: .8, ease: "power3.out",
          scrollTrigger: { trigger: m, start: "top 85%" } });
        gsap.from(m.querySelector(".dot"), { scale: 0, duration: .5, ease: "back.out(3)",
          scrollTrigger: { trigger: m, start: "top 85%" } });
      });
      $$(".phase").forEach((p) => gsap.from(p, { scale: .9, autoAlpha: 0, duration: .6, scrollTrigger: { trigger: p, start: "top 85%" } }));

      /* Topologia: dispositivos surgem de cima para baixo */
      gsap.from("#topo-diagram .topo-dev", { y: -20, autoAlpha: 0, duration: .5, stagger: .07, ease: "power2.out",
        scrollTrigger: { trigger: "#topo-diagram", start: "top 75%" } });

      /* Grupos de cartões */
      [".cloud-grid", ".sprint-grid", ".rights-grid", ".nf-grid"].forEach((sel) => {
        const g = $(sel);
        if (!g) return;
        gsap.from(g.children, { y: 40, autoAlpha: 0, duration: .7, stagger: .1, ease: "power3.out",
          scrollTrigger: { trigger: g, start: "top 85%" } });
      });
      [".tabs", ".term-window", ".disk-panel", ".impact", ".table-wrap"].forEach((sel) => {
        $$(sel).forEach((el) => gsap.fromTo(el, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" } }));
      });
      gsap.from(".flow li", { scale: .6, autoAlpha: 0, duration: .5, stagger: .12, ease: "back.out(2)",
        scrollTrigger: { trigger: ".flow", start: "top 90%" } });
    });
    ScrollTrigger.refresh();
  }
  sysReduce.addEventListener && sysReduce.addEventListener("change", (e) => { reduceMotion = e.matches; setupAnimations(); });
  if (document.readyState === "complete") setupAnimations();
  else window.addEventListener("load", setupAnimations);
})();
