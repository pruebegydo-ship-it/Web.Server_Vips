const service = 1951;
const hosts = ["https://api.platoboost.app", "https://api.platoboost.net", "https://api.platoboost.com"];

const VIPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqWAqkbC_BHSu70Rfpzt2Oj-8J0BWyr8H73epkk20TO5Q9HlExx0rw0UJ7QUuTwvD71A/exec";
const STATS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxgt2bJ2ms81WRlvWuIMKyz6Hjf_00ADm06inQhNsBy56Tamh9LCKZdnHp9mFW6XfKq/exec";
const ADMIN_PASSWORD = "Fer22";

let currentSession = null;
let countdownTimer = null;
let db = null;
let statsUpdateInterval = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PlatoboostDB', 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('stats')) {
        database.createObjectStore('stats', { keyPath: 'id' });
      }
    };
  });
}

async function saveSession(sessionData) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    const data = { id: 'current', ...sessionData, timestamp: Date.now() };
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSession() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions'], 'readonly');
    const store = transaction.objectStore('sessions');
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSession() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sessions'], 'readwrite');
    const store = transaction.objectStore('sessions');
    const request = store.delete('current');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveStats(statsData) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['stats'], 'readwrite');
    const store = transaction.objectStore('stats');
    const data = { id: 'current', ...statsData, timestamp: Date.now() };
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getStoredStats() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['stats'], 'readonly');
    const store = transaction.objectStore('stats');
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadStoredSession() {
  try {
    const stored = await getSession();
    if (!stored) return false;
    const elapsed = Math.floor((Date.now() - stored.timestamp) / 1000);
    const remaining = 1200 - elapsed;
    if (remaining <= 0) {
      await deleteSession();
      return false;
    }
    currentSession = { identifier: stored.identifier, url: stored.url };
    document.getElementById('fallbackLink').href = stored.url;
    document.getElementById('fallbackLink').classList.remove('hidden');
    document.getElementById('generateBtn').classList.add('hidden');
    document.getElementById('newLinkBtn').classList.remove('hidden');
    startCountdown(remaining);
    return true;
  } catch (error) {
    console.error('Error loading session:', error);
    return false;
  }
}

function createParticles() {
  const particlesContainer = document.getElementById('particles');
  const particleCount = window.innerWidth > 768 ? 50 : 25;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
    particlesContainer.appendChild(particle);
  }
}

function startCountdown(seconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  const countdownEl = document.getElementById('countdown');
  countdownEl.classList.remove('hidden');
  const updateCountdown = () => {
    if (seconds <= 0) {
      clearInterval(countdownTimer);
      countdownEl.classList.add('hidden');
      currentSession = null;
      deleteSession();
      resetUI();
      return;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    countdownEl.textContent = `⏳ Expira en ${minutes}m ${secs.toString().padStart(2, '0')}s`;
    seconds--;
  };
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function resetUI() {
  document.getElementById('fallbackLink').classList.add('hidden');
  document.getElementById('generateBtn').classList.remove('hidden');
  document.getElementById('newLinkBtn').classList.add('hidden');
  document.getElementById('status').classList.add('hidden');
  document.getElementById('countdown').classList.add('hidden');
}

function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('status');
  statusEl.className = `status status-${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
}

async function tryWithHosts(path, options) {
  for (const hostname of hosts) {
    try {
      const response = await fetch(`${hostname}${path}`, options);
      if (response.ok) return response;
    } catch (error) {
      continue;
    }
  }
  throw new Error("Todos los hosts fallaron");
}

async function generateLink() {
  document.getElementById('result').classList.add('hidden');
  document.getElementById('vipList').style.display = 'none';
  const identifier = crypto.randomUUID();
  const createdAt = Date.now();
  try {
    const response = await tryWithHosts(`/public/start?t=${createdAt}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, identifier })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    currentSession = { identifier, url: data.data.url };
    await saveSession({ identifier: identifier, url: data.data.url });
    
    const popup = window.open(data.data.url, "_blank");
    
    if (!popup || popup.closed) {
      document.getElementById('fallbackLink').href = data.data.url;
      document.getElementById('fallbackLink').classList.remove('hidden');
    }
    
    document.getElementById('generateBtn').classList.add('hidden');
    document.getElementById('newLinkBtn').classList.remove('hidden');
    startCountdown(1200);
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  }
}

async function generateNewLink() {
  currentSession = null;
  if (countdownTimer) clearInterval(countdownTimer);
  await deleteSession();
  resetUI();
  await generateLink();
}

