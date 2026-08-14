/**
 * LATROY ENERGY - Integración Frontend <-> Apps Script
 * Backend esperado en Google Apps Script (Web App /exec).
 */

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwW2TnBcK1s8St2nzbFurTLVx_SQmzEdw4PQBMcFYVDuK-cvoBSuw_kj62cNyRiGXgm/exec';

const SHEETS = {
  clientes: 'Clientes',
  diagnostico: 'Diagnostico_Consumo',
  paneles: 'Catalogo_Paneles',
  inversores: 'Catalogo_Inversores',
  dimensionamiento: 'Dimensionamiento',
  validacion: 'Validacion_Normativa',
  cotizaciones: 'Cotizaciones',
  detalle: 'Cotizacion_Detalle',
  roi: 'ROI_Proyeccion',
  pipeline: 'Pipeline',
  pasos: 'Proximos_Pasos_Template'
};

const state = {
  clientes: [],
  paneles: [],
  inversores: [],
  cotizaciones: [],
  pipeline: [],
  currentClienteId: null,
  currentDiagnosticoId: null,
  currentDimensionamientoId: null,
  currentValidacionId: null,
  currentCotizacionId: null
};

function money(v) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(v || 0));
}

function qs(id) { return document.getElementById(id); }
function text(v, fb='—') { return v === undefined || v === null || v === '' ? fb : String(v); }

async function apiGet(action, params = {}) {
  const url = new URL(WEB_APP_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error en GET');
  return json.data;
}

async function apiPost(action, data) {
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error en POST');
  return json.data;
}

function fillSelect(selectId, items, valueKey, labelFn, extraDataset = {}) {
  const sel = qs(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecciona una opción</option>';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = text(item[valueKey], '');
    opt.textContent = labelFn(item);
    Object.entries(extraDataset(item)).forEach(([k, v]) => { if (v !== undefined) opt.dataset[k] = v; });
    sel.appendChild(opt);
  });
}

function renderKPIs() {
  qs('kpi-paneles').textContent = qs('kpi-paneles').textContent || '343';
  qs('capacidad_instalada_kw').textContent = qs('capacidad_instalada_kw').textContent || '188.7';
}

