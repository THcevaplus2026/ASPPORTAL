// =========================================
// 1. ESTADO GLOBAL E CONFIGURAÇÕES
// =========================================
let bancoDeDados = [];
let fotosTemporarias = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let logadoQualidade = false;

const SUPABASE_URL = 'https://kwolnazucrsjlmsxiayk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O--zQ5iTNhVha54E16oRLA_Q-h0A5G8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let categoriaAtualExemplo = '';
const BUCKET_NAME = 'exemplos';

// =========================================
// 2. COMPONENTES DE INTERFACE E LOADING
// =========================================

function showLoading(msg = "A PROCESSAR...") {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
        text.innerText = msg;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function dialog(msg, callback = null, tipo = 'info') {
    const modal = document.getElementById('custom-dialog');
    const title = document.getElementById('dialog-title');
    const message = document.getElementById('dialog-message');
    const footer = document.getElementById('dialog-footer');
    const icon = document.getElementById('dialog-icon');
    const header = document.getElementById('dialog-header');

    const temas = {
        info: { cor: '#3498db', icon: 'info', titulo: 'SISTEMA' },
        sucesso: { cor: '#27ae60', icon: 'check_circle', titulo: 'SUCESSO' },
        perigo: { cor: '#e74c3c', icon: 'warning', titulo: 'ATENÇÃO' }
    };

    const tema = temas[tipo] || temas.info;

    header.style.background = tema.cor;
    icon.style.color = tema.cor;
    icon.innerText = tema.icon;
    title.innerText = tema.titulo;
    message.innerText = msg;
    footer.innerHTML = "";

    if (callback) {
        const btnNao = document.createElement('button');
        btnNao.className = "btn-cancel";
        btnNao.innerText = "CANCELAR";
        btnNao.onclick = () => { modal.style.display = 'none'; };

        const btnSim = document.createElement('button');
        btnSim.className = "btn-save";
        btnSim.innerText = "CONFIRMAR";
        btnSim.style.background = tema.cor;
        btnSim.onclick = () => { modal.style.display = 'none'; callback(); };

        footer.appendChild(btnNao);
        footer.appendChild(btnSim);
    } else {
        const btnOk = document.createElement('button');
        btnOk.className = "btn-save";
        btnOk.innerText = "OK";
        btnOk.style.background = tema.cor;
        btnOk.onclick = () => { modal.style.display = 'none'; };
        footer.appendChild(btnOk);
    }
    modal.style.display = 'flex';
}

// =========================================
// 3. LÓGICA DE GERAÇÃO DE PDF E DOWNLOAD JPG
// =========================================

function baixarImagemIndividual(base64, index) {
    const nf = document.getElementById('nf').value || "REGISTRO";
    const link = document.createElement('a');
    link.href = base64;
    link.download = `NF_${nf}_FOTO_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function gerarPDF(id) {
    const item = bancoDeDados.find(i => i.id == id);
    if (!item) return;

    showLoading("GERANDO PDF...");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("RELATÓRIO DE RECEBIMENTO", 105, 20, { align: "center" });

        doc.setFontSize(11);
        doc.text(`NF: ${item.nf}`, 20, 40);
        doc.text(`Conferente: ${item.conferente}`, 20, 48);
        doc.text(`Data: ${item.data} | Hora: ${item.hora}`, 20, 56);
        doc.text(`Quantidade: ${item.quantidade}`, 20, 64);
        doc.setFontSize(10);
        doc.text(`Observações: ${item.observacoes || "Nenhuma"}`, 20, 72);

        let yPos = 85;
        for (let i = 0; i < item.fotos.length; i++) {
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }
            const xPos = (i % 2 === 0) ? 20 : 110;
            doc.addImage(item.fotos[i], 'JPEG', xPos, yPos, 80, 60);

            if (i % 2 !== 0 || i === item.fotos.length - 1) {
                yPos += 70;
            }
        }

        doc.save(`RECEBIMENTO_NF_${item.nf}.pdf`);
    } catch (e) {
        console.error(e);
        dialog("Erro ao gerar o PDF.", null, 'perigo');
    } finally {
        hideLoading();
    }
}

// =========================================
// 4. LÓGICA DE BANCO DE DADOS (ATUALIZADA)
// =========================================

async function carregarDadosSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('recebimentos')
            .select('*');

        if (error) throw error;

        bancoDeDados = (data || []).sort((a, b) => b.id - a.id);

        atualizarPainelRecebimento();

        if (document.getElementById('tela-finalizado').style.display !== 'none') filtrarHistorico();
        if (document.getElementById('tela-qualidade').style.display !== 'none') filtrarQualidade();
    } catch (err) {
        console.error("Erro Supabase:", err.message);
    }
}

document.getElementById('form-recebimento').onsubmit = async function(e) {
    e.preventDefault();
    if (fotosTemporarias.length === 0) {
        return dialog("Adicione ao menos uma foto.", null, 'perigo');
    }

    const nomeConferente = document.getElementById('conferente').value.trim().toUpperCase();

    // Lista de sons aleatórios de sucesso
    const sons = [
        'https://www.myinstants.com/media/sounds/success-fanfare-trumpets.mp3',
        'https://www.myinstants.com/media/sounds/tada.mp3',
        'https://www.myinstants.com/media/sounds/level-up-6-bit.mp3'
    ];
    const somAleatorio = new Audio(sons[Math.floor(Math.random() * sons.length)]);

    // --- EFEITO ESPECIAL: ALISSON (TELA PRETA) ---
    if (nomeConferente === "ALISSON") {
        const telaPreta = document.createElement('div');
        telaPreta.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:black; z-index:9999; display:flex; align-items:center; justify-content:center; flex-direction:column; transition: opacity 0.5s;";
        telaPreta.innerHTML = `
            <span class="material-icons" style="color:white; font-size:100px; margin-bottom:20px;">visibility_off</span>
            <h1 style="color:white; font-family:sans-serif; letter-spacing:10px;">MODO DARK</h1>
        `;
        document.body.appendChild(telaPreta);

        await new Promise(resolve => setTimeout(() => {
            telaPreta.style.opacity = "0";
            setTimeout(() => {
                document.body.removeChild(telaPreta);
                resolve();
            }, 500);
        }, 2000));
    }

    showLoading("SALVANDO REGISTRO...");
    const idEdit = document.getElementById('edit-id').value;
    const registro = {
        fotos: fotosTemporarias,
        conferente: document.getElementById('conferente').value,
        nf: document.getElementById('nf').value,
        quantidade: parseInt(document.getElementById('qty').value),
        data: document.getElementById('data').value,
        hora: document.getElementById('hora').value,
        observacoes: document.getElementById('obs').value
    };

    try {
        const { error } = idEdit
            ? await supabaseClient.from('recebimentos').update(registro).eq('id', idEdit)
            : await supabaseClient.from('recebimentos').insert([registro]);

        if (error) throw error;
        hideLoading();

        // --- MENSAGENS E SONS PERSONALIZADOS ---
        let msgFinal = "Salvo com sucesso!";

        if (nomeConferente === "LUANNA") {
            msgFinal = "PETECO, PETECO 😛";
            somAleatorio.play();
        } else if (nomeConferente === "GUILHERME") {
            msgFinal = "É OS D,safada   ";
            somAleatorio.play();
        }

        dialog(msgFinal, () => { fecharModal(); carregarDadosSupabase(); }, 'sucesso');
    } catch (err) {
        hideLoading();
        dialog("Erro: " + err.message, null, 'perigo');
    }
};

// =========================================
// 5. ABA DE EXEMPLOS (STORAGE)
// =========================================

async function abrirModalExemplo(categoria) {
    categoriaAtualExemplo = categoria;
    const modal = document.getElementById('modal-exemplos');
    const titulo = document.getElementById('exemplo-titulo');
    const informativo = document.getElementById('informativo-exemplo');

    const config = {
        cidex: {
            t: "CIDEX / SANEANTES",
            d: "<b>Registros Fotográficos:</b><br>• Placa do veículo<br>• Material (4 lados do palete)<br>• Registro de avarias<br>• Sensores de temperatura"
        },
        dispositivos: {
            t: "DISPOSITIVOS MÉDICOS",
            d: "<b>Registros Fotográficos:</b><br>• Placa do veículo<br>• Material (interior e exterior)<br>• Registro de avarias<br>• Sensores de temperatura<br>• Itens no cooler/caixas: Velocity, Cassete, Indicador Químico e Booster"
        },
        maquinas: {
            t: "MÁQUINAS",
            d: "<b>Registros Fotográficos:</b><br>• Placa do veículo<br>• Máquina (interior e exterior)<br>• Registro de avarias<br>• Indicadores de segurança (Tip-N-Tell e ShockWatch)"
        }
    };

    titulo.innerText = config[categoria].t;
    informativo.innerHTML = config[categoria].d;
    modal.style.display = 'flex';
    carregarFotosExemplo();
}

async function carregarFotosExemplo() {
    const container = document.getElementById('container-fotos-exemplo');
    if (!container) return;
    container.innerHTML = "<p>Buscando modelos...</p>";

    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .list(categoriaAtualExemplo);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p>Nenhuma foto cadastrada.</p>";
            return;
        }

        container.innerHTML = data.map(file => {
            const { data: urlData } = supabaseClient.storage
                .from(BUCKET_NAME)
                .getPublicUrl(`${categoriaAtualExemplo}/${file.name}`);

            return `
                <div class="preview-item" style="height: 140px;">
                    <img src="${urlData.publicUrl}" onclick="window.open('${urlData.publicUrl}')" style="cursor:zoom-in">
                    <button class="btn-remove-foto" onclick="removerFotoExemplo('${file.name}')">×</button>
                </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = "<p>Erro ao carregar.</p>";
    }
}

