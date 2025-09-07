(function () {
  // SELECTORS
  const addBtn = document.querySelector('.adicionar-gasto button');
  const modal = document.getElementById('adicionarGastoModal');
  const form = document.getElementById('gastoForm');
  const cancelarBtn = document.getElementById('cancelarBtn');
  const container = document.getElementById('gastosSection'); // container de cards
  const nav = document.querySelector('nav');

  // KEYS
  const CAT_KEY = 'categorias';
  const STORAGE_KEY = 'gastos';

  // Estado
  let categorias = [];
  let gastos = [];
  let editId = null;

  // Elementos de categoria
  const categoriaInput = document.getElementById('categoria'); // hidden input
  const categoriaBtn = document.getElementById('categoriaBtn');
  const categoriaBtnText = document.getElementById('categoriaBtnText');
  const categoriaList = document.getElementById('categoriaList');
  const novaCategoriaInput = document.getElementById('novaCategoria');
  const addCategoriaBtn = document.getElementById('addCategoriaBtn');

  // Defaults iniciais de categorias (apenas se não houver nada salvo)
  const CATEGORIAS_DEFAULT = [
    'Alimentação',
    'Gastos Fixos',
    'Lazer',
    'Gatos',
    'Limpeza',
    'Higiene pessoal',
    'Reforma'
  ];

  // Ajusta padding-top do container para não ficar atrás da navbar fixa
  function ajustarOffsetNavbar() {
    if (!nav || !container) return;
    const navH = nav.offsetHeight;
    container.style.paddingTop = (navH + 16) + 'px';
  }

  // ---------- CATEGORIAS ----------
  function carregarCategorias() {
    const raw = localStorage.getItem(CAT_KEY);
    if (!raw) {
      localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
      return [...CATEGORIAS_DEFAULT];
    }
    try {
      const parsed = JSON.parse(raw);
      // Se houver um array salvo, usa ele; senão inicializa com default
      if (Array.isArray(parsed) && parsed.length) return parsed;
      localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
      return [...CATEGORIAS_DEFAULT];
    } catch (e) {
      console.error('Erro parse categorias', e);
      localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
      return [...CATEGORIAS_DEFAULT];
    }
  }

  function salvarCategorias() {
    localStorage.setItem(CAT_KEY, JSON.stringify(categorias));
  }

  function renderCategoriaList() {
    if (!categoriaList) return;
    categoriaList.innerHTML = '';
    categorias.forEach(cat => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100';
      item.textContent = cat;
      item.dataset.cat = cat;
      categoriaList.appendChild(item);
    });
  }

  function selecionarCategoria(cat) {
    if (!categoriaInput || !categoriaBtnText) return;
    categoriaInput.value = cat;
    categoriaBtnText.textContent = cat;
    fecharCategoriaDropdown();
  }

  function adicionarCategoria() {
    const val = novaCategoriaInput.value.trim();
    if (!val) return;
    const exists = categorias.some(c => c.toLowerCase() === val.toLowerCase());
    if (exists) {
      const found = categorias.find(c => c.toLowerCase() === val.toLowerCase());
      selecionarCategoria(found);
      novaCategoriaInput.value = '';
      return;
    }
    categorias.unshift(val);
    salvarCategorias();
    renderCategoriaList();
    selecionarCategoria(val);
    novaCategoriaInput.value = '';
  }

  function abrirCategoriaDropdown() {
    if (!categoriaList) return;
    categoriaList.classList.remove('hidden');
  }
  function fecharCategoriaDropdown() {
    if (!categoriaList) return;
    categoriaList.classList.add('hidden');
  }
  function toggleCategoriaDropdown() {
    if (!categoriaList) return;
    if (categoriaList.classList.contains('hidden')) abrirCategoriaDropdown();
    else fecharCategoriaDropdown();
  }

  // ---------- GASTOS ----------
  function carregarGastos() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      console.error('Parse gastos', e);
      return [];
    }
  }
  function salvarGastos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
  }

  // Parse "YYYY-MM-DD" como data NO FUSO LOCAL — evita o problema do "um dia antes"
  function parseLocalDate(isoDate) {
    if (!isoDate) return null;
    const parts = isoDate.split('-').map(n => Number(n));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatarDataDisplay(isoDate) {
    const d = parseLocalDate(isoDate);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatarValorBRL(valorNum) {
    if (valorNum === '' || valorNum === null || isNaN(valorNum)) return 'R$ 0,00';
    return Number(valorNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderGastos() {
    container.innerHTML = '';
    if (!gastos.length) {
      const empty = document.createElement('div');
      empty.className = 'text-white text-center mt-8';
      empty.textContent = 'Nenhum gasto cadastrado ainda.';
      container.appendChild(empty);
      return;
    }

    gastos.forEach(g => {
      const card = document.createElement('div');
      card.className = 'w-full max-w-md bg-white rounded-lg shadow-md p-4 gasto-card';
      card.dataset.id = g.id;

      const categoriaBadge = `<span class="text-sm font-medium px-2 py-1 rounded-full mr-2 bg-gray-100 text-gray-700">${escapeHtml(g.categoria || '')}</span>`;

      card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <div>
            <h2 class="text-xl font-bold">${escapeHtml(g.titulo || (g.categoria || g.descricao || 'Gasto'))}</h2>
          </div>
          <p class="text-gray-700 bg-gray-200 px-3 py-1 rounded">${formatarDataDisplay(g.data)}</p>
        </div>
        <hr class="mb-4">
        <div class="mb-1">${categoriaBadge}</div>
        <p class="text-gray-700 mb-4">${escapeHtml(g.descricao || '')}</p>
        <p class="text-gray-700 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-thin p-2 rounded text-center mb-4">
            Total: ${formatarValorBRL(g.valor)}
        </p>
        <div class="flex justify-end space-x-2">
          <button data-action="editar" data-id="${g.id}" class="px-3 w-96 py-1 text-sm bg-yellow-400 text-white rounded hover:bg-yellow-500">Editar</button>
          <button data-action="deletar" data-id="${g.id}" class="px-3 w-96 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Deletar</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Modal open/close + preenchimento
  function abrirModal(preenchimento = {}) {
    editId = preenchimento.id || null;

    const inData = document.getElementById('data');
    const inCategoria = document.getElementById('categoria');
    const inDescricao = document.getElementById('descricao');
    const inValor = document.getElementById('valor');

    if (inData) inData.value = preenchimento.data || '';
    if (inCategoria) {
      inCategoria.value = preenchimento.categoria || '';
      categoriaBtnText.textContent = preenchimento.categoria || 'Selecione categoria';
    }
    if (inDescricao) inDescricao.value = preenchimento.descricao || '';
    if (inValor) inValor.value = preenchimento.valor !== undefined ? preenchimento.valor : '';

    modal.classList.remove('hidden');
  }

  function fecharModal() {
    modal.classList.add('hidden');
    editId = null;
    form.reset();
    categoriaBtnText.textContent = 'Selecione categoria';
    categoriaInput.value = '';
  }

  function salvarDoFormulario(e) {
    e.preventDefault();
    const data = document.getElementById('data').value;
    const categoria = document.getElementById('categoria').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const valorRaw = document.getElementById('valor').value;
    const valor = valorRaw === '' ? 0 : Number(valorRaw);

    if (!data) { alert('Preencha a data.'); return; }
    if (!categoria) { alert('Escolha uma categoria.'); return; }

    if (editId) {
      const idx = gastos.findIndex(x => x.id === editId);
      if (idx === -1) { alert('Item não encontrado.'); fecharModal(); return; }
      gastos[idx] = { ...gastos[idx], data, categoria, descricao, valor };
    } else {
      const novo = { id: 'gasto_' + Date.now(), data, categoria, descricao, valor, titulo: '' };
      gastos.unshift(novo);
    }

    salvarGastos();
    renderGastos();
    fecharModal();
  }

  function iniciarEdicao(id) {
    const item = gastos.find(x => x.id === id);
    if (!item) { alert('Item não encontrado.'); return; }
    abrirModal(item);
    categoriaBtnText.textContent = item.categoria || 'Selecione categoria';
    categoriaInput.value = item.categoria || '';
  }

  function deletarItem(id) {
    const tem = gastos.find(x => x.id === id);
    if (!tem) return;
    const ok = confirm('Deseja realmente excluir este gasto?');
    if (!ok) return;
    gastos = gastos.filter(x => x.id !== id);
    salvarGastos();
    renderGastos();
  }

  // Delegação (editar/deletar)
  function onContainerClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'editar') iniciarEdicao(id);
      if (action === 'deletar') deletarItem(id);
    }
  }

  // Eventos categoria
  function onCategoriaListClick(e) {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    const cat = btn.dataset.cat;
    selecionarCategoria(cat);
  }

  // Fecha dropdown ao clicar fora (global)
  function onDocClick(e) {
    if (!categoriaList) return;
    if (categoriaBtn.contains(e.target) || categoriaList.contains(e.target)) return;
    fecharCategoriaDropdown();
  }

  // Inicialização
  function init() {
    ajustarOffsetNavbar();
    window.addEventListener('resize', ajustarOffsetNavbar);

    categorias = carregarCategorias();
    gastos = carregarGastos();

    renderCategoriaList();
    renderGastos();

    addBtn && addBtn.addEventListener('click', () => abrirModal());
    cancelarBtn && cancelarBtn.addEventListener('click', (e) => { e.preventDefault(); fecharModal(); });
    form && form.addEventListener('submit', salvarDoFormulario);
    container && container.addEventListener('click', onContainerClick);

    categoriaBtn && categoriaBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleCategoriaDropdown(); });
    categoriaList && categoriaList.addEventListener('click', onCategoriaListClick);
    addCategoriaBtn && addCategoriaBtn.addEventListener('click', adicionarCategoria);
    novaCategoriaInput && novaCategoriaInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); adicionarCategoria(); }
    });

    document.addEventListener('click', onDocClick);

    modal && modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });
  }

  init();
})();