async function verifyKey() {
  if (!currentSession) {
    showStatus('Genera un enlace primero', 'error');
    return;
  }
  const key = document.getElementById('keyInput').value.trim();
  if (!key) {
    showStatus('Ingresa una key primero', 'error');
    return;
  }
  const resultEl = document.getElementById('result');
  resultEl.className = 'status';
  resultEl.innerHTML = '<span class="loader"></span> Verificando...';
  resultEl.classList.remove('hidden');
  const nonce = Date.now().toString();
  const path = `/public/whitelist/${service}?identifier=${currentSession.identifier}&key=${encodeURIComponent(key)}&nonce=${nonce}`;
  try {
    const response = await tryWithHosts(path, { method: "GET" });
    const data = await response.json();
    if (data.success && data.data.valid === true) {
      resultEl.className = 'status status-success';
      resultEl.textContent = '✅ Key válida - Acceso concedido';
      await loadVIPs();
    } else if (data.success && data.data.valid === false) {
      resultEl.className = 'status status-warning';
      resultEl.textContent = '⚠️ Key no válida para esta sesión. Genera un nuevo enlace.';
    } else {
      resultEl.className = 'status status-error';
      resultEl.textContent = '❌ Key inválida o expirada';
    }
  } catch (err) {
    resultEl.className = 'status status-error';
    resultEl.textContent = `❌ Error: ${err.message}`;
  }
}

async function loadVIPs() {
  try {
    const response = await fetch(`${VIPS_SCRIPT_URL}?action=getAll&t=${Date.now()}`);
    const data = await response.json();
    if (data.success && data.vips && data.vips.length > 0) {
      const vipListEl = document.getElementById('vipList');
      vipListEl.innerHTML = '';
      data.vips.forEach(vip => {
        const item = document.createElement('div');
        item.className = 'vip-item';
        item.onclick = () => openVIP(vip.link, vip.name);
        item.innerHTML = `
          <img src="${vip.imageUrl}" alt="${vip.name}" onerror="this.src='https://via.placeholder.com/52x52/1e293b/f8fafc?text=VIP'" />
          <span>${vip.name}</span>
        `;
        vipListEl.appendChild(item);
      });
      vipListEl.style.display = 'block';
    }
  } catch (error) {
    console.error('Error cargando VIPs:', error);
  }
}

function openVIP(link, vipName) {
  const popup = window.open(link, "_blank");
  
  if (!popup || popup.closed) {
    showStatus('⚠️ No se pudo abrir automático', 'warning');
  }
}

function openAdminModal() {
  document.getElementById('adminModal').classList.add('active');
  if (sessionStorage.getItem('adminAuth') === 'true') {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadVIPsAdmin();
  }
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('active');
}

function loginAdmin() {
  const password = document.getElementById('adminPassword').value;
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem('adminAuth', 'true');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadVIPsAdmin();
  } else {
    showStatus('❌ Contraseña incorrecta', 'error');
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('adminAuth');
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('adminSection').classList.add('hidden');
  document.getElementById('adminPassword').value = '';
  closeAdminModal();
}

async function loadVIPsAdmin() {
  try {
    const response = await fetch(`${VIPS_SCRIPT_URL}?action=getAll&t=${Date.now()}`);
    const data = await response.json();
    const listEl = document.getElementById('adminVipList');
    listEl.innerHTML = '';
    if (data.success && data.vips && data.vips.length > 0) {
      data.vips.forEach((vip, index) => {
        const card = document.createElement('div');
        card.className = 'admin-vip-card';
        card.innerHTML = `
          <img src="${vip.imageUrl}" alt="${vip.name}" onerror="this.src='https://via.placeholder.com/300x120/1e293b/f8fafc?text=VIP'" />
          <h3>${vip.name}</h3>
          <p><strong>🖼️ Imagen:</strong> ${vip.imageUrl.substring(0, 40)}...</p>
          <p><strong>🔗 Link:</strong> ${vip.link.substring(0, 40)}...</p>
          <div class="admin-actions">
            <button class="btn btn-secondary btn-small" onclick="editVIP(${index}, '${vip.name.replace(/'/g, "\\'")}', '${vip.imageUrl.replace(/'/g, "\\'")}', '${vip.link.replace(/'/g, "\\'")}')">✏️ Editar</button>
            <button class="btn btn-primary btn-small" style="background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteVIP(${index}, '${vip.name.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>
          </div>
        `;
        listEl.appendChild(card);
      });
    } else {
      listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No hay VIPs registrados</p>';
    }
  } catch (error) {
    showStatus('❌ Error al cargar VIPs', 'error');
  }
}

