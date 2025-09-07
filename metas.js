// metas.js
// Script unificado: gestão das metas + geração de relatório em PDF
(function () {
  // Keys locais (mesmas chaves do seu app principal)
  const CAT_KEY = 'categorias';
  const STORAGE_KEY = 'gastos';
  const META_KEY = 'metas';

  // DOM
  const listaCategorias = document.getElementById('listaCategorias');
  const mesAnoLabel = document.getElementById('mesAno');
  const prevMonthBtn = document.getElementById('prevMonth');
  const nextMonthBtn = document.getElementById('nextMonth');

  const editarMetaModal = document.getElementById('editarMetaModal');
  const editarMetaCategoria = document.getElementById('editarMetaCategoria');
  const editarMetaValor = document.getElementById('editarMetaValor');
  const fecharEditarMeta = document.getElementById('fecharEditarMeta');
  const salvarEditarMeta = document.getElementById('salvarEditarMeta');

  const editarTodasModal = document.getElementById('editarTodasModal');
  const editarTodasBtn = document.getElementById('editarTodasBtn');
  const fecharEditarTodas = document.getElementById('fecharEditarTodas');
  const inputsMetasTodas = document.getElementById('inputsMetasTodas');
  const formEditarTodas = document.getElementById('formEditarTodas');

  // Relatório modal
  const relatorioModal = document.getElementById('relatorioModal');
  const relMesAno = document.getElementById('relMesAno');
  const relObservacoes = document.getElementById('relObservacoes');
  const fecharRelatorio = document.getElementById('fecharRelatorio');
  const confirmGerarPDF = document.getElementById('confirmGerarPDF');
  const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
  const optIncluirCategoriasSemGastos = document.getElementById('optIncluirCategoriasSemGastos');

  // Estado
  let categorias = [];
  let gastos = [];
  let metas = {}; // object category => number
  let selectedYear, selectedMonth; // month: 0..11

  // Defaults iniciais de categorias (mesmas do script principal)
  const CATEGORIAS_DEFAULT = [
    'Alimentação',
    'Gastos Fixos',
    'Lazer',
    'Gatos',
    'Limpeza',
    'Higiene pessoal',
    'Reforma'
  ];

  // util: get current month/year
  function initMonth() {
    const today = new Date();
    selectedYear = today.getFullYear();
    selectedMonth = today.getMonth();
  }

  // load/save storage
  function carregarCategorias() {
    try {
      const raw = localStorage.getItem(CAT_KEY);
      if (!raw) {
        localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
        return [...CATEGORIAS_DEFAULT];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
      localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
      return [...CATEGORIAS_DEFAULT];
    } catch (e) {
      console.error(e);
      localStorage.setItem(CAT_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
      return [...CATEGORIAS_DEFAULT];
    }
  }
  function carregarGastos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }
  function carregarMetas() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      console.error(e);
      return {};
    }
  }
  function salvarMetas() {
    localStorage.setItem(META_KEY, JSON.stringify(metas));
  }

  // Parse "YYYY-MM-DD" local (evita bug de timezone)
  function parseLocalDate(isoDate) {
    if (!isoDate) return null;
    const parts = isoDate.split('-').map(n => Number(n));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatCurrency(num) {
    return Number(num || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function formatDateBr(isoDateOrDate) {
    if (!isoDateOrDate) return '';
    let d = isoDateOrDate instanceof Date ? isoDateOrDate : parseLocalDate(String(isoDateOrDate));
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // calcula total gasto por categoria para o mês selecionado
  function calcularTotaisPorCategoria() {
    const totals = {}; // category => sum
    categorias.forEach(c => totals[c] = 0);

    gastos.forEach(g => {
      const d = parseLocalDate(g.data);
      if (!d) return;
      if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
        const cat = g.categoria || 'Outros';
        const val = Number(g.valor) || 0;
        if (!totals.hasOwnProperty(cat)) totals[cat] = 0;
        totals[cat] += val;
      }
    });

    return totals;
  }

  // obter gastos do mês, agrupados por categoria
  function obterGastosPorCategoria(incluirVazias = false) {
    const map = {};
    // init with categories
    categorias.forEach(c => map[c] = []);

    gastos.forEach(g => {
      const d = parseLocalDate(g.data);
      if (!d) return;
      if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
        const cat = g.categoria || 'Outros';
        if (!map[cat]) map[cat] = [];
        map[cat].push({
          data: formatDateBr(d),
          rawDate: d,
          valor: Number(g.valor) || 0,
          descricao: g.descricao || g.nota || g.obs || ''
        });
      }
    });

    if (!incluirVazias) {
      // remove categorias sem gastos
      Object.keys(map).forEach(k => { if (!map[k] || map[k].length === 0) delete map[k]; });
    }

    return map; // { categoria: [ {data, valor, descricao}, ... ] }
  }

  // renderização principal
  function render() {
    listaCategorias.innerHTML = '';

    // label mês
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString('pt-BR', { month: 'long' });
    mesAnoLabel.textContent = `${capitalize(monthName)} ${selectedYear}`;

    const totals = calcularTotaisPorCategoria();

    // se não houver categorias, mostrar mensagem
    if (!categorias.length) {
      listaCategorias.innerHTML = '<div class="text-center text-gray-300">Nenhuma categoria encontrada.</div>';
      return;
    }

    categorias.forEach(cat => {
      const spent = totals[cat] || 0;
      const goal = Number(metas[cat] || 0);
      const restante = goal - spent; // positivo = ainda pode gastar, negativo = estourou

      // container
      const card = document.createElement('div');
      card.className = 'bg-white text-black rounded-lg p-4 shadow';

      // header (nome + editar)
      const header = document.createElement('div');
      header.className = 'flex justify-between items-center mb-2';
      header.innerHTML = `
        <div class="font-semibold text-lg">${escapeHtml(cat)}</div>
        <div class="flex items-center gap-2">
          <button data-cat="${escapeHtml(cat)}" class="editar-meta-individual px-2 py-1 text-sm bg-yellow-400 rounded">Editar</button>
        </div>
      `;

      // hr
      const hr = document.createElement('hr');
      hr.className = 'my-2';

      // contenido: badge mostrando restante colorido e valores
      const content = document.createElement('div');
      const badge = document.createElement('div');
      badge.className = `inline-block px-3 py-2 rounded font-medium`;
      // cor: verde se restante >= 0, vermelho se < 0
      if (restante >= 0) {
        badge.classList.add('bg-green-100', 'text-green-700');
      } else {
        badge.classList.add('bg-red-100', 'text-red-700');
      }
      // mostrar sinal: se negativo mostra -valor, se positivo mostra valor sem sinal
      const displayValue = restante < 0 ? `- ${formatCurrency(Math.abs(restante))}` : `${formatCurrency(restante)}`;
      badge.textContent = displayValue;

      // detalhe: mostrar gasto e meta (pequeno)
      const detalhe = document.createElement('div');
      detalhe.className = 'mt-2 text-sm text-gray-600';
      detalhe.innerHTML = `Gasto: <span class="font-semibold text-black">${formatCurrency(spent)}</span> &nbsp;|&nbsp; Meta: <span class="font-semibold text-black">${formatCurrency(goal)}</span>`;

      content.appendChild(badge);
      content.appendChild(detalhe);

      card.appendChild(header);
      card.appendChild(hr);
      card.appendChild(content);

      listaCategorias.appendChild(card);
    });

    // adiciona listeners para botões editar individuais
    document.querySelectorAll('.editar-meta-individual').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.cat;
        abrirEditarMetaIndividual(cat);
      });
    });
  }

  // abrir modal editar individual
  function abrirEditarMetaIndividual(cat) {
    editarMetaCategoria.textContent = cat;
    editarMetaValor.value = metas[cat] !== undefined ? metas[cat] : 0;
    editarMetaModal.classList.remove('hidden');
    editarMetaModal.dataset.cat = cat;
    editarMetaValor.focus();
  }
  function fecharEditarMetaModal() {
    editarMetaModal.classList.add('hidden');
    delete editarMetaModal.dataset.cat;
  }

  function salvarEditarIndividual() {
    const cat = editarMetaModal.dataset.cat;
    if (!cat) return;
    const v = Number(editarMetaValor.value) || 0;
    metas[cat] = v;
    salvarMetas();
    fecharEditarMetaModal();
    render();
  }

  // editar todas as metas (modal)
  function abrirEditarTodas() {
    inputsMetasTodas.innerHTML = '';
    // gerar campos
    categorias.forEach(cat => {
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-center gap-3';

      const label = document.createElement('div');
      label.className = 'w-1/2 font-medium';
      label.textContent = cat;

      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.value = metas[cat] !== undefined ? metas[cat] : 0;
      input.name = `meta__${cat}`;
      input.className = 'w-1/2 border border-gray-300 rounded px-2 py-1';

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      inputsMetasTodas.appendChild(wrapper);
    });

    editarTodasModal.classList.remove('hidden');
  }
  function fecharEditarTodasModal() {
    editarTodasModal.classList.add('hidden');
  }

  function salvarEditarTodas(ev) {
    ev.preventDefault();
    const inputs = inputsMetasTodas.querySelectorAll('input[name^="meta__"]');
    inputs.forEach(inp => {
      const key = inp.name.replace('meta__', '');
      metas[key] = Number(inp.value) || 0;
    });
    salvarMetas();
    fecharEditarTodasModal();
    render();
  }

  // helpers
  function capitalize(str) {
    if (!str) return str;
    return str[0].toUpperCase() + str.slice(1);
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

  // month controls
  function prevMonth() {
    if (selectedMonth === 0) {
      selectedMonth = 11;
      selectedYear -= 1;
    } else {
      selectedMonth -= 1;
    }
    render();
  }
  function nextMonth() {
    if (selectedMonth === 11) {
      selectedMonth = 0;
      selectedYear += 1;
    } else {
      selectedMonth += 1;
    }
    render();
  }

  // ---------- Relatório / PDF ----------
  async function abrirModalRelatorio() {
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString('pt-BR', { month: 'long' });
    relMesAno.textContent = `${capitalize(monthName)} ${selectedYear}`;
    relObservacoes.value = '';
    optIncluirCategoriasSemGastos.checked = false;
    relatorioModal.classList.remove('hidden');
  }
  function fecharModalRelatorio() {
    relatorioModal.classList.add('hidden');
  }

  async function gerarRelatorioPDF() {
    // coleta opções
    const incluirVazias = !!optIncluirCategoriasSemGastos.checked;
    const observacoes = relObservacoes.value || '';

    // montar dados
    const gastosPorCat = obterGastosPorCategoria(incluirVazias);
    const totalsPorCat = calcularTotaisPorCategoria();

    // calcular totais gerais
    let totalGastoGeral = 0;
    let totalMetaGeral = 0;
    Object.keys(totalsPorCat).forEach(k => {
      totalGastoGeral += totalsPorCat[k] || 0;
      totalMetaGeral += Number(metas[k] || 0);
    });

    // criar PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let cursorY = 50;

    // header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Relatório de Gastos Mensais', margin, cursorY);
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString('pt-BR', { month: 'long' });
    cursorY += 20;
    doc.text(`${capitalize(monthName)} ${selectedYear}`, margin, cursorY);
    cursorY += 18;
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 14;

    // Para cada categoria, gerar uma pequena tabela com autoTable
    const categoriasOrdenadas = Object.keys(gastosPorCat).sort();

    for (let i = 0; i < categoriasOrdenadas.length; i++) {
      const cat = categoriasOrdenadas[i];
      const rows = (gastosPorCat[cat] || []).map(item => ([
        item.data,
        item.descricao || '',
        formatCurrency(item.valor)
      ]));

      // cabeçalho da categoria
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(cat, margin, cursorY);
      doc.setFont(undefined, 'normal');
      cursorY += 6;

      // se não houver gastos e a categoria foi incluída apenas por opção, mostrar "Sem gastos"
      if (!rows.length) {
        cursorY += 8;
        doc.setFontSize(10);
        doc.text('Sem gastos neste mês', margin + 10, cursorY);
        cursorY += 16;
      } else {
        // usar autoTable para a tabela desta categoria
        doc.autoTable({
          startY: cursorY,
          head: [['Data', 'Descrição', 'Valor']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [240,240,240], textColor: 20, halign: 'left' },
          styles: { fontSize: 10, cellPadding: 6 },
          margin: { left: margin, right: margin },
          didDrawPage: function (data) {
            // nothing
          }
        });
        cursorY = doc.lastAutoTable.finalY + 6;
      }

      // subtotal e comparação com meta
      const subtotal = totalsPorCat[cat] || 0;
      const meta = Number(metas[cat] || 0);
      const diff = meta - subtotal; // positivo = ainda cabe na meta, negativo = estourou
      const status = diff < 0 ? `Déficit: estourou ${formatCurrency(Math.abs(diff))}` : `Superávit: faltam ${formatCurrency(Math.abs(diff))}`;

      doc.setFontSize(10);
      doc.text(`Subtotal: ${formatCurrency(subtotal)}  |  Meta: ${formatCurrency(meta)}  |  ${status}`, margin + 6, cursorY);
      cursorY += 18;

      // se aproximando do final da página, criar nova página
      if (cursorY > doc.internal.pageSize.getHeight() - 90) {
        doc.addPage();
        cursorY = 50;
      }
    }

    // linha final com totais gerais
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 12;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Total do mês:', margin, cursorY);
    doc.setFont(undefined, 'normal');
    doc.text(formatCurrency(totalGastoGeral), margin + 110, cursorY);
    cursorY += 16;

    // comparação geral com metas
    const geralDiff = totalMetaGeral - totalGastoGeral;
    const geralStatus = geralDiff < 0 ? `Déficit Geral: estourou ${formatCurrency(Math.abs(geralDiff))}` : `Superávit Geral: faltam ${formatCurrency(Math.abs(geralDiff))}`;
    doc.setFontSize(11);
    doc.text(`Soma metas: ${formatCurrency(totalMetaGeral)}  |  ${geralStatus}`, margin, cursorY);
    cursorY += 20;

    // observações
    if (observacoes && String(observacoes).trim()) {
      doc.setFont(undefined, 'bold');
      doc.text('Observações:', margin, cursorY);
      cursorY += 14;
      doc.setFont(undefined, 'normal');

      const splitObs = doc.splitTextToSize(observacoes, pageWidth - margin * 2);
      // se não couber, paginar
      if (cursorY + (splitObs.length * 12) > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        cursorY = 50;
      }
      doc.text(splitObs, margin, cursorY);
      cursorY += splitObs.length * 12;
    }

    // footer (data de geração)
    const geradoEm = new Date();
    const geradoEmStr = `${String(geradoEm.getDate()).padStart(2, '0')}/${String(geradoEm.getMonth()+1).padStart(2,'0')}/${geradoEm.getFullYear()} ${String(geradoEm.getHours()).padStart(2,'0')}:${String(geradoEm.getMinutes()).padStart(2,'0')}`;
    doc.setFontSize(9);
    doc.text(`Gerado em ${geradoEmStr}`, margin, doc.internal.pageSize.getHeight() - 30);

    // salvar PDF
    const fileNameMonth = `${selectedYear}_${String(selectedMonth+1).padStart(2,'0')}`;
    doc.save(`relatorio_gastos_${fileNameMonth}.pdf`);
  }

  // ---------- eventos ----------
  function attachEvents() {
    prevMonthBtn.addEventListener('click', prevMonth);
    nextMonthBtn.addEventListener('click', nextMonth);

    fecharEditarMeta.addEventListener('click', fecharEditarMetaModal);
    salvarEditarMeta.addEventListener('click', salvarEditarIndividual);

    editarTodasBtn && editarTodasBtn.addEventListener('click', abrirEditarTodas);
    fecharEditarTodas && fecharEditarTodas.addEventListener('click', fecharEditarTodasModal);
    formEditarTodas && formEditarTodas.addEventListener('submit', salvarEditarTodas);

    // fechar modais clicando fora
    editarMetaModal.addEventListener('click', (e) => {
      if (e.target === editarMetaModal) fecharEditarMetaModal();
    });
    editarTodasModal.addEventListener('click', (e) => {
      if (e.target === editarTodasModal) fecharEditarTodasModal();
    });

    // relatórios
    gerarRelatorioBtn && gerarRelatorioBtn.addEventListener('click', abrirModalRelatorio);
    fecharRelatorio && fecharRelatorio.addEventListener('click', fecharModalRelatorio);
    confirmGerarPDF && confirmGerarPDF.addEventListener('click', async () => {
      fecharModalRelatorio();
      // gerar relatório
      try {
        await gerarRelatorioPDF();
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Ocorreu um erro ao gerar o PDF. Veja o console para detalhes.');
      }
    });
  }

  // init
  function init() {
    initMonth();
    categorias = carregarCategorias();
    gastos = carregarGastos();
    metas = carregarMetas();

    // garantir categorias não vazias
    if (!categorias || !categorias.length) {
      categorias = [...CATEGORIAS_DEFAULT];
      localStorage.setItem(CAT_KEY, JSON.stringify(categorias));
    }

    attachEvents();
    render();
  }

  init();
})();
