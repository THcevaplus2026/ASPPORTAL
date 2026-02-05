// =========================================
// 1. ESTADO GLOBAL E CONFIGURAÇÕES
// =========================================
let bancoDeDados = [];
let fotosTemporarias = []; // Armazena as fotos em edição/visualização
let paginaAtual = 1;
const itensPorPagina = 10;
let logadoQualidade = false;

// Configuração do Supabase
const SUPABASE_URL = 'https://kwolnazucrsjlmsxiayk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O--zQ5iTNhVha54E16oRLA_Q-h0A5G8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração do Storage (Exemplos)
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

    // Configurações visuais por tipo de mensagem
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

    // Botões do Modal
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
// 3. UTILITÁRIOS: PDF, DOWNLOAD E COMPRESSÃO
// =========================================

// Função otimizada: Pega a imagem da memória pelo índice
function baixarImagemIndividual(index) {
    if (!fotosTemporarias[index]) return;

    const nf = document.getElementById('nf').value || "REGISTRO";
    const link = document.createElement('a');
    link.href = fotosTemporarias[index];
    link.download = `NF_${nf}_FOTO_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Compressão de imagem para não estourar o banco de dados
async function comprimirImagem(base64) {
    return new Promise(resolve => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const max = 1000; // Reduzi levemente para garantir performance
            let w = img.width, h = img.height;

            if (w > h && w > max) { h *= max/w; w = max; }
            else if (h > max) { w *= max/h; h = max; }

            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // Qualidade 70%
        };
    });
}

async function gerarPDF(id) {
    const item = bancoDeDados.find(i => i.id == id);
    if (!item) return;

    showLoading("GERANDO PDF...");
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho
        doc.setFontSize(18);
        doc.text("RELATÓRIO DE RECEBIMENTO", 105, 20, { align: "center" });

        // Dados
        doc.setFontSize(11);
        doc.text(`NF: ${item.nf}`, 20, 40);
        doc.text(`Conferente: ${item.conferente}`, 20, 48);
        doc.text(`Data: ${item.data} | Hora: ${item.hora}`, 20, 56);
        doc.text(`Quantidade: ${item.quantidade}`, 20, 64);
        doc.setFontSize(10);

        // Quebra de linha para observações longas
        const splitObs = doc.splitTextToSize(`Observações: ${item.observacoes || "Nenhuma"}`, 170);
        doc.text(splitObs, 20, 72);

        // Fotos (Grid 2x2 aproximado)
        let yPos = 90;
        for (let i = 0; i < item.fotos.length; i++) {
            // Nova página se necessário
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            const xPos = (i % 2 === 0) ? 20 : 110;
            doc.addImage(item.fotos[i], 'JPEG', xPos, yPos, 80, 60);

            // Desce a linha a cada 2 fotos
            if (i % 2 !== 0) {
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
// 4. LÓGICA DE BANCO DE DADOS (SUPABASE)
// =========================================

async function carregarDadosSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('recebimentos')
            .select('*');

        if (error) throw error;

        // Ordena do mais novo para o mais antigo
        bancoDeDados = (data || []).sort((a, b) => b.id - a.id);

        atualizarPainelRecebimento();

        // Atualiza a lista da aba que estiver aberta
        if (document.getElementById('tela-finalizado').style.display !== 'none') filtrarHistorico();
        if (document.getElementById('tela-qualidade').style.display !== 'none') filtrarQualidade();
    } catch (err) {
        console.error("Erro Supabase:", err.message);
    }
}

// ENVIO DO FORMULÁRIO PRINCIPAL
document.getElementById('form-recebimento').onsubmit = async function(e) {
    e.preventDefault();

    if (fotosTemporarias.length === 0) {
        return dialog("Adicione ao menos uma foto (Evidência).", null, 'perigo');
    }

    const nomeConferente = document.getElementById('conferente').value.trim().toUpperCase();

    // Sons de feedback
    const sons = [
        'https://www.myinstants.com/media/sounds/success-fanfare-trumpets.mp3',
        'https://www.myinstants.com/media/sounds/tada.mp3'
    ];
    const somAleatorio = new Audio(sons[Math.floor(Math.random() * sons.length)]);

    // --- EFEITO: ALISSON (MODO DARK TEMPORÁRIO) ---
    if (nomeConferente === "ALISSON") {
        const telaPreta = document.createElement('div');
        telaPreta.style.cssText = "position:fixed; inset:0; background:black; z-index:9999; display:flex; align-items:center; justify-content:center; flex-direction:column; transition: opacity 0.5s;";
        telaPreta.innerHTML = `
            <span class="material-icons" style="color:white; font-size:100px; margin-bottom:20px;">visibility_off</span>
            <h1 style="color:white; font-family:sans-serif; letter-spacing:10px;">MODO DARK</h1>
        `;
        document.body.appendChild(telaPreta);

        // Espera um pouco antes de salvar
        await new Promise(r => setTimeout(r, 2000));

        telaPreta.style.opacity = "0";
        setTimeout(() => document.body.removeChild(telaPreta), 500);
    }

    showLoading("SALVANDO REGISTRO NO SISTEMA...");

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

        // Mensagens personalizadas
        let msgFinal = "Salvo com sucesso!";
        if (nomeConferente === "LUANNA") {
            msgFinal = "PETECO, PETECO 😛";
            somAleatorio.play();
        } else if (nomeConferente === "GUILHERME") {
            msgFinal = "É OS D, SAFADA 😎";
            somAleatorio.play();
        }

        dialog(msgFinal, () => {
            fecharModal();
            carregarDadosSupabase();
        }, 'sucesso');

    } catch (err) {
        hideLoading();
        dialog("Erro ao salvar: " + err.message, null, 'perigo');
    }
};

// =========================================
// 5. ABA DE EXEMPLOS (STORAGE BUCKET)
// =========================================

async function abrirModalExemplo(categoria) {
    categoriaAtualExemplo = categoria;
    const modal = document.getElementById('modal-exemplos');
    const titulo = document.getElementById('exemplo-titulo');
    const informativo = document.getElementById('informativo-exemplo');

    const config = {
        cidex: {
            t: "CIDEX / SANEANTES",
            d: "<b>Padrão de Qualidade:</b><br>• Placa do veículo legível<br>• 4 lados do palete<br>• Detalhe em avarias<br>• Foto nítida do Lote/Validade"
        },
        dispositivos: {
            t: "DISPOSITIVOS MÉDICOS",
            d: "<b>Padrão de Qualidade:</b><br>• Integridade da embalagem<br>•   Sensores de temperatura ativos<br>• Itens críticos (Velocity, Cassete)"
        },
        maquinas: {
            t: "MÁQUINAS",
            d: "<b>Padrão de Qualidade:</b><br>• Estado geral da caixa de madeira<br>• Indicadores de impacto (ShockWatch)<br>• Número de série visível"
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
    container.innerHTML = "<p>Carregando imagens do servidor...</p>";

    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .list(categoriaAtualExemplo);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p>Nenhum modelo cadastrado nesta categoria.</p>";
            return;
        }

        container.innerHTML = data.map(file => {
            const { data: urlData } = supabaseClient.storage
                .from(BUCKET_NAME)
                .getPublicUrl(`${categoriaAtualExemplo}/${file.name}`);

            // Adiciona timestamp para evitar cache de imagem velha
            const publicUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

            return `
                <div class="preview-item" style="height: 140px;">
                    <img src="${publicUrl}" onclick="window.open('${publicUrl}')" style="cursor:zoom-in">
                    <button class="btn-remove-foto" style="background:#e74c3c; color:white; border:none; width:100%; padding:5px; cursor:pointer;" onclick="removerFotoExemplo('${file.name}')">
                        REMOVER MODELO
                    </button>
                </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = "<p>Erro ao carregar exemplos.</p>";
    }
}

