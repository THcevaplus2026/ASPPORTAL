/**
 * L&Q System - Lógica de Autenticação e Segurança via Supabase
 * Desenvolvido para Portal Logístico CEVA
 */

// --- 1. CONFIGURAÇÕES DE CONEXÃO ---
// Use os dados que aparecem na aba 'Data API' e 'API Keys' do seu Supabase
const SUPABASE_URL = 'https://kwolnazucrsjlmsxiayk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0...'; // Insira sua Publishable Key completa aqui
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. BLOQUEIO DE NAVEGAÇÃO (SETAS DO NAVEGADOR) ---
(function() {
    history.pushState(null, null, document.URL);
    window.addEventListener('popstate', function () {
        history.pushState(null, null, document.URL);
        showResult("AÇÃO BLOQUEADA", "Por segurança, a navegação pelas setas do navegador está desativada.");
    });
})();

// --- 3. SELEÇÃO DE ELEMENTOS DA INTERFACE ---
const loginForm = document.getElementById('loginForm');
const messageDisplay = document.getElementById('message');
const recoveryModal = document.getElementById('recoveryModal');
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultBody = document.getElementById('resultBody');

// --- 4. LÓGICA DE LOGIN ---
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const emailValue = document.getElementById('username').value;
        const passValue = document.getElementById('password').value;
        const btnEntrar = document.getElementById('btnEntrar');

        // Feedback visual de carregamento
        btnEntrar.innerText = "VERIFICANDO...";
        btnEntrar.disabled = true;

        try {
            // Autenticação Real no Supabase
            const { data, error } = await _supabase.auth.signInWithPassword({
                email: emailValue,
                password: passValue
            });

            if (error) throw error;

            messageDisplay.innerHTML = "✅ Acesso permitido! Redirecionando...";
            messageDisplay.className = "success";

            // Redireciona para a pasta TELA INICIAL (Saindo da raiz onde está o INDEX.HTML)
            setTimeout(() => {
                window.location.href = "TELA INICIAL/TELAINICIAL.HTML";
            }, 1200);

        } catch (error) {
            messageDisplay.innerHTML = "❌ Usuário ou senha incorretos.";
            messageDisplay.className = "error";
            document.getElementById('password').value = "";
            console.warn("Tentativa de login inválida: " + error.message);
        } finally {
            btnEntrar.innerText = "ENTRAR";
            btnEntrar.disabled = false;
        }
    });
}

// --- 5. LÓGICA DE RECUPERAÇÃO DE ACESSO ---

/**
 * Dispara o processo de recuperação para o e-mail institucional
 */
async function handleRecovery() {
    const emailAlvo = "Thales.Monteiro@cevaligistics.com";

    try {
        const { error } = await _supabase.auth.resetPasswordForEmail(emailAlvo, {
            // URL configurada no painel do Supabase (apontando para a raiz)
            redirectTo: window.location.origin + '/redefinir-senha.html',
        });

        if (error) throw error;

        closeModal();
        showResult("E-MAIL ENVIADO", `Um link de redefinição foi enviado para: <br><strong>${emailAlvo}</strong>`);

        messageDisplay.innerHTML = "Link enviado com sucesso.";
        messageDisplay.className = "success";

    } catch (error) {
        showResult("ERRO NO ENVIO", "Não foi possível processar a recuperação: " + error.message);
    }
}

// --- 6. FUNÇÕES DE INTERFACE (MODAIS) ---

function forgotPassword() {
    if (recoveryModal) {
        recoveryModal.style.display = 'flex';
    }
}

function closeModal() {
    if (recoveryModal) recoveryModal.style.display = 'none';
}

function closeResult() {
    if (resultModal) resultModal.style.display = 'none';
}

function showResult(title, htmlContent) {
    if (resultTitle && resultBody && resultModal) {
        resultTitle.innerText = title;
        resultBody.innerHTML = htmlContent;
        resultModal.style.display = 'flex';
    }
}

// Fechar ao clicar fora da caixa branca
window.onclick = function(event) {
    if (event.target == recoveryModal) closeModal();
    if (event.target == resultModal) closeResult();
}

// Atalho de teclado para fechar modais
window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeModal();
        closeResult();
    }
});