async function adicionarFotoExemplo(input) {
    if (!input.files || input.files.length === 0) return;

    showLoading("ENVIANDO...");
    try {
        for (let file of input.files) {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const filePath = `${categoriaAtualExemplo}/${fileName}`;

            const { error } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);

            if (error) throw error;
        }
        carregarFotosExemplo();
    } catch (e) {
        dialog("Falha no upload: " + e.message, null, 'perigo');
    } finally {
        input.value = "";
        hideLoading();
    }
}

async function removerFotoExemplo(fileName) {
    dialog("Excluir este modelo?", async () => {
        showLoading("REMOVENDO...");
        try {
            const { error } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .remove([`${categoriaAtualExemplo}/${fileName}`]);
            if (error) throw error;
            carregarFotosExemplo();
        } catch (e) {
            dialog("Erro ao remover.", null, 'perigo');
        } finally {
            hideLoading();
        }
    }, 'perigo');
}

// =========================================
// 6. PROCESSAMENTO E UTILITÁRIOS
// =========================================

async function comprimirImagem(base64) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const max = 1200;
            let w = img.width, h = img.height;
            if (w > h && w > max) { h *= max/w; w = max; }
            else if (h > max) { w *= max/h; h = max; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

function renderizarPreviews(readOnly) {
    const container = document.getElementById('preview-container');
    if (!container) return;

    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    container.style.gap = "15px";

    container.innerHTML = fotosTemporarias.map((f, i) => `
        <div class="preview-item" style="height: auto; border: 2px solid #ddd; border-radius: 8px; overflow: hidden; background: #fff;">
            <img src="${f}" style="width: 100%; height: 220px; object-fit: cover; cursor: pointer;" onclick="window.open(this.src)">
            <div style="display: flex; border-top: 1px solid #ddd;">
                <button type="button" onclick="baixarImagemIndividual('${f}', ${i})" style="flex: 1; padding: 10px; background: #27ae60; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <span class="material-icons">download</span> BAIXAR JPG
                </button>
                ${!readOnly ? `
                <button type="button" onclick="removerFoto(${i})" style="width: 45px; background: #e74c3c; color: white; border: none; cursor: pointer;">
                    <span class="material-icons">delete</span>
                </button>` : ''}
            </div>
        </div>`).join('');
    document.getElementById('label-fotos').innerText = `EVIDÊNCIAS (${fotosTemporarias.length}/30)`;
}

function removerFoto(i) { fotosTemporarias.splice(i, 1); renderizarPreviews(false); }

function abrirModal(readOnly = false) {
    document.getElementById('form-recebimento').reset();
    document.getElementById('edit-id').value = "";
    fotosTemporarias = [];
    document.getElementById('modal-add').style.display = 'flex';
    document.getElementById('area-fotos').style.display = "block";

    if (!readOnly) {
        const agora = new Date();
        document.getElementById('data').value = agora.toISOString().split('T')[0];
        document.getElementById('hora').value = agora.toTimeString().slice(0, 5);
    }

    const btnSalvar = document.querySelector('#form-recebimento .btn-save');
    if (btnSalvar) btnSalvar.style.display = readOnly ? 'none' : 'block';

    renderizarPreviews(readOnly);
}

function fecharModal() { document.getElementById('modal-add').style.display = 'none'; }
function fecharModalExemplo() { document.getElementById('modal-exemplos').style.display = 'none'; }
function fecharModalSenha() { document.getElementById('modal-senha-qualidade').style.display = 'none'; }

function toggleFotos() {
    const area = document.getElementById('area-fotos');
    const seta = document.getElementById('seta-fotos');
    const isVisible = area.style.display === "block";
    area.style.display = isVisible ? "none" : "block";
    seta.innerText = isVisible ? "expand_more" : "expand_less";
}

function verificarSenhaApp() {
    if (document.getElementById('input-senha-app').value === "159753") {
        logadoQualidade = true;
        fecharModalSenha();
        trocarAba('qualidade');
    } else {
        dialog("Senha incorreta.", null, 'perigo');
    }
}

function trocarAba(aba) {
    if (aba === 'qualidade' && !logadoQualidade) {
        document.getElementById('modal-senha-qualidade').style.display = 'flex';
        return;
    }
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tela-${aba}`).style.display = 'block';
    document.getElementById(`tab-${aba.substring(0,3)}`).classList.add('active');

    paginaAtual = 1;
    if (aba === 'finalizado') filtrarHistorico();
    if (aba === 'qualidade') filtrarQualidade();
}

// =========================================
// 7. FILTROS E LISTAGENS
// =========================================

function atualizarPainelRecebimento() {
    const c = document.getElementById('container-recente');
    if (!c) return;
    if (bancoDeDados.length === 0) {
        c.innerHTML = "<p>Nenhum registro encontrado.</p>";
        return;
    }
    const item = bancoDeDados[0];
    c.innerHTML = `
        <div class="card-registro">
            <div><strong>NF: ${item.nf}</strong><br><small>${item.conferente}</small></div>
            <button class="btn-novo-processo" style="padding: 5px 15px" onclick="editarRegistro('${item.id}', false)">EDITAR</button>
        </div>`;
}

function filtrarHistorico() {
    const termo = document.getElementById('inputPesquisa').value.toLowerCase();
    const filtrados = bancoDeDados.filter(i => i.nf.toString().includes(termo));
    const itens = filtrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
    const container = document.getElementById('container-historico');

    container.innerHTML = itens.map(item => `
        <div class="card-registro">
            <div><strong>NF: ${item.nf}</strong><br><small>${item.conferente}</small></div>
            <button class="btn-novo-processo" style="background:#2f3640; padding:5px 15px" onclick="editarRegistro('${item.id}', true)">VER</button>
        </div>`).join('');
    renderPaginacao(Math.ceil(filtrados.length/itensPorPagina), 'pagination-controls', filtrarHistorico);
}

function filtrarQualidade() {
    const termo = document.getElementById('inputPesquisaQualidade').value.toLowerCase();
    const filtrados = bancoDeDados.filter(i => i.nf.toString().includes(termo));
    const itens = filtrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);
    const container = document.getElementById('container-qualidade');

    container.innerHTML = itens.map(item => `
        <div class="card-registro">
            <div><strong>NF: ${item.nf}</strong><br><small>${item.data} - ${item.conferente}</small></div>
            <div style="display:flex; gap:8px">
                <button title="Gerar PDF" class="btn-novo-processo" style="background:#27ae60; padding:5px" onclick="gerarPDF('${item.id}')">
                    <span class="material-icons">picture_as_pdf</span>
                </button>
                <button title="Editar" class="btn-novo-processo" style="background:#3498db; padding:5px" onclick="editarRegistro('${item.id}', false)">
                    <span class="material-icons">edit</span>
                </button>
                <button title="Excluir" class="btn-novo-processo" style="background:#e74c3c; padding:5px" onclick="excluirPermanente('${item.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>`).join('');
    renderPaginacao(Math.ceil(filtrados.length/itensPorPagina), 'pagination-qualidade', filtrarQualidade);
}

function renderPaginacao(total, id, cb) {
    const c = document.getElementById(id);
    c.innerHTML = "";
    if (total <= 1) return;
    for (let i = 1; i <= total; i++) {
        const b = document.createElement('button');
        b.innerText = i;
        b.className = `btn-pag ${i === paginaAtual ? 'active' : ''}`;
        b.onclick = () => { paginaAtual = i; cb(); };
        c.appendChild(b);
    }
}

function editarRegistro(id, readOnly) {
    const item = bancoDeDados.find(i => i.id == id);
    if (!item) return;
    abrirModal(readOnly);
    document.getElementById('edit-id').value = item.id;
    document.getElementById('nf').value = item.nf;
    document.getElementById('qty').value = item.quantidade;
    document.getElementById('conferente').value = item.conferente;
    document.getElementById('data').value = item.data;
    document.getElementById('hora').value = item.hora;
    document.getElementById('obs').value = item.observacoes;
    fotosTemporarias = [...item.fotos];
    renderizarPreviews(readOnly);
}

async function excluirPermanente(id) {
    dialog("Excluir este registro?", async () => {
        showLoading("EXCLUINDO...");
        await supabaseClient.from('recebimentos').delete().eq('id', id);
        hideLoading();
        carregarDadosSupabase();
    }, 'perigo');
}

document.getElementById('evidencia').onchange = async function(e) {
    showLoading("PROCESSANDO FOTOS...");
    for (let f of e.target.files) {
        const reader = new FileReader();
        const p = new Promise(res => reader.onload = res);
        reader.readAsDataURL(f);
        await p;
        fotosTemporarias.push(await comprimirImagem(reader.result));
    }
    renderizarPreviews(false);
    hideLoading();
    this.value = "";
};

document.addEventListener('DOMContentLoaded', carregarDadosSupabase);