async function adicionarFotoExemplo(input) {
    if (!input.files || input.files.length === 0) return;

    showLoading("ENVIANDO PARA NUVEM...");
    try {
        for (let file of input.files) {
            // Cria nome único para não substituir
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
    dialog("Tem certeza que deseja apagar este modelo?", async () => {
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
// 6. GERENCIAMENTO DE MODAIS E ABAS
// =========================================

function renderizarPreviews(readOnly) {
    const container = document.getElementById('preview-container');
    if (!container) return;

    // Atualiza o contador no botão do acordeão
    const labelFotos = document.getElementById('label-fotos');
    if (labelFotos) labelFotos.innerText = `EVIDÊNCIAS (${fotosTemporarias.length}/30)`;

    container.innerHTML = fotosTemporarias.map((f, i) => `
        <div class="preview-item">
            <img src="${f}" onclick="window.open(this.src)" title="Clique para ampliar">
            <div style="display: flex; border-top: 1px solid #ddd;">
                <button type="button" onclick="baixarImagemIndividual(${i})" class="btn-download-foto" style="flex: 1;">
                    <span class="material-icons" style="font-size:16px">download</span> BAIXAR
                </button>
                ${!readOnly ? `
                <button type="button" onclick="removerFoto(${i})" style="width: 40px; background: #e74c3c; color: white; border: none; cursor: pointer; display:flex; align-items:center; justify-content:center;">
                    <span class="material-icons" style="font-size:16px">close</span>
                </button>` : ''}
            </div>
        </div>`).join('');
}

function removerFoto(i) {
    fotosTemporarias.splice(i, 1);
    renderizarPreviews(false);
}

function abrirModal(readOnly = false) {
    const form = document.getElementById('form-recebimento');
    form.reset();
    document.getElementById('edit-id').value = "";
    fotosTemporarias = [];

    document.getElementById('modal-add').style.display = 'flex';

    // Abre o acordeão de fotos por padrão
    document.getElementById('area-fotos').style.display = "block";
    document.getElementById('seta-fotos').innerText = "expand_less";

    if (!readOnly) {
        const agora = new Date();
        // Ajuste fuso horário simples
        const offset = agora.getTimezoneOffset() * 60000;
        const localDate = new Date(agora.getTime() - offset);

        document.getElementById('data').value = localDate.toISOString().split('T')[0];
        document.getElementById('hora').value = localDate.toISOString().split('T')[1].slice(0, 5);
    } else {
        // Se for só leitura, fecha o acordeão para ficar mais limpo
        document.getElementById('area-fotos').style.display = "none";
        document.getElementById('seta-fotos').innerText = "expand_more";
    }

    // Esconde ou mostra botão salvar
    const btnSalvar = form.querySelector('.btn-save');
    if (btnSalvar) btnSalvar.style.display = readOnly ? 'none' : 'block';

    // Esconde input de arquivo se for leitura
    const inputFile = document.getElementById('evidencia');
    if(inputFile) inputFile.style.display = readOnly ? 'none' : 'block';

    renderizarPreviews(readOnly);
}

function fecharModal() { document.getElementById('modal-add').style.display = 'none'; }
function fecharModalExemplo() { document.getElementById('modal-exemplos').style.display = 'none'; }
function fecharModalSenha() { document.getElementById('modal-senha-qualidade').style.display = 'none'; }

function toggleFotos() {
    const area = document.getElementById('area-fotos');
    const seta = document.getElementById('seta-fotos');
    const header = document.querySelector('.accordion-header');

    if (area.style.display === 'block') {
        area.style.display = 'none';
        seta.innerText = 'expand_more';
        if(header) header.style.borderBottom = '1px solid transparent';
    } else {
        area.style.display = 'block';
        seta.innerText = 'expand_less';
        if(header) header.style.borderBottom = '1px solid #ccd1d1';
    }
}

// Lógica de Senha da Qualidade
function verificarSenhaApp() {
    if (document.getElementById('input-senha-app').value === "159753") {
        logadoQualidade = true;
        fecharModalSenha();
        trocarAba('qualidade');
    } else {
        dialog("Senha incorreta. Tente novamente.", null, 'perigo');
    }
}

function trocarAba(aba) {
    if (aba === 'qualidade' && !logadoQualidade) {
        document.getElementById('modal-senha-qualidade').style.display = 'flex';
        return;
    }

    // Esconde todas as seções
    const secoes = ['tela-recebimento', 'tela-finalizado', 'tela-qualidade', 'tela-exemplos'];
    secoes.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // Tira active dos botões
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Mostra a selecionada
    const alvo = document.getElementById(`tela-${aba}`);
    if(alvo) alvo.style.display = 'block';

    // Ativa botão
    const btnId = `tab-${aba.substring(0,3)}`; // rec, fin, qua, exe
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');

    paginaAtual = 1;
    if (aba === 'finalizado') filtrarHistorico();
    if (aba === 'qualidade') filtrarQualidade();
}

// =========================================
// 7. FILTROS E LISTAGEM
// =========================================

function atualizarPainelRecebimento() {
    const c = document.getElementById('container-recente');
    if (!c) return;

    if (bancoDeDados.length === 0) {
        c.innerHTML = "<div class='info-box-styled' style='padding:20px; text-align:center; color:#666;'>Nenhum registro encontrado hoje.</div>";
        return;
    }

    // Mostra o último
    const item = bancoDeDados[0];
    c.innerHTML = `
        <div class="card-registro" style="border-left: 5px solid #27ae60;">
            <div style="flex:1;">
                <h3 style="margin-bottom:5px; color:#2c3e50;">NF: ${item.nf}</h3>
                <p style="font-size:14px; color:#7f8c8d;">
                    <span class="material-icons" style="font-size:14px; vertical-align:middle;">person</span> ${item.conferente} &nbsp;|&nbsp;
                    <span class="material-icons" style="font-size:14px; vertical-align:middle;">schedule</span> ${item.hora}
                </p>
            </div>
            <button class="btn-novo-processo" style="padding: 8px 15px; font-size:13px;" onclick="editarRegistro('${item.id}', false)">
                <span class="material-icons">edit</span> EDITAR
            </button>
        </div>`;
}

function filtrarHistorico() {
    const termo = document.getElementById('inputPesquisa').value.toLowerCase();
    const filtrados = bancoDeDados.filter(i => i.nf.toString().includes(termo) || i.conferente.toLowerCase().includes(termo));

    paginarEExibir(filtrados, 'container-historico', 'pagination-controls', filtrarHistorico, (item) => `
        <div class="card-registro">
            <div style="flex:1;">
                <strong>NF: ${item.nf}</strong><br>
                <small>${item.data} - ${item.conferente}</small>
            </div>
            <button class="btn-novo-processo" style="background:#2f3640; padding:5px 15px" onclick="editarRegistro('${item.id}', true)">
                VISUALIZAR
            </button>
        </div>
    `);
}

function filtrarQualidade() {
    const termo = document.getElementById('inputPesquisaQualidade').value.toLowerCase();
    const filtrados = bancoDeDados.filter(i => i.nf.toString().includes(termo));

    paginarEExibir(filtrados, 'container-qualidade', 'pagination-qualidade', filtrarQualidade, (item) => `
        <div class="card-registro">
            <div style="flex:1;">
                <strong>NF: ${item.nf}</strong><br>
                <small>${item.data} - ${item.conferente}</small>
            </div>
            <div style="display:flex; gap:8px">
                <button title="Gerar PDF" class="btn-novo-processo" style="background:#27ae60; padding:8px" onclick="gerarPDF('${item.id}')">
                    <span class="material-icons">picture_as_pdf</span>
                </button>
                <button title="Editar" class="btn-novo-processo" style="background:#3498db; padding:8px" onclick="editarRegistro('${item.id}', false)">
                    <span class="material-icons">edit</span>
                </button>
                <button title="Excluir" class="btn-novo-processo" style="background:#e74c3c; padding:8px" onclick="excluirPermanente('${item.id}')">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `);
}

// Função genérica de paginação para evitar código duplicado
function paginarEExibir(dados, containerId, paginacaoId, callbackFiltro, templateFn) {
    const container = document.getElementById(containerId);
    if(!container) return;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = paginaAtual * itensPorPagina;
    const itensPagina = dados.slice(inicio, fim);

    if(itensPagina.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:20px; color:#999;'>Nenhum registro encontrado.</p>";
    } else {
        container.innerHTML = itensPagina.map(templateFn).join('');
    }

    // Renderiza botões de página
    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
    const divPag = document.getElementById(paginacaoId);
    if(divPag) {
        divPag.innerHTML = "";
        if (totalPaginas > 1) {
            for (let i = 1; i <= totalPaginas; i++) {
                const b = document.createElement('button');
                b.innerText = i;
                b.className = `btn-pag ${i === paginaAtual ? 'active' : ''}`; // Requer CSS para .btn-pag
                // Estilo inline básico caso falte CSS
                b.style.padding = "5px 10px";
                b.style.margin = "0 2px";
                b.style.cursor = "pointer";
                if(i === paginaAtual) b.style.fontWeight = "bold";

                b.onclick = () => { paginaAtual = i; callbackFiltro(); };
                divPag.appendChild(b);
            }
        }
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
    document.getElementById('obs').value = item.observacoes || "";

    // Clona o array para não modificar o original diretamente antes de salvar
    fotosTemporarias = [...item.fotos];
    renderizarPreviews(readOnly);
}

async function excluirPermanente(id) {
    dialog("ATENÇÃO: Deseja excluir este registro permanentemente?", async () => {
        showLoading("EXCLUINDO REGISTRO...");
        try {
            const { error } = await supabaseClient.from('recebimentos').delete().eq('id', id);
            if (error) throw error;

            hideLoading();
            carregarDadosSupabase(); // Recarrega a lista
        } catch(e) {
            hideLoading();
            dialog("Erro ao excluir: " + e.message, null, 'perigo');
        }
    }, 'perigo');
}

// INPUT DE ARQUIVO (Processamento de Imagens)
document.getElementById('evidencia').onchange = async function(e) {
    showLoading("PROCESSANDO FOTOS...");
    try {
        for (let f of e.target.files) {
            const reader = new FileReader();
            const p = new Promise(res => reader.onload = res);
            reader.readAsDataURL(f);
            await p;

            const fotoComprimida = await comprimirImagem(reader.result);
            fotosTemporarias.push(fotoComprimida);
        }
        renderizarPreviews(false);
        // Abre o acordeão automaticamente se o usuário adicionar fotos
        const area = document.getElementById('area-fotos');
        if(area.style.display !== 'block') toggleFotos();

    } catch(err) {
        dialog("Erro ao processar imagem.", null, 'perigo');
    } finally {
        hideLoading();
        this.value = ""; // Limpa input para permitir selecionar a mesma foto novamente se quiser
    }
};

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosSupabase();
    // Garante que a primeira aba esteja visível
    trocarAba('recebimento');
});