async function addVIP() {
  const name = document.getElementById('newVipName').value.trim();
  const imageUrl = document.getElementById('newVipImage').value.trim();
  const link = document.getElementById('newVipLink').value.trim();
  if (!name || !imageUrl || !link) {
    showStatus('⚠️ Todos los campos son obligatorios', 'error');
    return;
  }
  if (!link.includes('roblox.com')) {
    showStatus('⚠️ El link debe ser de Roblox', 'error');
    return;
  }
  try {
    const params = new URLSearchParams({
      action: 'add',
      name: encodeURIComponent(name),
      imageUrl: encodeURIComponent(imageUrl),
      link: encodeURIComponent(link),
      t: Date.now()
    });
    const response = await fetch(`${VIPS_SCRIPT_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      showStatus('✅ VIP agregado correctamente', 'success');
      document.getElementById('newVipName').value = '';
      document.getElementById('newVipImage').value = '';
      document.getElementById('newVipLink').value = '';
      loadVIPsAdmin();
    } else {
      showStatus('❌ Error al agregar VIP: ' + data.message, 'error');
    }
  } catch (error) {
    showStatus('❌ Error de conexión: ' + error.message, 'error');
  }
}

async function deleteVIP(index, name) {
  if (!confirm(`¿Estás seguro de eliminar "${name}"?`)) return;
  try {
    const params = new URLSearchParams({
      action: 'delete',
      index: index,
      t: Date.now()
    });
    const response = await fetch(`${VIPS_SCRIPT_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      showStatus('✅ VIP eliminado correctamente', 'success');
      loadVIPsAdmin();
    } else {
      showStatus('❌ Error al eliminar VIP: ' + data.message, 'error');
    }
  } catch (error) {
    showStatus('❌ Error de conexión: ' + error.message, 'error');
  }
}

function editVIP(index, name, imageUrl, link) {
  const newName = prompt('Nuevo nombre:', name);
  if (newName === null) return;
  const newImage = prompt('Nueva URL de imagen:', imageUrl);
  if (newImage === null) return;
  const newLink = prompt('Nuevo link:', link);
  if (newLink === null) return;
  updateVIP(index, newName, newImage, newLink);
}

async function updateVIP(index, name, imageUrl, link) {
  try {
    const params = new URLSearchParams({
      action: 'update',
      index: index,
      name: encodeURIComponent(name),
      imageUrl: encodeURIComponent(imageUrl),
      link: encodeURIComponent(link),
      t: Date.now()
    });
    const response = await fetch(`${VIPS_SCRIPT_URL}?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      showStatus('✅ VIP actualizado correctamente', 'success');
      loadVIPsAdmin();
    } else {
      showStatus('❌ Error al actualizar VIP: ' + data.message, 'error');
    }
  } catch (error) {
    showStatus('❌ Error de conexión: ' + error.message, 'error');
  }
}

async function loadCachedStats() {
  try {
    const cached = await getStoredStats();
    if (cached && cached.visits) {
      document.getElementById('visitCount').textContent = cached.visits;
    }
  } catch (error) {
    console.error('Error cargando cache:', error);
  }
}

function animateCount(start, end, duration) {
  const element = document.getElementById('visitCount');
  if (!element) return;
  
  if (start === end) return;
  
  element.classList.add('updating');
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
      element.classList.remove('updating');
    }
    element.textContent = Math.floor(current);
  }, 16);
}

async function incrementVisit() {
  try {
    const response = await fetch(`${STATS_SCRIPT_URL}?action=incrementVisit&t=${Date.now()}`);
    const data = await response.json();
    if (data.success && data.visits) {
      const currentCount = parseInt(document.getElementById('visitCount').textContent) || 0;
      if (currentCount !== data.visits) {
        animateCount(currentCount, data.visits, 1000);
      }
    }
  } catch (error) {
    console.error('Error incrementando visita:', error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${STATS_SCRIPT_URL}?action=getStats&t=${Date.now()}`);
    const data = await response.json();
    if (data.success) {
      await saveStats({ visits: data.visits });
      const currentCount = parseInt(document.getElementById('visitCount').textContent) || 0;
      if (data.visits !== currentCount) {
        animateCount(currentCount, data.visits, 800);
      }
    }
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

function startStatsUpdate() {
  if (statsUpdateInterval) clearInterval(statsUpdateInterval);
  statsUpdateInterval = setInterval(() => {
    loadStats();
  }, 30000);
}

window.addEventListener('load', async () => {
  await initDB();
  createParticles();
  await loadStoredSession();
  await loadCachedStats();
  await incrementVisit();
  await loadStats();
  startStatsUpdate();
});

window.addEventListener('resize', () => {
  const particlesContainer = document.getElementById('particles');
  particlesContainer.innerHTML = '';
  createParticles();
});