function renderPipelineRows(rows = []) {
  const tb = qs('tabla-pipeline'); if (!tb) return;
  tb.innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td>${text(r.pipeline_id)}</td><td>${text(r.cliente_id)}</td><td>${text(r.cotizacion_id)}</td><td>${text(r.etapa)}</td><td>${text(r.proxima_accion)}</td><td>${text(r.fecha_proxima_accion)}</td><td>${text(r.responsable)}</td>
    </tr>
  `).join('') : '<tr><td colspan="7">Sin registros</td></tr>';
}

function renderDetalleRows(detalle = []) {
  const tb = qs('tabla-detalle-costos'); if (!tb) return;
  tb.innerHTML = detalle.length ? detalle.map(r => `<tr><td>${text(r.concepto)}</td><td>${money(r.monto_mxn)}</td></tr>`).join('') : '<tr><td colspan="2">Sin registros</td></tr>';
}

function renderROIRows(roi = []) {
  const tb = qs('tabla-roi'); if (!tb) return;
  tb.innerHTML = roi.length ? roi.map(r => `<tr><td>${text(r.anio)}</td><td>${money(r.ahorro_anual_mxn)}</td><td>${text(r.payback_estimado)}</td></tr>`).join('') : '<tr><td colspan="3">Sin registros</td></tr>';
}

function bindEvents() {
  qs('btn-generar-pdf')?.addEventListener('click', () => window.print());
  qs('btn-cargar-datos')?.addEventListener('click', loadAll);
  qs('btn-generar-cotizacion')?.addEventListener('click', () => qs('cotizacion')?.scrollIntoView({behavior:'smooth'}));

  const recalc = () => {
    const cons = Number(qs('consumo_kwh_periodo')?.value || 0);
    const irr = Number(qs('dim_irradiancia')?.value || 6.2);
    const per = Number(qs('dim_perdidas')?.value || 12);
    const sim = Number(qs('dim_simultaneidad')?.value || 0.9);
    const wp = Number(qs('select-panel')?.selectedOptions?.[0]?.dataset?.wp || 550);
    if (!cons) return;
    const kw = (cons / (irr * 30.4)) / (1 - per / 100) / sim;
    const capacidad = Math.round(kw * 100) / 100;
    const qty = Math.ceil((capacidad * 1000) / wp);
    const inst = Math.round((qty * wp / 1000) * 100) / 100;
    qs('capacidad_instalada_kw').value = inst.toFixed(2);
    qs('cantidad_paneles').textContent = String(qty);
    qs('capacidad_instalada_kw').textContent = inst.toFixed(1);
  };
  ['consumo_kwh_periodo','dim_irradiancia','dim_perdidas','dim_simultaneidad','select-panel'].forEach(id => qs(id)?.addEventListener('input', recalc));
  ['consumo_kwh_periodo','dim_irradiancia','dim_perdidas','dim_simultaneidad','select-panel'].forEach(id => qs(id)?.addEventListener('change', recalc));

  qs('form-cliente')?.addEventListener('submit', onClienteSubmit);
  qs('form-diagnostico')?.addEventListener('submit', onDiagnosticoSubmit);
  qs('form-dimensionamiento')?.addEventListener('submit', onDimensionamientoSubmit);
  qs('form-validacion')?.addEventListener('submit', onValidacionSubmit);
  qs('form-cotizacion')?.addEventListener('submit', onCotizacionSubmit);
}

async function onClienteSubmit(e) {
  e.preventDefault();
  const payload = {
    nombre_razon_social: qs('cliente_nombre')?.value || '',
    segmento: qs('cliente_segmento')?.value || '',
    contacto: qs('cliente_contacto')?.value || '',
    telefono: qs('cliente_telefono')?.value || '',
    datos_cliente: qs('datos-cliente')?.value || ''
  };
  const saved = await apiPost('crear_cliente', payload);
  state.currentClienteId = saved.cliente_id;
  qs('cliente_id').value = saved.cliente_id;
  qs('diag_cliente_id').value = saved.cliente_id;
  qs('dim_cliente_id').value = saved.cliente_id;
  qs('val_cliente_id').value = saved.cliente_id;
  qs('cot_cliente_id').value = saved.cliente_id;
  alert('Cliente guardado: ' + saved.cliente_id);
  await loadAll();
}

async function onDiagnosticoSubmit(e) {
  e.preventDefault();
  const cliente_id = qs('cliente_id')?.value || qs('diag_cliente_id')?.value || state.currentClienteId || '';
  const payload = {
    cliente_id,
    numero_servicio_rmu: qs('cliente_id')?.value || '',
    tarifa_cfe: qs('tarifa_cfe')?.value || '',
    tension_suministro: qs('tension_suministro')?.value || '',
    consumo_kwh_periodo: Number(qs('consumo_kwh_periodo')?.value || 0),
    periodo_facturacion: qs('periodo_facturacion')?.value || 'Mensual'
  };
  const saved = await apiPost('crear_diagnostico', payload);
  state.currentDiagnosticoId = saved.diagnostico_id;
  qs('dim_cliente_id').value = cliente_id;
  alert('Diagnóstico guardado: ' + saved.diagnostico_id);
}

async function onDimensionamientoSubmit(e) {
  e.preventDefault();
  const payload = {
    cliente_id: qs('dim_cliente_id')?.value || state.currentClienteId || '',
    consumo_promedio_mensual_kwh: Number(qs('consumo_kwh_periodo')?.value || 0),
    irradiancia_kwh_m2_dia: Number(qs('dim_irradiancia')?.value || 6.2),
    perdidas_sistema_pct: Number(qs('dim_perdidas')?.value || 12),
    factor_simultaneidad: Number(qs('dim_simultaneidad')?.value || 0.9),
    panel_id: qs('select-panel')?.value || '',
    inversor_id: qs('select-inversor')?.value || ''
  };
  const saved = await apiPost('crear_dimensionamiento', payload);
  state.currentDimensionamientoId = saved.dimensionamiento_id;
  qs('val_capacidad').value = saved.capacidad_instalada_kw || '';
  qs('capacidad_instalada_kw').value = saved.capacidad_instalada_kw || '';
  qs('capacidad_instalada_kw').textContent = saved.capacidad_instalada_kw || '';
  alert('Dimensionamiento guardado: ' + saved.dimensionamiento_id);
}

async function onValidacionSubmit(e) {
  e.preventDefault();
  const payload = {
    cliente_id: qs('val_cliente_id')?.value || state.currentClienteId || '',
    capacidad_instalada_kw: Number(qs('val_capacidad')?.value || qs('capacidad_instalada_kw')?.value || 0)
  };
  const saved = await apiPost('crear_validacion', payload);
  state.currentValidacionId = saved.validacion_id;
  alert('Validación guardada: ' + saved.validacion_id);
}

function parseJsonField(id) {
  const raw = qs(id)?.value?.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('El campo ' + id + ' debe ser un arreglo JSON');
  return parsed;
}

async function onCotizacionSubmit(e) {
  e.preventDefault();
  const payload = {
    cliente_id: qs('cot_cliente_id')?.value || state.currentClienteId || '',
    vigencia_dias: Number(qs('cot_vigencia')?.value || 15),
    iva_pct: Number(qs('cot_iva')?.value || 16),
    vendedor: qs('cot_vendedor')?.value || 'Alonso Villalobos',
    esquema_contraprestacion: qs('cot_esquema')?.value || 'Net metering',
    objetivo_financiero: qs('cot_objetivo')?.value || '',
    detalle: parseJsonField('detalle-costos'),
    roi: parseJsonField('roi-json')
  };
  const saved = await apiPost('crear_cotizacion', payload);
  state.currentCotizacionId = saved.cotizacion_id;
  alert('Cotización guardada: ' + saved.cotizacion_id);
  await loadAll();
}

async function loadAll() {
  const all = await apiGet('all');
  state.clientes = all.clientes || [];
  state.paneles = all.paneles || [];
  state.inversores = all.inversores || [];
  state.cotizaciones = all.cotizaciones || [];
  state.pipeline = all.pipeline || [];

  fillSelect('select-panel', state.paneles, 'panel_id', p => `${text(p.marca)} ${text(p.modelo)} · ${text(p.potencia_wp)} Wp`, p => ({ wp: p.potencia_wp }));
  fillSelect('select-inversor', state.inversores, 'inversor_id', i => `${text(i.marca)} ${text(i.modelo)} · ${text(i.capacidad_kw)} kW`, i => ({ kw: i.capacidad_kw }));

  renderPipelineRows(state.pipeline);
  renderKPIs();

  if (state.cotizaciones.length) {
    const last = state.cotizaciones[state.cotizaciones.length - 1];
    if (last?.cotizacion_id) {
      const full = await apiGet('cotizacion_completa', { id: last.cotizacion_id });
      if (full) {
        renderDetalleRows(full.detalle || []);
        renderROIRows(full.roi || []);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { bindEvents(); loadAll().catch(err => console.error(err)); });
