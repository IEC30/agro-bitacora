/**
 * Orquestador principal de AgroBitácora
 * Gestiona el ciclo de vida del App Shell, estado de conexión, registro del Service Worker,
 * autenticación offline por roles (RBAC), interacción con hardware (GPS/Cámara) y renderizado CSR.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicialización de la base de datos IndexedDB
  try {
    await window.agroDB.init();
    console.log('[App] IndexedDB inicializada correctamente.');
  } catch (err) {
    console.error('[App] Error al inicializar IndexedDB:', err);
  }

  // 2. Elementos del DOM - Conectividad & App Shell
  const banner = document.getElementById('connection-banner');
  const statusText = document.getElementById('status-text');
  const btnInstall = document.getElementById('btn-install');

  // Elementos del DOM - Autenticación
  const authSection = document.getElementById('auth-section');
  const appWorkspace = document.getElementById('app-workspace');
  const formLogin = document.getElementById('form-login');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const userSessionBar = document.getElementById('user-session-bar');
  const sessionUserName = document.getElementById('session-user-name');
  const sessionUserRole = document.getElementById('session-user-role');
  const btnLogout = document.getElementById('btn-logout');
  const demoButtons = document.querySelectorAll('.btn-demo');

  // Elementos del DOM - Formulario de Observación y Auditoría
  const formCard = document.getElementById('form-card');
  const formObservation = document.getElementById('form-observation');
  const auditorNotice = document.getElementById('auditor-notice');
  const btnSubmit = document.getElementById('btn-submit');
  const listContainer = document.getElementById('observations-list');
  const syncBadge = document.getElementById('sync-badge');
  const btnExportReport = document.getElementById('btn-export-report');

  // Módulo GPS
  const btnGetGeo = document.getElementById('btn-get-geo');
  const geoStatus = document.getElementById('geo-status');
  const inputLat = document.getElementById('geo-lat');
  const inputLng = document.getElementById('geo-lng');
  const inputAcc = document.getElementById('geo-acc');

  // Módulo Cámara
  const video = document.getElementById('camera-video');
  const preview = document.getElementById('photo-preview');
  const streamContainer = document.getElementById('camera-stream-container');
  const previewContainer = document.getElementById('photo-preview-container');
  const btnOpenCamera = document.getElementById('btn-open-camera');
  const btnSnapPhoto = document.getElementById('btn-snap-photo');
  const btnDeletePhoto = document.getElementById('btn-delete-photo');
  const inputFallback = document.getElementById('camera-fallback');
  const btnFallbackCamera = document.getElementById('btn-fallback-camera');

  const camera = new window.CameraService(video, preview, streamContainer, previewContainer);

  // -------------------------------------------------------------
  // REGISTRO DEL SERVICE WORKER & INSTALACIÓN PWA
  // -------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('[PWA] Service Worker registrado con éxito en:', registration.scope);
      } catch (err) {
        console.error('[PWA] Falló el registro del Service Worker:', err);
      }
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.hidden = false;
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Respuesta del usuario a la instalación:', outcome);
    deferredPrompt = null;
    btnInstall.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] AgroBitácora instalada en el sistema.');
    btnInstall.hidden = true;
  });

  // -------------------------------------------------------------
  // MONITOREO REACTIVO DE RED (ONLINE / OFFLINE)
  // -------------------------------------------------------------
  function updateNetworkStatus() {
    if (navigator.onLine) {
      banner.className = 'status-banner online';
      statusText.textContent = 'En Línea - Conectado';
    } else {
      banner.className = 'status-banner offline';
      statusText.textContent = 'Modo Offline - Almacenando en Dispositivo';
    }
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // -------------------------------------------------------------
  // GESTIÓN DE AUTENTICACIÓN Y ROLES (RBAC)
  // -------------------------------------------------------------
  function applyAuthUI() {
    const user = window.authService.getCurrentUser();

    if (user) {
      // Usuario autenticado: mostrar espacio de trabajo
      authSection.style.display = 'none';
      appWorkspace.style.display = 'block';
      userSessionBar.style.display = 'flex';

      sessionUserName.textContent = user.name;
      sessionUserRole.textContent = user.roleLabel;
      sessionUserRole.className = `role-badge ${user.badgeClass}`;

      // Aplicar restricciones según rol
      if (user.role === 'auditor') {
        // Rol Auditor: Solo lectura
        auditorNotice.style.display = 'flex';
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
        btnSubmit.textContent = '🔒 Registro deshabilitado para Auditores';
        disableFormFields(true);
      } else {
        // Roles Supervisor y Técnico: Registro habilitado
        auditorNotice.style.display = 'none';
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
        btnSubmit.textContent = '💾 Guardar en Bitácora Local';
        disableFormFields(false);
      }

      renderObservations();
    } else {
      // Usuario no autenticado: mostrar formulario de login
      authSection.style.display = 'block';
      appWorkspace.style.display = 'none';
      userSessionBar.style.display = 'none';
      loginError.style.display = 'none';
    }
  }

  function disableFormFields(disabled) {
    const fields = formObservation.querySelectorAll('input, select, textarea, button');
    fields.forEach((field) => {
      // Excluir botones que deben seguir activos si fuera necesario
      field.disabled = disabled;
    });
  }

  // Manejo del Login manual
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    try {
      window.authService.login(loginEmail.value, loginPassword.value);
      loginEmail.value = '';
      loginPassword.value = '';
      applyAuthUI();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    }
  });

  // Manejo de botones de acceso rápido de demostración
  demoButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const pass = btn.getAttribute('data-pass');
      loginEmail.value = email;
      loginPassword.value = pass;
      
      try {
        window.authService.login(email, pass);
        applyAuthUI();
      } catch (err) {
        loginError.textContent = err.message;
        loginError.style.display = 'block';
      }
    });
  });

  // Manejo de Logout
  btnLogout.addEventListener('click', () => {
    if (confirm('¿Desea cerrar la sesión activa? Podrá volver a ingresar sin conexión en cualquier momento.')) {
      window.authService.logout();
      camera.clearPhoto();
      applyAuthUI();
    }
  });

  // -------------------------------------------------------------
  // CAPTURA DE COORDENADAS GPS
  // -------------------------------------------------------------
  btnGetGeo.addEventListener('click', async () => {
    geoStatus.textContent = '📍 Fijando satélites GPS...';
    btnGetGeo.disabled = true;

    try {
      const coords = await window.GeoService.obtenerCoordenadas();
      inputLat.value = coords.lat.toFixed(6);
      inputLng.value = coords.lng.toFixed(6);
      inputAcc.value = coords.accuracy.toFixed(1);

      geoStatus.textContent = `Lat: ${inputLat.value}, Lng: ${inputLng.value} (±${inputAcc.value}m de precisión)`;
      geoStatus.style.color = 'var(--primary-dark)';
    } catch (err) {
      geoStatus.textContent = `⚠️ ${err.message}`;
      geoStatus.style.color = '#C62828';
    } finally {
      btnGetGeo.disabled = false;
    }
  });

  // -------------------------------------------------------------
  // GESTIÓN DE CÁMARA (WEBRTC + FALLBACK)
  // -------------------------------------------------------------
  btnOpenCamera.addEventListener('click', async () => {
    try {
      await camera.startStream();
    } catch (err) {
      console.warn('[App] Activando selector de cámara nativo');
      inputFallback.click();
    }
  });

  btnSnapPhoto.addEventListener('click', () => {
    camera.takeSnapshot();
  });

  btnDeletePhoto.addEventListener('click', () => {
    camera.clearPhoto();
  });

  btnFallbackCamera.addEventListener('click', () => {
    inputFallback.click();
  });

  inputFallback.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      camera.handleFileSelection(e.target.files[0]);
    }
  });

  // -------------------------------------------------------------
  // ENVÍO DE FORMULARIO Y GUARDADO EN INDEXEDDB
  // -------------------------------------------------------------
  formObservation.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = window.authService.getCurrentUser();
    if (!currentUser || !window.authService.hasPermission('canCreate')) {
      alert('Su perfil actual no cuenta con autorización para crear registros.');
      return;
    }

    const data = {
      lote: document.getElementById('lote').value.trim(),
      cultivo: document.getElementById('cultivo').value.trim(),
      categoria: document.getElementById('categoria').value,
      notas: document.getElementById('notas').value.trim(),
      registradoPor: currentUser.name,
      rolUsuario: currentUser.roleLabel,
      geo: {
        lat: inputLat.value || null,
        lng: inputLng.value || null,
        accuracy: inputAcc.value || null
      },
      foto: camera.currentBlob || null
    };

    try {
      await window.agroDB.agregarObservacion(data);

      formObservation.reset();
      camera.clearPhoto();
      geoStatus.textContent = 'Coordenadas no fijadas';
      geoStatus.style.color = '';
      inputLat.value = '';
      inputLng.value = '';
      inputAcc.value = '';

      await renderObservations();
    } catch (err) {
      alert('Error al guardar en el cuaderno local: ' + err.message);
    }
  });

  // -------------------------------------------------------------
  // EXPORTACIÓN DE REPORTE DE TRAZABILIDAD (JSON / AUDITORÍA)
  // -------------------------------------------------------------
  btnExportReport.addEventListener('click', async () => {
    try {
      const records = await window.agroDB.obtenerTodas();
      if (!records || records.length === 0) {
        alert('No existen registros en el cuaderno local para exportar.');
        return;
      }

      // Preparar estructura de reporte auditable
      const reporte = {
        titulo: 'Reporte de Trazabilidad y Monitoreo Agrícola - AgroBitácora',
        generadoPor: window.authService.getCurrentUser()?.name || 'Usuario Local',
        fechaExportacion: new Date().toISOString(),
        totalRegistros: records.length,
        observaciones: records.map((r) => ({
          id: r.id,
          fecha: r.fecha,
          lote: r.lote,
          cultivo: r.cultivo,
          categoria: r.categoria,
          notas: r.notas,
          registradoPor: r.registradoPor || 'No especificado',
          geo: r.geo,
          tieneEvidenciaFotografica: !!r.foto,
          sincronizado: r.sincronizado === 1 ? 'Sincronizado' : 'Pendiente'
        }))
      };

      const jsonStr = JSON.stringify(reporte, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agrobitacora_auditoria_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al generar el reporte de auditoría: ' + err.message);
    }
  });

  // -------------------------------------------------------------
  // RENDERIZADO CSR DEL LISTADO DE OBSERVACIONES
  // -------------------------------------------------------------
  async function renderObservations() {
    let records = [];
    let pendientes = 0;

    try {
      records = await window.agroDB.obtenerTodas();
      pendientes = await window.agroDB.contarPendientes();
    } catch (e) {
      console.warn('[App] Error al consultar IndexedDB:', e);
    }

    syncBadge.textContent = `${pendientes} registros locales`;

    if (!records || records.length === 0) {
      listContainer.innerHTML = '<p class="empty-msg">No hay registros almacenados en este dispositivo.</p>';
      return;
    }

    listContainer.innerHTML = '';
    const canDelete = window.authService.hasPermission('canDelete');

    records.forEach((rec) => {
      const card = document.createElement('div');
      card.className = 'item-card';

      const imgUrl = rec.foto
        ? URL.createObjectURL(rec.foto)
        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="%23CCC"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/></svg>';

      const fechaObj = new Date(rec.fecha);
      const fechaFormateada = fechaObj.toLocaleDateString() + ' ' + fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const coordsText = rec.geo && rec.geo.lat
        ? `GPS: ${rec.geo.lat}, ${rec.geo.lng} (±${rec.geo.accuracy}m)`
        : 'Sin ubicación GPS';

      const autor = rec.registradoPor ? `<p class="item-meta">👤 ${rec.registradoPor} (${rec.rolUsuario || 'Campo'})</p>` : '';
      const deleteBtnHtml = canDelete
        ? `<button class="btn-remove-item" data-id="${rec.id}" title="Eliminar registro (Solo Supervisor)">✕</button>`
        : '';

      card.innerHTML = `
        <img src="${imgUrl}" class="item-thumb" alt="Evidencia de campo">
        <div class="item-details">
          <div class="item-header">
            <h4>${rec.cultivo} · ${rec.lote}</h4>
            ${deleteBtnHtml}
          </div>
          <span class="category-tag">${rec.categoria}</span>
          ${autor}
          <p class="item-meta">📅 ${fechaFormateada}</p>
          <p class="item-meta">📍 ${coordsText}</p>
          <p class="item-notes">${rec.notas}</p>
        </div>
      `;

      listContainer.appendChild(card);
    });

    // Delegación de eventos para eliminar registros (solo habilitado si tiene permiso)
    if (canDelete) {
      listContainer.querySelectorAll('.btn-remove-item').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          if (confirm('¿Desea eliminar esta observación de campo?')) {
            await window.agroDB.eliminarObservacion(id);
            renderObservations();
          }
        });
      });
    }
  }

  // Comprobar estado de autenticación al inicio
  applyAuthUI();
});
