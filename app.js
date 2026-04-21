  // Глобальна змінна для активного типу дашборду
  let currentDashboardType = 'Купівля';

  // ⭐ ГЛОБАЛЬНЫЙ МАССИВ ДЛЯ ХРАНЕНИЯ ЛИДОВ (чтобы не кодировать JSON в HTML)
  let leadsCache = [];
  
  // ⭐ API URLs
  const SCRIPT_URL_REALTY = "https://script.google.com/macros/s/AKfycbxeOtwVDlHNEAOM_o5Pi6OCw39UHddOhJOYimgKQo8CZ6t_UxAFjK75wfTxLAaZSF2A9A/exec";
  const SCRIPT_URL_RENT = "https://script.google.com/macros/s/AKfycbzwCHbMZkXwsCLs1oASQnG1XcpB6ROBN-fh297kns0CYuIrjPXpntbfTTl7ytRYUb_h/exec";
  
  // ⭐ Типи оренди
  const RENT_TYPES = ['Подобова', 'Сезонна', 'Довгострокова', 'Управління'];
  // ⭐ Поточний підтип оренди
  let currentRentSubtype = 'Всі';

  // ⭐ Функція для отримання правильного API URL в залежності від типу
  function getScriptUrl() {
    if (RENT_TYPES.includes(currentDashboardType) || currentDashboardType === 'Оренда') {
      console.log('🏨 Використовую API Оренда');
      return SCRIPT_URL_RENT;
    } else {
      // Нерухомість та Іпотека — один скрипт
      console.log('🏠 Використовую API Нерухомість');
      return SCRIPT_URL_REALTY;
    }
  }
  
  // Для сумісності зі старим кодом
  const SCRIPT_URL = SCRIPT_URL_REALTY;

  // ✅ УТИЛІТА: Безпечна конвертація дати з ISO/будь-якого формату в yyyy-MM-dd для <input type="date">
  // Якщо прийде ISO строка (через UTC зсув) — округлює до найближчої доби
  function dateToInputValue(dateStr) {
    if (!dateStr) return '';
    try {
      var s = String(dateStr);
      // ISO формат (2026-03-01T22:00:00.000Z) — округлюємо до найближчої доби
      if (s.indexOf('T') !== -1) {
        var d = new Date(s);
        var ms = 86400000; // 24h
        var rounded = new Date(Math.round(d.getTime() / ms) * ms);
        var yy = rounded.getUTCFullYear();
        var mm = ('0' + (rounded.getUTCMonth() + 1)).slice(-2);
        var dd = ('0' + rounded.getUTCDate()).slice(-2);
        return yy + '-' + mm + '-' + dd;
      }
      // dd.mm.yyyy → yyyy-mm-dd
      if (s.indexOf('.') !== -1) {
        var p = s.split('.');
        if (p.length === 3) return p[2] + '-' + p[1] + '-' + p[0];
      }
      // yyyy-mm-dd — вже ОК
      return s;
    } catch (e) {
      return '';
    }
  }

  // ✅ УТИЛІТА: Безпечне форматування дати для відображення (dd.MM.yyyy)
  // Якщо прийде ISO строка — округлює до найближчої доби (без UTC зсуву)
  function formatDateSafe(dateStr) {
    if (!dateStr) return '—';
    try {
      var s = String(dateStr);
      // ISO формат — округлюємо до найближчої доби
      if (s.indexOf('T') !== -1) {
        var d = new Date(s);
        var ms = 86400000;
        var rounded = new Date(Math.round(d.getTime() / ms) * ms);
        var dd = ('0' + rounded.getUTCDate()).slice(-2);
        var mm = ('0' + (rounded.getUTCMonth() + 1)).slice(-2);
        var yy = rounded.getUTCFullYear();
        return dd + '.' + mm + '.' + yy;
      }
      // dd.mm.yyyy — вже ОК (обрізаємо час якщо є)
      if (s.indexOf('.') !== -1) {
        return s.split(' ')[0];
      }
      // yyyy-mm-dd → dd.mm.yyyy
      if (s.indexOf('-') !== -1 && s.length === 10) {
        var p = s.split('-');
        return p[2] + '.' + p[1] + '.' + p[0];
      }
      return s;
    } catch (e) {
      return dateStr || '—';
    }
  }

  let currentUser = null;
  let allLeads = [];
  let managers = [];
  
  // ⭐ КЕШ: Всі ліди одного скрипта завантажуються одним запитом
  let cachedRentLeads = null;      // Всі ліди Оренди (всі типи)
  let cachedRealtyLeads = null;    // Всі ліди Нерухомості (всі типи)
  let cachedMortgageLeads = null;  // Всі ліди Іпотеки
  let selectedStage = null; // ⭐ Для отслеживання обраного етапу
  let dashboardCollapsed = true; // ⭐ За замовчуванням дашборд згорнутий
  let selectedManagers = []; // ⭐ НОВОЕ: Вибрані менеджери для дашборда (спочатку пусто, заповнюється при завантаженні)

  // ⭐ БЕЙДЖИКИ: Кількість нових лідів по кожному типу
  let tabNewCounts = {};

  // ⭐ ФУНКЦІЯ: Завантаження кількості нових лідів для всіх типів (для бейджиків)
  function loadTabBadges() {
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');
    if (!userName) return;

    const allTypes = ['Купівля', 'Продаж', 'Консультація', 'Іпотека', 'Подобова', 'Сезонна', 'Довгострокова', 'Управління'];

    allTypes.forEach(type => {
      const isRent = RENT_TYPES.includes(type);
      const url = isRent ? SCRIPT_URL_RENT : SCRIPT_URL_REALTY;
      const action = userRole === 'Admin' ? 'getAllLeads' : 'getLeads';
      const payload = userRole === 'Admin' ? { type: type } : { manager: userName, type: type };

      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ action: action, payload: payload })
      })
      .then(r => r.json())
      .then(result => {
        if (result.success && result.leads) {
          const activeLeads = result.leads.filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
          const newCount = activeLeads.filter(lead => isLeadNew(lead)).length;
          tabNewCounts[type] = newCount;
          updateTabBadge(type, newCount);
        }
      })
      .catch(e => console.warn('Badge load error for', type, e));
    });
  }

  // ⭐ ФУНКЦІЯ: Оновлення бейджика на конкретній вкладці
  function updateTabBadge(type, count) {
    // Для типів Оренди — оновлюю як сам підтип, так і загальний бейджик на кнопці "Оренда"
    if (RENT_TYPES.includes(type)) {
      // Бейджик на rent-type-btn підтипі
      const rentOption = document.getElementById('rentBtn-' + type);
      if (rentOption) {
        let badge = rentOption.querySelector('.pill-badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'pill-badge';
            rentOption.appendChild(badge);
          }
          badge.textContent = count;
        } else if (badge) {
          badge.remove();
        }
      }
      
      // Загальний бейджик на кнопці "Оренда" — сума всіх підтипів
      const totalRent = RENT_TYPES.reduce((sum, rt) => sum + (tabNewCounts[rt] || 0), 0);
      const rentPill = document.getElementById('pill-Оренда');
      if (rentPill) {
        let badge = rentPill.querySelector('.pill-badge');
        if (totalRent > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'pill-badge';
            rentPill.appendChild(badge);
          }
          badge.textContent = totalRent;
        } else if (badge) {
          badge.remove();
        }
      }
    } else {
      // Звичайні типи: Купівля, Продаж, Консультація
      const pill = document.getElementById('pill-' + type);
      if (pill) {
        let badge = pill.querySelector('.pill-badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'pill-badge';
            pill.appendChild(badge);
          }
          badge.textContent = count;
        } else if (badge) {
          badge.remove();
        }
      }
    }
  }

  // ⭐ ФУНКЦІЯ: Оновити бейджик поточного типу після перегляду (зменшити)
  function refreshCurrentTabBadge() {
    const type = currentDashboardType;
    const newCount = allLeads.filter(lead => isLeadNew(lead)).length;
    tabNewCounts[type] = newCount;
    updateTabBadge(type, newCount);
  }

  // ⭐ ВІДСТЕЖЕННЯ ПЕРЕГЛЯНУТИХ ЛІДІВ (зберігається в localStorage)
  function getViewedLeads() {
    const viewed = localStorage.getItem('viewedLeads');
    return viewed ? JSON.parse(viewed) : [];
  }
  
  // ⭐ ФУНКЦІЇ ДЛЯ OVERLAY ЗАВАНТАЖЕННЯ
  function showLoading(text = 'Зберігаю дані...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      console.warn('⚠️ loadingOverlay not found');
      return;
    }
    
    const textEl = document.getElementById('loadingText');
    const spinnerEl = overlay.querySelector('.loading-spinner');
    
    if (textEl) textEl.textContent = text;
    if (spinnerEl) {
      spinnerEl.textContent = '⏳';
      spinnerEl.className = 'loading-spinner';
    }
    overlay.classList.add('active');
  }
  
  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }
  
  function showSuccess(text = 'Успішно збережено!') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      alert(text);
      return;
    }
    
    const textEl = document.getElementById('loadingText');
    const spinnerEl = overlay.querySelector('.loading-spinner');
    
    if (textEl) textEl.textContent = text;
    if (spinnerEl) {
      spinnerEl.textContent = '✅';
      spinnerEl.className = 'loading-success';
    }
    
    // Автоматично закриваю через 1 секунду
    setTimeout(() => {
      hideLoading();
    }, 1000);
  }
  
  function showError(text = 'Помилка!') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      alert(text);
      return;
    }
    
    const textEl = document.getElementById('loadingText');
    const spinnerEl = overlay.querySelector('.loading-spinner');
    
    if (textEl) textEl.textContent = text;
    if (spinnerEl) {
      spinnerEl.textContent = '❌';
      spinnerEl.className = 'loading-success';
    }
    
    // Автоматично закриваю через 2 секунди
    setTimeout(() => {
      hideLoading();
    }, 2000);
  }
  
  function markLeadAsViewed(leadId) {
    if (!leadId) return;
    
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');
    const viewed = getViewedLeads();
    
    // ⭐ Нормалізую ID — видаляю пробіли, переноси рядків, зайві символи
    const normalizedId = String(leadId).replace(/[\s\n\r]+/g, '').trim();
    
    // ⭐ Для Admin використовую ключ "Admin_ID", для Manager - "ІмяМенеджера_ID"
    const viewKey = (userRole === 'Admin' ? 'Admin' : userName) + '_' + normalizedId;
    
    console.log('📝 markLeadAsViewed: leadId="' + leadId + '" → normalized="' + normalizedId + '" → viewKey="' + viewKey + '"');
    
    if (!viewed.includes(viewKey)) {
      viewed.push(viewKey);
      localStorage.setItem('viewedLeads', JSON.stringify(viewed));
      console.log('✅ Лід ' + normalizedId + ' позначено як переглянутий');
    }
  }
  
  function isLeadNew(lead) {
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');
    const viewed = getViewedLeads();
    
    // ⭐ Нормалізую ID
    const normalizedId = String(lead.id || '').replace(/[\s\n\r]+/g, '').trim();
    
    // ДЛЯ МЕНЕДЖЕРА: лід "новий" якщо призначений йому і ще не переглянутий
    var leadManagers = (lead.manager || '').split(',').map(function(s) { return s.trim(); });
    if (userRole === 'Manager' && (lead.manager === userName || leadManagers.includes(userName))) {
      const viewKey = userName + '_' + normalizedId;
      if (!viewed.includes(viewKey)) {
        return true;
      }
    }
    
    // ⭐ ДЛЯ АДМІНА: лід "новий" якщо без менеджера і ще не переглянутий
    if (userRole === 'Admin' && isLeadUnassigned(lead)) {
      const viewKey = 'Admin_' + normalizedId;
      if (!viewed.includes(viewKey)) {
        return true;
      }
    }
    
    return false;
  }
  
  function isLeadUnassigned(lead) {
    return !lead.manager || lead.manager === 'Не назначено' || lead.manager.trim() === '';
  }
  
  // ⭐ ОНОВЛЕННЯ СИГНАЛУ В ДАШБОРДІ
  function updateNewLeadsSignal(count) {
    let signalEl = document.getElementById('newLeadsSignal');
    
    if (count > 0) {
      if (!signalEl) {
        // Створюю елемент сигналу біля заголовка дашборду
        const dashboardHeader = document.querySelector('.dashboard-header');
        if (dashboardHeader) {
          signalEl = document.createElement('div');
          signalEl.id = 'newLeadsSignal';
          signalEl.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
            padding: 8px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
            margin-left: 15px;
            animation: pulse 1s ease-in-out infinite;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(255, 165, 0, 0.5);
          `;
          signalEl.onclick = function() {
            // Скролю до таблиці лідів
            document.getElementById('leadsTable').scrollIntoView({ behavior: 'smooth' });
          };
          dashboardHeader.querySelector('.section-title').after(signalEl);
        }
      }
      signalEl.innerHTML = `🔔 ${count} нових лідів!`;
      signalEl.style.display = 'inline-flex';
    } else if (signalEl) {
      signalEl.style.display = 'none';
    }
  }

  // ⭐ ФУНКЦІЯ ПАРСИНГУ БЮДЖЕТУ (підтримує діапазони типу "100-150k€")
  function parseBudget(budgetString) {
    if (!budgetString) return 0;
    
    budgetString = budgetString.toString().trim();
    
    // Замінюю всі типи дефісів на звичайний "-"
    budgetString = budgetString.replace(/[–—−]/g, '-');
    
    // Якщо є дефіс - беремо ВЕРХНЮ межу (друге число)
    if (budgetString.includes('-')) {
      const cleaned = budgetString.replace(/[^\d\-]/g, '');
      const parts = cleaned.split('-').filter(p => p.length > 0);
      
      if (parts.length >= 2) {
        const upperBound = parseInt(parts[parts.length - 1]);
        if (!isNaN(upperBound) && upperBound > 0) {
          return upperBound;
        }
      }
    }
    
    // Якщо не діапазон - беремо просто число
    const cleaned = budgetString.replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  }

  // ========== ВХІД (Email + Пароль) ==========
  function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = '⏳ Перевіряю...';

    console.log('Спроба входу:', email);

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'authenticate',
        payload: { email: email, password: password }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат входу:', result);
      btn.disabled = false;
      btn.textContent = '🔵 Увійти';

      if (result.success) {
        localStorage.setItem('user_email', result.email);
        localStorage.setItem('user_name', result.name);
        localStorage.setItem('user_role', result.role);

        // ВСТАНОВЛЮЮ ДАНІ НА ФОРМІ ОДРАЗУ
        document.getElementById('userName').textContent = `👤 ${result.name}`;
        if (result.role === 'Admin') {
          document.getElementById('userRole').textContent = '👨‍💼 Admin';
        } else if (result.role === 'Manager') {
          document.getElementById('userRole').textContent = '📊 Manager';
        } else {
          document.getElementById('userRole').textContent = result.role;
        }

        // (Секція Менеджери видалена)

        showLoginAlert('✅ Успішно! Завантажаю...', 'success');

        setTimeout(() => {
          document.getElementById('loginScreen').style.display = 'none';
          currentUser = result;
          loadData();
        }, 1000);
      } else {
        showLoginAlert('❌ ' + result.error, 'danger');
      }
    })
    .catch(e => {
      console.error('Помилка:', e);
      btn.disabled = false;
      btn.textContent = '🔵 Увійти';
      showLoginAlert('❌ Помилка: ' + e.message, 'danger');
    });
  }

  function showLoginAlert(msg, type) {
    const alert = document.getElementById('loginAlert');
    alert.textContent = msg;
    alert.style.display = 'block';
    
    if (type === 'success') {
      alert.style.background = '#E2F0D9';
      alert.style.color = '#00B050';
    } else {
      alert.style.background = '#FFE6E6';
      alert.style.color = '#CC0000';
    }
  }

  // ========== ІНІЦІАЛІЗАЦІЯ ==========
  window.addEventListener('load', function() {
    const email = localStorage.getItem('user_email');
    const name = localStorage.getItem('user_name');
    const role = localStorage.getItem('user_role');

    if (email && name && role) {
      // Уже залогінений
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('userName').textContent = `👤 ${name}`;
      
      // Встановлюю текст ролі з емодзі
      if (role === 'Admin') {
        document.getElementById('userRole').textContent = '👨‍💼 Admin';
      } else if (role === 'Manager') {
        document.getElementById('userRole').textContent = '📊 Manager';
      } else {
        document.getElementById('userRole').textContent = role;
      }
      
      currentUser = { email, name, role };
      
      // Встановлюю заголовки залежно від ролі
      if (role === 'Manager') {
        document.getElementById('dashboardTitle').textContent = '📊 Дашборд';
        document.getElementById('leadsTitle').textContent = '📋 Мої ліди';
      } else if (role === 'Admin') {
        document.getElementById('dashboardTitle').textContent = '📊 Дашборд';
        document.getElementById('leadsTitle').textContent = '📋 Всі ліди';
      }
      
      // Якщо менеджер - скрити поле вибору менеджера
      if (role === 'Manager') {
        const managerGroup = document.getElementById('managerGroup');
        if (managerGroup) {
          managerGroup.style.display = 'none';
        }
      }

      loadData();
    } else {
      // Показати форму входу
      document.getElementById('loginScreen').style.display = 'flex';
    }
  });

  // ========== ЗАВАНТАЖЕННЯ ДАНИХ ==========
  function loadData() {
    const role = localStorage.getItem('user_role');
    
    // ⭐ КНОПКА МЕНЕД ВИДИМА ТІЛЬКИ ДЛЯ ADMIN
    const adminMenuBtn = document.getElementById('adminMenuBtn');
    if (adminMenuBtn) {
      adminMenuBtn.style.display = role === 'Admin' ? 'block' : 'none';
    }
    
    // ⭐ АДМІН ПАНЕЛЬ ЗАВЖДИ СКРИТА ПРИ ЗАВАНТАЖЕННІ
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) {
      adminPanel.style.display = 'none'; // СКРИТА ЗА ЗАМОВЧУВАННЯМ
      if (role === 'Admin') {
        loadAdminManagersList();
      }
    }
    
    loadLeads();
    loadStats();
    loadManagers();
    loadColumnSettings();
    
    // ⭐ Завантажую бейджики нових лідів для всіх вкладок
    loadTabBadges();
    
    // ⭐ ЗА ЗАМОВЧУВАННЯМ ДАШБОРД ЗГОРНУТИЙ (з затримкою на ініціалізацію DOM)
    setTimeout(() => {
      const dashboardContent = document.getElementById('dashboardContent');
      const toggleBtn = document.getElementById('toggleDashboard');

      // ⭐ Завжди згортаємо дашборд при завантаженні
      if (dashboardContent && toggleBtn) {
        dashboardContent.classList.add('collapsed');
        toggleBtn.textContent = '+';
        document.body.classList.add('dashboard-collapsed');
      }
    }, 800);
  }

  // ⭐ Допоміжна функція — чи в режимі оренди
  function isRentMode() {
    return RENT_TYPES.includes(currentDashboardType) || currentDashboardType === 'Оренда';
  }

  function loadLeads() {
    const manager = localStorage.getItem('user_name');
    const role = localStorage.getItem('user_role');

    console.log('Завантажаю ліди для:', manager, 'Роль:', role, 'Тип:', currentDashboardType);

    const isRent = isRentMode();
    const isMortgage = currentDashboardType === 'Іпотека';
    const cache = isMortgage ? cachedMortgageLeads : (isRent ? cachedRentLeads : cachedRealtyLeads);

    // ⭐ Якщо є кеш — фільтруємо локально (миттєво)
    if (cache) {
      console.log('⚡ Використовую кеш! Всього в кеші:', cache.length);
      if (currentDashboardType === 'Оренда') {
        allLeads = cache.filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
      } else if (isMortgage) {
        allLeads = cache.filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
      } else {
        allLeads = cache.filter(lead => lead.type === currentDashboardType && lead.deletedStatus !== 'ВИДАЛЕНО');
      }
      console.log('Після фільтрації:', allLeads.length, 'типу:', currentDashboardType);
      renderLeads(allLeads);
      populateFilters();
      return;
    }

    // ⭐ Очищаю таблицю і показую спінер поки дані завантажуються
    const tbody = document.getElementById('leadsTable');
    const thead = document.getElementById('leadsTableHead');
    thead.innerHTML = '';
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; padding: 40px;">
          <div style="display: inline-block; width: 36px; height: 36px; border: 4px solid #e0e0e0; border-top-color: #4472C4; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div style="margin-top: 12px; color: #888; font-size: 0.9rem;">⏳ Завантаження лідів...</div>
        </td>
      </tr>
    `;

    // ⭐ Один запит — всі ліди скрипта без фільтра по типу
    const payload = { manager: manager, userRole: role };
    if (isMortgage) payload.sheetType = 'Іпотека';

    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'getAllLeadsNoFilter',
        payload: payload
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат:', result);
      if (result.success) {
        const allFetched = result.leads || [];
        console.log('Завантажено всього:', allFetched.length, '(всі типи)');

        // ⭐ Зберігаю в кеш
        if (isMortgage) {
          cachedMortgageLeads = allFetched;
        } else if (isRent) {
          cachedRentLeads = allFetched;
        } else {
          cachedRealtyLeads = allFetched;
        }

        // Фільтрую по поточному типу
        if (currentDashboardType === 'Оренда' || isMortgage) {
          allLeads = allFetched.filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
        } else {
          allLeads = allFetched.filter(lead => lead.type === currentDashboardType && lead.deletedStatus !== 'ВИДАЛЕНО');
        }
        console.log('Після фільтрації:', allLeads.length, 'типу:', currentDashboardType);
        renderLeads(allLeads);
        populateFilters();
      } else {
        console.error('Помилка:', result.error);
        document.getElementById('leadsTable').innerHTML = `<tr><td colspan="7" style="text-align: center;">❌ ${result.error}</td></tr>`;
      }
    })
    .catch(e => {
      console.error('Помилка мережі:', e);
      document.getElementById('leadsTable').innerHTML = `<tr><td colspan="7" style="text-align: center;">❌ Помилка: ${e.message}</td></tr>`;
    });
  }

  function loadStats() {
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');

    // Для режиму "Всі" оренди — дашборд без статистики
    if (currentDashboardType === 'Оренда') {
      const grid = document.getElementById('dashboardGrid');
      if (grid) grid.innerHTML = '<div style="text-align:center; color:#888; padding:1rem;">Оберіть конкретний тип оренди для перегляду статистики</div>';
      document.getElementById('totalLeads').textContent = '-';
      document.getElementById('totalBudget').textContent = '-';
      return;
    }

    console.log('loadStats: role=' + userRole + ', name=' + userName + ', type=' + currentDashboardType);

    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'getStats',
        payload: {
          userRole: userRole,
          userName: userName,
          type: currentDashboardType
        }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат getStats:', result);
      
      if (result.success) {
        renderDashboard(result.stats);
      } else {
        console.error('Помилка getStats:', result.error);
      }
    })
    .catch(e => {
      console.error('Помилка при завантаженні статистики:', e);
    });
  }

  // ⭐ НОВОЕ: Пересчет дашборда з фільтрацією по вибраним менеджерам (ЛОКАЛЬНО без API)
  function loadStatsFiltered() {
    console.log('loadStatsFiltered: Пересчитываю дашборд для менеджеров:', selectedManagers);
    
    if (!allLeads || allLeads.length === 0) {
      console.warn('⚠️ allLeads пустой');
      return;
    }
    
    // ⭐ Фільтрую ліди по вибраним менеджерам (підтримка мульти-менеджер)
    let filteredLeads = allLeads.filter(lead => {
      const leadManagerStr = lead.manager || 'Не назначено';
      const leadMgrs = leadManagerStr.split(',').map(s => s.trim());
      return leadMgrs.some(m => selectedManagers.includes(m));
    });
    
    console.log(`📊 Фільтровано лідів: ${filteredLeads.length} з ${allLeads.length}`);
    
    // Рахую статистику для фільтрованих лідів
    const stageNames = {
      'Етап_1_Контакт': 'Етап 1: Контакт',
      'Етап_2_Кваліфікація': 'Етап 2: Кваліфікація',
      'Етап_3_Підбір': 'Етап 3: Підбір',
      'Етап_4_Покази': 'Етап 4: Покази',
      'Етап_5_Намір': 'Етап 5: Намір',
      'Етап_6_Arras': 'Етап 6: Arras',
      'Етап_7_Юрист': 'Етап 7: Юрист',
      'Етап_8_Нотаріус': 'Етап 8: Нотаріус',
      'Етап_9_Після': 'Етап 9: Після'
    };
    
    // Ініціалізую статистику
    const stats = { stages: {}, totalCount: 0, totalSum: 0 };
    
    // Ініціалізую кожний етап
    Object.keys(stageNames).forEach(key => {
      stats.stages[key] = {
        name: stageNames[key],
        count: 0,
        sum: 0,
        avgBudget: 0,
        percentSum: 0,
        percentLeads: 0,
        newToday: 0
      };
    });
    
    // Проходжу по фільтрованих лідах и рахую
    filteredLeads.forEach(lead => {
      const stageKey = lead.stage || 'Етап_1_Контакт';
      const budget = parseBudget(lead.budget);
      
      if (stats.stages[stageKey]) {
        stats.stages[stageKey].count++;
        stats.stages[stageKey].sum += budget;
      }
      
      stats.totalCount++;
      stats.totalSum += budget;
    });
    
    // Рахую середнє і проценти
    Object.keys(stats.stages).forEach(key => {
      const stage = stats.stages[key];
      stage.avgBudget = stage.count > 0 ? Math.round(stage.sum / stage.count) : 0;
      stage.percentSum = stats.totalSum > 0 ? Math.round((stage.sum / stats.totalSum) * 100) : 0;
      stage.percentLeads = stats.totalCount > 0 ? Math.round((stage.count / stats.totalCount) * 100) : 0;
    });
    
    console.log('📊 Розраховані статистики:', stats);
    
    // Рендерую дашборд з новой статистикой
    renderDashboard(stats);
  }

  function loadManagers() {
    console.log('Завантажаю менеджерів...');
    
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат менеджерів:', result);
      
      if (result.success && result.users) {
        // Фільтруємо тільки менеджерів
        managers = result.users
          .filter(u => u.role === 'Manager' || u.role === 'Admin')
          .map(u => u.name)
          .filter(name => name && name.trim() !== '');
        
        console.log('Менеджери завантажені:', managers);
        
        // Заповнюю селект одразу
        fillManagerSelect();
        
        // ⭐ НОВОЕ: Ініціалізую чекбокси менеджерів для дашборда
        initManagerCheckboxes();
      } else {
        console.error('Помилка:', result.error);
        // Якщо помилка - використовуй запасний варіант
        console.log('Запасний варіант...');
      }
    })
    .catch(e => {
      console.error('Помилка завантаження менеджерів:', e);
    });
  }

  function fillManagerSelect() {
    const managerSelect = document.getElementById('manager');
    const role = localStorage.getItem('user_role');
    const userName = localStorage.getItem('user_name');
    
    if (!managerSelect) return;
    
    managerSelect.innerHTML = '';
    
    const noneOption = document.createElement('option');
    noneOption.value = 'Не назначено';
    noneOption.textContent = '❌ Не назначено';
    managerSelect.appendChild(noneOption);
    
    if (role === 'Manager') {
      // Менеджер бачить тільки себе
      const option = document.createElement('option');
      option.value = userName;
      option.textContent = `👤 ${userName}`;
      managerSelect.appendChild(option);
      console.log('👤 Manager режим - показую тільки себе:', userName);
    } else if (role === 'Admin') {
      // Admin бачить ВСІх менеджерів
      let managersList = managers && managers.length > 0 ? [...managers] : [];
      
      // ⭐ РЕЗЕРВНИЙ ВАРІАНТ - БЕРУ З ТАБЛИЦІ ЛІДІВ
      if (managersList.length === 0 && allLeads && allLeads.length > 0) {
        console.log('⚠️ managers пустий - беру з allLeads');
        managersList = [...new Set(
          allLeads
            .map(l => l.manager)
            .filter(m => m && m !== 'Не назначено' && m.trim() !== '')
        )];
      }
      
      console.log('👥 Admin режим - Доступні менеджери:', managersList);
      
      if (managersList.length > 0) {
        managersList.forEach(m => {
          if (m && m.trim() !== '' && m !== 'Не назначено') {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = `👤 ${m}`;
            managerSelect.appendChild(option);
          }
        });
        console.log(`✅ Додано ${managersList.length} менеджерів у dropdown`);
      } else {
        console.warn('⚠️ Admin - менеджери не знайдені нікуди!');
      }
    }
    
    // ⭐ ДОДАЮ ОБРОБНИК ДЛЯ КНОПОК РЕДАГУВАННЯ
    document.querySelectorAll('.edit-lead-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        try {
          const leadIndex = parseInt(this.dataset.leadIndex);
          const lead = leadsCache[leadIndex];
          
          if (!lead) {
            throw new Error('Ліда не знайдено у кешу з індексом: ' + leadIndex);
          }
          
          openEditSidebarDirect(lead);
        } catch (err) {
          console.error('❌ Помилка при редагуванні ліда:', err);
          alert('❌ Помилка при відкритті редагування: ' + err.message);
        }
      });
    });
  }

  // ⭐ НОВОЕ: Ініціалізація чекбоксів менеджерів у дашборді
  function initManagerCheckboxes() {
    const container = document.getElementById('managerCheckboxes');
    if (!container) {
      console.warn('⚠️ managerCheckboxes контейнер не знайден');
      return;
    }
    
    if (!managers || managers.length === 0) {
      console.warn('⚠️ Менеджери не завантажені');
      container.innerHTML = '<div style="color: #999;">Менеджери не знайдені</div>';
      return;
    }
    
    console.log('✅ initManagerCheckboxes: Ініціалізую чекбокси для менеджерів:', managers);
    
    // ⭐ Створюю повний список: менеджери + "Не назначено"
    const allOptions = [...managers, 'Не назначено'];
    
    // Спочатку - встановлю ВСІх як вибраних (за замовчуванням)
    selectedManagers = [...allOptions];
    
    // Чистю контейнер
    container.innerHTML = '';
    
    // Додаю чекбокс "Всі"
    const allCheckboxDiv = document.createElement('div');
    allCheckboxDiv.style.display = 'flex';
    allCheckboxDiv.style.alignItems = 'center';
    allCheckboxDiv.style.gap = '0.5rem';
    
    const allCheckbox = document.createElement('input');
    allCheckbox.type = 'checkbox';
    allCheckbox.id = 'selectAllManagers';
    allCheckbox.checked = true;
    allCheckbox.style.cursor = 'pointer';
    allCheckbox.style.width = '18px';
    allCheckbox.style.height = '18px';
    
    allCheckbox.addEventListener('change', function() {
      const allCbs = document.querySelectorAll('.manager-dashboard-checkbox');
      if (this.checked) {
        // Вибрати всіх
        selectedManagers = [...allOptions];
        allCbs.forEach(cb => cb.checked = true);
      } else {
        // Вибрати нікого
        selectedManagers = [];
        allCbs.forEach(cb => cb.checked = false);
      }
      loadStatsFiltered();
      filterLeads();
    });
    
    const allLabel = document.createElement('label');
    allLabel.textContent = 'Всі';
    allLabel.style.cursor = 'pointer';
    allLabel.style.fontWeight = 'bold';
    allLabel.style.color = '#1F4E78';
    
    allCheckboxDiv.appendChild(allCheckbox);
    allCheckboxDiv.appendChild(allLabel);
    container.appendChild(allCheckboxDiv);
    
    // Додаю чекбокс для кожного менеджера + "Не назначено"
    allOptions.forEach(manager => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.style.display = 'flex';
      checkboxDiv.style.alignItems = 'center';
      checkboxDiv.style.gap = '0.5rem';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'manager-dashboard-checkbox';
      checkbox.value = manager;
      checkbox.checked = true;
      checkbox.style.cursor = 'pointer';
      checkbox.style.width = '18px';
      checkbox.style.height = '18px';
      
      checkbox.addEventListener('change', function() {
        if (this.checked) {
          if (!selectedManagers.includes(manager)) {
            selectedManagers.push(manager);
          }
        } else {
          selectedManagers = selectedManagers.filter(m => m !== manager);
        }
        
        // ⭐ Оновлюю стан "Всі" чекбокса
        const allCb = document.getElementById('selectAllManagers');
        if (allCb) {
          allCb.checked = selectedManagers.length === allOptions.length;
        }
        
        loadStatsFiltered();
        filterLeads();
      });
      
      const label = document.createElement('label');
      label.textContent = manager === 'Не назначено' ? '❌ Не назначено' : `👤 ${manager}`;
      label.style.cursor = 'pointer';
      label.style.color = manager === 'Не назначено' ? '#999' : '#333';
      
      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(label);
      container.appendChild(checkboxDiv);
    });
    
    console.log('✅ Чекбокси менеджерів ініціалізовані (включно з "Не назначено")');
  }

  // ========== ДИНАМІЧНІ ПОЛЯ ФОРМИ ==========
  function updateFormFields() {
    const typeInput = document.getElementById('type').value;
    const metaTypeInput = document.getElementById('metaType');
    const metaTypeList = document.getElementById('metaTypeList');
    
    // Очищаю знімність типу від смайликів
    let type = typeInput.replace(/🏡|🏠/g, '').trim();
    
    // При Купівлі
    if (type.includes('Купівля')) {
      // Показую "Мета" для Купівлі
      metaTypeInput.placeholder = 'для проживання, для інвестиції...';
      metaTypeInput.value = ''; // Очищаю попередне значення щоб datalist показався
      
      // Динамічно оновляю datalist для Мета
      metaTypeList.innerHTML = `
        <option value="для проживання">
        <option value="для інвестиції">
      `;
    } 
    // При Продажу
    else if (type.includes('Продаж')) {
      // Показую "Тип об'єкту" для Продажу
      metaTypeInput.placeholder = 'квартира, будинок, земля...';
      metaTypeInput.value = ''; // Очищаю щоб datalist показався
      
      // Динамічно оновляю datalist для Типу об'єкту
      metaTypeList.innerHTML = `
        <option value="квартира">
        <option value="будинок">
        <option value="земля">
        <option value="комерційна">
        <option value="інша">
      `;
    }
  }

  // Автоматичне додавання м² до площі
  function formatArea() {
    const areaInput = document.getElementById('area');
    let value = areaInput.value.trim();
    
    // Якщо тільки цифри - додай м²
    if (value && /^\d+$/.test(value)) {
      areaInput.value = value + ' м²';
    }
  }

  // ========== РЕНДЕРИНГ ==========
  function renderDashboard(stats) {
    const grid = document.getElementById('dashboardGrid');
    const totalLeads = document.getElementById('totalLeads');
    const totalBudget = document.getElementById('totalBudget');
    
    // Форматування сокращено (50000 -> 50k)
    function formatShort(amount) {
      if (amount >= 1000000) return Math.round(amount / 1000000) + 'M';
      if (amount >= 1000) return Math.round(amount / 1000) + 'k';
      return amount;
    }

    // Встановлюю загальну інформацію
    totalLeads.textContent = stats.totalCount + ' лідів';
    totalBudget.textContent = formatShort(stats.totalSum) + '€';

    // Рендерю 9 клікабельних строк
    let html = '';
    Object.entries(stats.stages).forEach(([stageKey, stageData]) => {
      const stageName = stageData.name;
      const count = stageData.count;
      const sum = stageData.sum;
      const avgBudget = stageData.avgBudget || 0;
      const percentSum = stageData.percentSum || 0;
      const percentLeads = stageData.percentLeads || 0;
      const newToday = stageData.newToday || 0;

      // Динаміка: показує новичків за день
      let dynamics = '';
      if (newToday > 0) {
        dynamics = ` <span style="color: #FF6B6B; font-weight: bold;">🔥+${newToday}</span>`;
      }

      html += `
        <div class="dashboard-card" onclick="filterByStage('${stageKey}', '${stageName}')" title="Кліка щоб побачити всі ліди на цьому етапі" style="border: ${selectedStage === stageKey ? '3px solid #4472C4' : '1px solid #ddd'}; background: ${selectedStage === stageKey ? '#E7F0F8' : 'white'}; cursor: pointer;">
          <div class="dashboard-card-title">${stageName}${dynamics}</div>
          <div style="display: grid; grid-template-columns: auto auto auto auto auto; gap: 1.5rem; align-items: center; font-size: 0.9rem;">
            <!-- Кількість -->
            <div style="text-align: center; border-right: 1px solid #eee; padding-right: 1rem;">
              <div style="color: #4472C4; font-weight: bold; font-size: 1rem;">${count}л</div>
              <div style="font-size: 0.7rem; color: #999;">ліди</div>
            </div>
            <!-- Сума -->
            <div style="text-align: center; border-right: 1px solid #eee; padding-right: 1rem;">
              <div style="color: #00B050; font-weight: bold; font-size: 1rem;">${formatShort(sum)}€</div>
              <div style="font-size: 0.7rem; color: #999;">сума</div>
            </div>
            <!-- Середнє -->
            <div style="text-align: center; border-right: 1px solid #eee; padding-right: 1rem;">
              <div style="color: #FF8C00; font-weight: bold; font-size: 1rem;">${formatShort(avgBudget)}€</div>
              <div style="font-size: 0.7rem; color: #999;">сер/л</div>
            </div>
            <!-- % від суми -->
            <div style="text-align: center; border-right: 1px solid #eee; padding-right: 1rem;">
              <div style="color: #7030A0; font-weight: bold; font-size: 1rem;">${percentSum}%</div>
              <div style="font-size: 0.7rem; color: #999;">% суми</div>
            </div>
            <!-- Конверсія -->
            <div style="text-align: center;">
              <div style="color: #4472C4; font-weight: bold; font-size: 1rem;">${percentLeads}%</div>
              <div style="font-size: 0.7rem; color: #999;">конв</div>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }


  function filterByStage(stageKey, stageName) {
    // ⭐ Зберігаю вибраний етап
    selectedStage = stageKey;
    
    // ⭐ Очищаю усі інші фільтри щоб показати тільки цей етап
    const stageCheckboxes = document.querySelectorAll('.stage-checkbox');
    stageCheckboxes.forEach(cb => cb.checked = false);
    
    // ⭐ Вмикаю тільки обраний етап
    const selectedCheckbox = document.querySelector(`.stage-checkbox[value="${stageKey}"]`);
    if (selectedCheckbox) {
      selectedCheckbox.checked = true;
    }
    
    // ⭐ Фільтрую ліди
    filterLeads();
    
    // ⭐ Скролю до таблиці
    setTimeout(() => {
      document.getElementById('leadsTable').scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function clearStageFilter() {
    selectedStage = null;
    const stageCheckboxes = document.querySelectorAll('.stage-checkbox');
    stageCheckboxes.forEach(cb => cb.checked = false);
    filterLeads();
  }

  // ⭐ ФУНКЦІЯ СКИДАННЯ ВСІХ ФІЛЬТРІВ
  function clearAllFilters() {
    // Скидаю пошук
    document.getElementById('searchInput').value = '';
    
    // Скидаю всі checkboxes (менеджери, етапи, бюджет, статуси, джерела)
    document.querySelectorAll('.manager-checkbox, .stage-checkbox, .budget-checkbox, .status-checkbox, .source-checkbox').forEach(cb => {
      cb.checked = false;
    });
    
    // Скидаю вибраний етап
    selectedStage = null;
    
    // Видаляю тегі фільтрів
    document.querySelectorAll('.filter-tag').forEach(tag => tag.remove());
    
    // Фільтрую ліди (показує всіх)
    filterLeads();
    
    // Скролю вгору до таблиці
    document.getElementById('leadsTitle').scrollIntoView({ behavior: 'smooth' });
  }

  function toggleDashboard() {
    const content = document.getElementById('dashboardContent');
    const btn = document.getElementById('toggleDashboard');

    if (!content || !btn) {
      console.warn('⚠️ Дашборд елементи не знайдені');
      return;
    }

    if (content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      btn.textContent = '−';
      document.body.classList.remove('dashboard-collapsed');
    } else {
      content.classList.add('collapsed');
      btn.textContent = '+';
      document.body.classList.add('dashboard-collapsed');
    }
  }

  function toggleManagers() {
    const content = document.getElementById('managersContent');
    const btn = document.getElementById('toggleManagers');

    if (!content || !btn) return;

    if (content.style.display === 'none') {
      content.style.display = 'block';
      btn.textContent = '−';
    } else {
      content.style.display = 'none';
      btn.textContent = '+';
    }
  }

  function selectDashboard(type) {
    console.log('selectDashboard called with type:', type);
    
    // Оновлюю активну кнопку
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.remove('type-btn-active');
    });
    document.getElementById('typeBtn-' + type).classList.add('type-btn-active');
    
    // Встановлюю тип
    currentDashboardType = type;
    
    // Заголовок дашборду не змінюємо — завжди "Дашборд"

    // Оновлюю заголовок таблиці
    const leadsEmoji = type === 'Купівля' ? '🏢' : '🏠';
    document.getElementById('leadsTitle').textContent = `📋 Ліди (${leadsEmoji} ${type})`;
    
    // Розгортаю дашборд
    const content = document.getElementById('dashboardContent');
    if (content && content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      document.getElementById('toggleDashboard').textContent = '−';
    }
    
    // Завантажу нові дані
    loadStats();
    loadLeads();
  }

  // Функція для оновлення поля вручну введеного бюджету
  function updateBudgetInput() {
    const select = document.getElementById('editBudgetSelect');
    const manual = document.getElementById('editBudgetManual');
    const hidden = document.getElementById('editBudget');
    
    if (select.value === 'custom') {
      manual.style.display = 'block';
      manual.focus();
    } else {
      manual.style.display = 'none';
      hidden.value = select.value;
    }
  }

  // Функція для обновлення бюджету при вручному введенні
  document.addEventListener('input', function(e) {
    if (e.target.id === 'editBudgetManual') {
      document.getElementById('editBudget').value = e.target.value;
    }
  });


  // ⭐ ФУНКЦІЯ ДЛЯ РЕДАГУВАННЯ ЛІДА ПРЯМО З ТАБЛИЦІ (БЕЗ API ЗАПИТУ)
  function openEditSidebarDirect(lead) {
    try {
      // Не робимо API запит - використовуємо переданий об'єкт напряму!
      openEditSidebar(lead);
    } catch (e) {
      console.error('❌ Помилка в openEditSidebarDirect:', e);
      alert('❌ Помилка при відкритті форми редагування');
    }
  }

  function openEditSidebarFromButton(leadId, leadPhone) {
    try {
      // Загружаем данные ліда через API з ID та Phone для унікальності
      fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getLeadById',
          payload: { leadId: leadId, phone: leadPhone }
        })
      })
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const lead = result.lead;
          openEditSidebar(lead);
        } else {
          alert('❌ Помилка загрузки ліда: ' + result.error);
        }
      })
      .catch(e => {
        console.error('❌ Помилка мережі:', e);
        alert('❌ Помилка при завантаженні ліда');
      });
    } catch (e) {
      console.error('❌ Помилка в openEditSidebarFromButton:', e);
      alert('❌ Помилка при відкритті форми редагування');
    }
  }

  // ⭐ МУЛЬТИ-МЕНЕДЖЕР: хелпери для checkbox-вибору кількох менеджерів
  function renderManagerCheckboxes(selectId, managersList, currentManagerStr) {
    const select = document.getElementById(selectId);
    select.style.display = 'none';

    let container = document.getElementById(selectId + 'Checkboxes');
    if (!container) {
      container = document.createElement('div');
      container.id = selectId + 'Checkboxes';
      select.parentNode.insertBefore(container, select.nextSibling);
    }

    const selected = (currentManagerStr || '').split(',').map(s => s.trim()).filter(s => s && s !== 'Не назначено');

    let html = '<div id="' + selectId + 'Summary" style="font-size: 0.85rem; color: #4472C4; margin-bottom: 0.3rem; font-weight: bold;">' +
      (selected.length > 0 ? '✅ Вибрано: ' + selected.join(', ') : '❌ Не вибрано') + '</div>';
    html += '<div style="border: 1px solid #ddd; border-radius: 4px; padding: 0.5rem; max-height: 150px; overflow-y: auto; background: white;">';
    managersList.forEach(m => {
      const isChecked = selected.includes(m);
      const bg = isChecked ? 'background: #e8f0fe;' : '';
      html += '<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.3rem; cursor: pointer; font-size: 0.9rem; border-radius: 4px; ' + bg + '" onclick="setTimeout(function(){ updateManagerSummary(\'' + selectId + '\'); }, 50)">' +
        '<input type="checkbox" class="mgr-multi" value="' + m + '" ' + (isChecked ? 'checked' : '') + ' style="width: 18px; height: 18px; accent-color: #4472C4;">' +
        '<span>' + (isChecked ? '👤 <b>' + m + '</b>' : '👤 ' + m) + '</span></label>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function updateManagerSummary(selectId) {
    const container = document.getElementById(selectId + 'Checkboxes');
    if (!container) return;
    const checked = container.querySelectorAll('.mgr-multi:checked');
    const names = Array.from(checked).map(cb => cb.value);
    const summary = document.getElementById(selectId + 'Summary');
    if (summary) {
      summary.innerHTML = names.length > 0 ? '✅ Вибрано: ' + names.join(', ') : '❌ Не вибрано';
    }
    // Оновлюю підсвітку
    container.querySelectorAll('label').forEach(label => {
      const cb = label.querySelector('.mgr-multi');
      if (cb) {
        label.style.background = cb.checked ? '#e8f0fe' : '';
        const span = label.querySelector('span');
        if (span) span.innerHTML = cb.checked ? '👤 <b>' + cb.value + '</b>' : '👤 ' + cb.value;
      }
    });
  }

  function getSelectedManagersValue(selectId) {
    const container = document.getElementById(selectId + 'Checkboxes');
    if (!container) return document.getElementById(selectId).value || 'Не назначено';
    const checked = container.querySelectorAll('.mgr-multi:checked');
    const names = Array.from(checked).map(cb => cb.value);
    return names.length > 0 ? names.join(', ') : 'Не назначено';
  }

  // ⭐ ФУНКЦІЯ ДЛЯ ОНОВЛЕННЯ МЕТА/ТИП В ЗАЛЕЖНОСТІ ВІД ТИПУ
  function openEditSidebar(lead) {
    console.log('📝 openEditSidebar: Відкриваю редагування ліда:', lead);
    console.log('📝 lead.id =', lead.id, ', lead.rowIndex =', lead.rowIndex);
    
    document.getElementById('sidebarLeadId').value = lead.id || '';
    document.getElementById('sidebarLeadId_display').value = lead.id || '';
    document.getElementById('sidebarRowIndex').value = lead.rowIndex || ''; // ⭐ Зберігаю rowIndex
    document.getElementById('sidebarPhone').value = lead.phone || '';
    document.getElementById('sidebarFullName').value = lead.fullName || '';
    document.getElementById('sidebarSource').value = lead.source || '';
    document.getElementById('sidebarLanguage').value = lead.language || '';
    document.getElementById('sidebarType').value = lead.type || '';
    document.getElementById('sidebarBudget').value = lead.budget || '';
    document.getElementById('sidebarDistrict').value = lead.district || '';
    document.getElementById('sidebarArea').value = lead.area || '';
    document.getElementById('sidebarRooms').value = lead.rooms || '';
    document.getElementById('sidebarManager').value = lead.manager || 'Не назначено';
    document.getElementById('sidebarStage').value = lead.stage || 'Етап_1_Контакт';
    
    // ✅ КОНВЕРТУЮ ДАТУ В yyyy-MM-dd (без UTC-зсуву)
    document.getElementById('sidebarNextContact').value = dateToInputValue(lead.nextContact);
    
    // ⭐ ЗАПОВНЮЮ СТАТУС З ДАНИХ ЛІДІВ (формула из таблицы)
    document.getElementById('sidebarStatus').value = lead.status || '';
    
    document.getElementById('sidebarNextAction').value = lead.nextAction || '';
    document.getElementById('sidebarComment').value = lead.comment || '';
    
    // ⭐ МУЛЬТИ-МЕНЕДЖЕР: заповнюю checkbox-ами замість dropdown
    let managersList = managers && managers.length > 0 ? [...managers] : [];

    if (managersList.length === 0 && allLeads && allLeads.length > 0) {
      managersList = [...new Set(
        allLeads.map(l => l.manager).filter(m => m && m !== 'Не назначено' && m.trim() !== '')
          .flatMap(m => m.split(',').map(s => s.trim()))
      )];
    }

    if (managersList.length === 0) {
      fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getAllUsers', payload: {} })
      })
      .then(r => r.json())
      .then(result => {
        if (result.success && result.users) {
          const apiManagers = result.users
            .filter(u => u.role === 'Manager' || u.role === 'Admin')
            .map(u => u.name)
            .filter(name => name && name.trim() !== '');
          renderManagerCheckboxes('sidebarManager', apiManagers, lead.manager);
        }
      })
      .catch(e => console.error('❌ Помилка завантаження менеджерів:', e));
    } else {
      renderManagerCheckboxes('sidebarManager', managersList, lead.manager);
    }
    
    // Заповнюю Мета/тип
    document.getElementById('sidebarMetaType').value = lead.metaType || '';
    
    // Показую sidebar
    const sidebar = document.getElementById('editSidebar');
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    const sidebar = document.getElementById('editSidebar');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }

  // ===== ФУНКЦИИ ДЛЯ НОВИХ САЙДБАРІВ =====
  
  function openAddLeadSidebar() {
    // ⭐ Якщо це тип Оренди — відкриваю сайдбар оренди
    if (isRentMode()) {
      openAddRentLeadSidebar();
      return;
    }
    // ⭐ Якщо Іпотека — окремий сайдбар
    if (currentDashboardType === 'Іпотека') {
      openAddMortgageLeadSidebar();
      return;
    }

    const sidebar = document.getElementById('addLeadSidebar');
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }
  
  function closeAddLeadSidebar() {
    const sidebar = document.getElementById('addLeadSidebar');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }
  
  // ⭐ ФУНКЦІЇ ДЛЯ САЙДБАРУ ДОДАВАННЯ ОРЕНДИ
  function openAddRentLeadSidebar() {
    const sidebar = document.getElementById('addRentLeadSidebar');

    // Встановлюю поточний тип оренди (якщо "Всі" — ставлю Подобова за замовчуванням)
    const rentType = currentDashboardType === 'Оренда' ? 'Подобова' : currentDashboardType;
    document.getElementById('addRentType').value = rentType;
    
    // Завантажую менеджерів
    loadRentManagersForAdd();
    
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }
  
  function closeAddRentLeadSidebar() {
    const sidebar = document.getElementById('addRentLeadSidebar');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }
  
  function loadRentManagersForAdd() {
    const select = document.getElementById('addRentManager');
    
    // ⭐ Беру менеджерів з таблиці Нерухомість → доступи
    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success && result.users) {
        const rentManagers = result.users
          .filter(u => u.role === 'Manager' || u.role === 'Admin')
          .map(u => u.name)
          .filter(name => name && name.trim() !== '');
        
        select.innerHTML = '<option value="">-- Виберіть --</option><option value="Не назначено">❌ Не назначено</option>';
        rentManagers.forEach(name => {
          select.innerHTML += `<option value="${name}">👤 ${name}</option>`;
        });
      }
    })
    .catch(e => {
      console.error('Помилка завантаження менеджерів:', e);
    });
  }
  
  function handleAddRentLead(e) {
    e.preventDefault();
    
    const data = {
      fullName: document.getElementById('addRentFullName').value,
      phone: document.getElementById('addRentPhone').value,
      source: document.getElementById('addRentSource').value,
      language: document.getElementById('addRentLanguage').value || 'Українська',
      type: document.getElementById('addRentType').value,
      manager: document.getElementById('addRentManager').value || 'Не назначено',
      budget: document.getElementById('addRentBudget').value,
      roomsCondition: document.getElementById('addRentRoomsCondition').value,
      petsFormat: document.getElementById('addRentPetsFormat').value,
      people: document.getElementById('addRentPeople').value,
      termType: document.getElementById('addRentTermType').value,
      dateSeason: document.getElementById('addRentDateSeason').value,
      district: document.getElementById('addRentDistrict').value,
      nextAction: document.getElementById('addRentNextAction').value,
      comment: document.getElementById('addRentComment').value,
      contactTime: document.getElementById('addRentContactTime').value,
      nextContact: document.getElementById('addRentNextContact').value
    };
    
    console.log('📝 handleAddRentLead:', data);
    
    showLoading('⏳ Додаю ліда...');
    
    fetch(SCRIPT_URL_RENT, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addLead',
        payload: data
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        const textEl = document.getElementById('loadingText');
        if (textEl) textEl.textContent = '🔄 Оновлюю таблицю...';
        
        closeAddRentLeadSidebar();
        
        const form = document.querySelector('#addRentLeadSidebar form');
        if (form) form.reset();
        
        loadDataWithCallback(() => {
          showSuccess('✅ Ліда додано!');
        });
      } else {
        showError('❌ ' + (result.error || 'Помилка'));
      }
    })
    .catch(e => {
      showError('❌ Помилка: ' + e.message);
    });
  }
  
  function openManagerSidebar() {
    const sidebar = document.getElementById('managerSidebar');
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
    
    // ⭐ ЗАВАНТАЖУЮ СПИСОК МЕНЕДЖЕРІВ
    loadAdminManagersList();
  }
  
  function closeManagerSidebar() {
    const sidebar = document.getElementById('managerSidebar');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }
  
  function openFiltersSidebar() {
    const sidebar = document.getElementById('filtersSidebar');
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }
  
  function closeFiltersSidebar() {
    const sidebar = document.getElementById('filtersSidebar');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }

  // ⭐ КАСТОМНЕ ПІДТВЕРДЖЕННЯ ВИДАЛЕННЯ
  function confirmDeleteLead(leadId) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmDeleteModal');
      document.getElementById('confirmDeleteText').textContent = 'Лід #' + leadId + ' буде позначений як ВИДАЛЕНО';
      modal.classList.add('active');

      const ok = document.getElementById('confirmDeleteOk');
      const cancel = document.getElementById('confirmDeleteCancel');

      function cleanup() {
        modal.classList.remove('active');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
      }
      function onOk() { cleanup(); resolve(true); }
      function onCancel() { cleanup(); resolve(false); }

      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
    });
  }

  // ⭐ М'ЯКЕ ВИДАЛЕННЯ ЛІДА
  function handleSoftDelete(leadId, rowIndex) {
    showLoading('⏳ Видаляю ліда...');
    
    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'softDeleteLead',
        payload: { leadId: leadId, rowIndex: rowIndex ? parseInt(rowIndex) : null, type: currentDashboardType }
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        // Скидаю кеш
        if (currentDashboardType === 'Іпотека') { cachedMortgageLeads = null; }
        else if (isRentMode()) { cachedRentLeads = null; }
        else { cachedRealtyLeads = null; }

        loadLeadsWithCallback(() => {
          showSuccess('✅ Ліда видалено!');
        });
      } else {
        showError('❌ ' + (result.error || 'Помилка видалення'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      showError('❌ Помилка мережі: ' + e.message);
    });
  }

  function handleSidebarEditLead(event) {
    event.preventDefault();
    
    const leadId = document.getElementById('sidebarLeadId').value;
    const phone = document.getElementById('sidebarPhone').value;
    const rowIndex = document.getElementById('sidebarRowIndex').value;
    
    console.log('🔧 handleSidebarEditLead: leadId =', leadId, ', phone =', phone, ', rowIndex =', rowIndex);
    
    if (!leadId) {
      alert('❌ ID ліда не знайден');
      return;
    }
    
    const updateData = {
      leadId: leadId,
      rowIndex: rowIndex ? parseInt(rowIndex) : null,
      phone: phone,
      id: document.getElementById('sidebarLeadId_display').value,
      fullName: document.getElementById('sidebarFullName').value,
      source: document.getElementById('sidebarSource').value,
      language: document.getElementById('sidebarLanguage').value,
      type: document.getElementById('sidebarType').value,
      manager: getSelectedManagersValue('sidebarManager'),
      stage: document.getElementById('sidebarStage').value,
      nextContact: document.getElementById('sidebarNextContact').value,
      budget: document.getElementById('sidebarBudget').value,
      district: document.getElementById('sidebarDistrict').value,
      metaType: document.getElementById('sidebarMetaType').value,
      area: document.getElementById('sidebarArea').value,
      rooms: document.getElementById('sidebarRooms').value,
      nextAction: document.getElementById('sidebarNextAction').value,
      comment: document.getElementById('sidebarComment').value
    };
    
    console.log('🔧 updateData:', updateData);
    
    // ⭐ ПОКАЗУЮ OVERLAY ЗАВАНТАЖЕННЯ
    showLoading('⏳ Зберігаю дані...');
    
    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateLead',
        payload: updateData
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('🔧 updateLead result:', result);
      if (result.success) {
        // ⭐ Змінюю текст але залишаю спінер
        const textEl = document.getElementById('loadingText');
        if (textEl) textEl.textContent = '🔄 Оновлюю таблицю...';
        
        closeSidebar();
        
        // ⭐ Завантажую ліди і ПОТІМ показую успіх
        loadLeadsWithCallback(() => {
          showSuccess('✅ Ліда оновлено!');
        });
      } else {
        // ⭐ ПОКАЗУЮ ПОМИЛКУ
        showError('❌ ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      showError('❌ Помилка мережі: ' + e.message);
    });
  }
  
  // ⭐ ФУНКЦІЯ ЗАВАНТАЖЕННЯ ЛІДІВ З CALLBACK (після додавання/редагування)
  function loadLeadsWithCallback(callback) {
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    const type = currentDashboardType;

    // ⭐ Скидаю кеш — дані змінилися
    if (type === 'Іпотека') {
      cachedMortgageLeads = null;
    } else if (isRentMode()) {
      cachedRentLeads = null;
    } else {
      cachedRealtyLeads = null;
    }

    // Для режиму "Всі" оренди — використовую loadLeads
    if (type === 'Оренда') {
      loadLeads();
      if (callback) callback();
      return;
    }

    console.log('Завантажую ліди для:', name, 'Роль:', role, 'Тип:', type);

    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: role === 'Admin' ? 'getAllLeads' : 'getLeads',
        payload: role === 'Admin' ? { type: type } : { manager: name, type: type }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат:', result);
      if (result.success) {
        allLeads = (result.leads || []).filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
        console.log('Ліди завантажені:', allLeads.length, 'типу:', type);
        renderLeads(allLeads);
        populateFilters(allLeads);
      }
      if (callback) callback();
    })
    .catch(e => {
      console.error('❌ Помилка завантаження:', e);
      if (callback) callback();
    });
  }

  function renderLeads(leads) {
    // ⭐ Якщо це тип Оренди — використовую окрему функцію
    if (isRentMode()) {
      renderRentLeads(leads);
      return;
    }
    // ⭐ Якщо Іпотека — окрема функція
    if (currentDashboardType === 'Іпотека') {
      renderMortgageLeads(leads);
      return;
    }
    
    const tbody = document.getElementById('leadsTable');
    const thead = document.getElementById('leadsTableHead');
    
    // ⭐ Завантажую налаштування видимості
    const vc = visibleRealtyColumns;
    
    // ⭐ ОНОВЛЮЮ ЗАГОЛОВКИ ДЛЯ НЕРУХОМОСТІ (з урахуванням видимості)
    thead.innerHTML = `
      <tr>
        ${vc.id !== false ? '<th style="width:8%">ID</th>' : ''}
        ${vc.fullName !== false ? '<th style="width:10%">ПІБ</th>' : ''}
        ${vc.phone !== false ? '<th style="width:11%">Телефон</th>' : ''}
        ${vc.type !== false ? '<th style="width:7%">Тип</th>' : ''}
        ${vc.manager !== false ? '<th style="width:9%">Менеджер</th>' : ''}
        ${vc.stage !== false ? '<th style="width:11%">Поточний Етап</th>' : ''}
        ${vc.nextContact !== false ? '<th style="width:10%">Наступний контакт</th>' : ''}
        ${vc.daysLeft !== false ? '<th style="width:6%">Днів залиш.</th>' : ''}
        ${vc.status !== false ? '<th style="width:10%">Статус</th>' : ''}
        <th style="width:auto">Дії</th>
      </tr>
    `;
    
    // Оновлюю чекбокси в модалці
    Object.keys(vc).forEach(key => {
      const checkbox = document.getElementById('col-' + key);
      if (checkbox) checkbox.checked = vc[key] !== false;
    });
    
    const stageNames = {
      'Етап_1_Контакт': '1️⃣ Контакт',
      'Етап_2_Кваліфікація': '2️⃣ Кваліфікація',
      'Етап_3_Підбір': '3️⃣ Підбір',
      'Етап_4_Покази': '4️⃣ Покази',
      'Етап_5_Намір': '5️⃣ Намір',
      'Етап_6_Arras': '6️⃣ Arras',
      'Етап_7_Юрист': '7️⃣ Юрист',
      'Етап_8_Нотаріус': '8️⃣ Нотаріус',
      'Етап_9_Після': '9️⃣ Після'
    };
    
    // ⭐ ФУНКЦІЯ ФОРМАТУВАННЯ ДАТИ (використовує глобальну formatDateSafe)
    function formatDate(dateStr) {
      return formatDateSafe(dateStr);
    }

    if (!leads || leads.length === 0) {
      const colCount = Object.values(vc).filter(v => v !== false).length + 2;
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">📭 Немає лідів</td></tr>`;
      return;
    }

    // ⭐ СОХРАНЯЮ LEADS В ГЛОБАЛЬНЫЙ МАССИВ
    leadsCache = leads;
    
    // ⭐ СОРТУВАННЯ: Нові ліди зверху, всередині — новіші першими (по rowIndex desc)
    leads.sort((a, b) => {
      const aNew = isLeadNew(a) ? 1 : 0;
      const bNew = isLeadNew(b) ? 1 : 0;
      if (bNew !== aNew) return bNew - aNew;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    });

    // ⭐ Рахую кількість нових лідів для сигналу в дашборді
    let newLeadsCount = 0;
    
    tbody.innerHTML = leads.map((lead, index) => {
      const stageName = stageNames[lead.stage] || (lead.stage || 'Контакт');
      
      // ⭐ ВИЗНАЧАЮ КЛАСИ ДЛЯ РЯДКА
      let rowClasses = [];
      
      // Перевірка: лід без менеджера (червоний)
      const unassigned = isLeadUnassigned(lead);
      if (unassigned) {
        rowClasses.push('lead-unassigned');
      }
      
      // Перевірка: новий лід для менеджера (мигаючий)
      const isNew = isLeadNew(lead);
      if (isNew) {
        rowClasses.push('lead-new');
        newLeadsCount++;
      }
      
      // ⭐ ІНДИКАТОР НОВОГО ЛІДА
      const newIndicator = isNew ? '<span class="new-lead-indicator">🔔 НОВИЙ</span>' : '';
      
      // ⭐ ВІДОБРАЖЕННЯ МЕНЕДЖЕРА
      const managerDisplay = unassigned 
        ? '<span style="color: #FF0000; font-weight: bold;">❌ Не назначено</span>' 
        : `👤 ${lead.manager}`;
      
      // ⭐ Рахую кількість видимих колонок для colspan
      const visibleCount = Object.values(vc).filter(v => v !== false).length + 1;
      
      // ⭐ ОСНОВНИЙ РЯДОК (з урахуванням видимості)
      const mainRow = `
        <tr class="${rowClasses.join(' ')} realty-lead-row" data-lead-id="${lead.id}" data-lead-index="${index}">
          ${vc.id !== false ? `<td><strong>${lead.id || '—'}</strong>${newIndicator}</td>` : ''}
          ${vc.fullName !== false ? `<td>${lead.fullName || '—'}</td>` : ''}
          ${vc.phone !== false ? `<td>${lead.phone || '—'}</td>` : ''}
          ${vc.type !== false ? `<td>${lead.type || '—'}</td>` : ''}
          ${vc.manager !== false ? `<td>${managerDisplay}</td>` : ''}
          ${vc.stage !== false ? `<td>${stageName}</td>` : ''}
          ${vc.nextContact !== false ? `<td>${formatDate(lead.nextContact)}</td>` : ''}
          ${vc.daysLeft !== false ? `<td>${lead.daysLeft || '—'}</td>` : ''}
          ${vc.status !== false ? `<td>${lead.status || '—'}</td>` : ''}
          <td style="min-width:200px">
            <div class="lead-actions">
              <button class="btn-details-realty" data-index="${index}">▼ Деталі</button>
              <button class="btn-edit-lead edit-lead-btn" data-lead-index="${index}" data-lead-id="${lead.id}">✏️</button>
              <button class="btn-delete-lead delete-lead-btn" data-lead-index="${index}" data-lead-id="${lead.id}" data-row-index="${lead.rowIndex}">🗑️</button>
            </div>
          </td>
        </tr>
      `;

      // ⭐ РЯДОК ДЕТАЛЕЙ ДЛЯ НЕРУХОМОСТІ (прихований за замовчуванням)
      const detailsRow = `
        <tr class="realty-details-row" data-details-for="${index}" style="display: none; background: #f8f9fa;">
          <td colspan="${visibleCount}" style="padding: 15px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.85rem;">
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🔗 Джерело:</strong><br>
                <span>${lead.source || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🌐 Мова:</strong><br>
                <span>${lead.language || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">💰 Бюджет:</strong><br>
                <span>${lead.budget || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📍 Район:</strong><br>
                <span>${lead.district || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🏠 Мета/Тип:</strong><br>
                <span>${lead.metaType || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📐 Площа:</strong><br>
                <span>${lead.area || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🚪 Кімнати:</strong><br>
                <span>${lead.rooms || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🎯 Наступна дія:</strong><br>
                <span>${lead.nextAction || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: span 2;">
                <strong style="color: #4472C4;">💬 Коментар:</strong><br>
                <span>${lead.comment || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📆 Дата додавання:</strong><br>
                <span>${formatDate(lead.dateAdded)}</span>
              </div>
            </div>
          </td>
        </tr>
      `;
      
      return mainRow + detailsRow;
    }).join('');
    
    // ⭐ ОНОВЛЮЮ СИГНАЛ В ДАШБОРДІ
    updateNewLeadsSignal(newLeadsCount);
    
    // ⭐ ОБРОБНИК КНОПКИ "ДЕТАЛІ" ДЛЯ НЕРУХОМОСТІ
    document.querySelectorAll('.btn-details-realty').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = this.dataset.index;
        const detailsRow = document.querySelector(`tr.realty-details-row[data-details-for="${index}"]`);
        
        if (detailsRow.style.display === 'none') {
          detailsRow.style.display = 'table-row';
          this.textContent = '▲ Сховати';
          this.style.background = 'linear-gradient(135deg, #6c757d, #495057)';
        } else {
          detailsRow.style.display = 'none';
          this.textContent = '▼ Деталі';
          this.style.background = 'linear-gradient(135deg, #4472C4, #2d5aa0)';
        }
      });
    });
    
    // ⭐ ДОДАЮ ОБРОБНИКИ КЛІКІВ НА КНОПКИ РЕДАГУВАННЯ
    document.querySelectorAll('.edit-lead-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const leadIndex = parseInt(this.dataset.leadIndex);
          const leadId = this.dataset.leadId;
          const lead = leadsCache[leadIndex];
          
          if (!lead) {
            throw new Error('Ліда не знайдено у кешу з індексом: ' + leadIndex);
          }
          
          // ⭐ ПОЗНАЧАЮ ЛІД ЯК ПЕРЕГЛЯНУТИЙ
          removeNewLeadSignal(leadId);
          
          openEditSidebarDirect(lead);
        } catch (err) {
          console.error('❌ Помилка при редагуванні ліда:', err);
          alert('❌ Помилка при відкритті редагування: ' + err.message);
        }
      });
    });
    
    // ⭐ ОБРОБНИК ВИДАЛЕННЯ ЛІДА
    document.querySelectorAll('.realty-lead-row .delete-lead-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const leadId = this.dataset.leadId;
        const rowIndex = this.dataset.rowIndex;
        const confirmed = await confirmDeleteLead(leadId);
        if (confirmed) {
          handleSoftDelete(leadId, rowIndex);
        }
      });
    });
    
    // ⭐ ДОДАЮ ОБРОБНИКИ КЛІКІВ НА РЯДКИ З НОВИМИ ЛІДАМИ
    document.querySelectorAll('tr.lead-new').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function(e) {
        // Якщо клікнули не на кнопку редагування
        if (!e.target.closest('.edit-lead-btn') && !e.target.closest('.delete-lead-btn') && !e.target.closest('.btn-details-realty')) {
          const leadId = this.dataset.leadId;
          removeNewLeadSignal(leadId);
        }
      });
    });
  }
  
  // ⭐⭐⭐ ФУНКЦІЯ РЕНДЕРИНГУ ЛІДІВ ОРЕНДИ (з розгортаємими деталями) ⭐⭐⭐
  function renderRentLeads(leads) {
    const tbody = document.getElementById('leadsTable');
    const thead = document.getElementById('leadsTableHead');

    // ⭐ Використовую ті ж колонки що і для Нерухомості
    const vc = visibleRentColumns;

    thead.innerHTML = `
      <tr>
        ${vc.id !== false ? '<th style="width:8%">ID</th>' : ''}
        ${vc.fullName !== false ? '<th style="width:10%">ПІБ</th>' : ''}
        ${vc.phone !== false ? '<th style="width:11%">Телефон</th>' : ''}
        ${vc.type !== false ? '<th style="width:7%">Тип</th>' : ''}
        ${vc.manager !== false ? '<th style="width:9%">Менеджер</th>' : ''}
        ${vc.stage !== false ? '<th style="width:11%">Поточний Етап</th>' : ''}
        ${vc.nextContact !== false ? '<th style="width:10%">Наступний контакт</th>' : ''}
        ${vc.daysLeft !== false ? '<th style="width:6%">Днів залиш.</th>' : ''}
        ${vc.status !== false ? '<th style="width:10%">Статус</th>' : ''}
        <th style="width:auto">Дії</th>
      </tr>
    `;

    Object.keys(vc).forEach(key => {
      const checkbox = document.getElementById('rent-col-' + key);
      if (checkbox) checkbox.checked = vc[key] !== false;
    });

    const stageNames = {
      'Етап_1_Контакт': '1️⃣ Контакт',
      'Етап_2_Кваліфікація': '2️⃣ Кваліфікація',
      'Етап_3_Підбір': '3️⃣ Підбір',
      'Етап_4_Покази': '4️⃣ Покази',
      'Етап_5_Намір': '5️⃣ Намір',
      'Етап_6_Договір': '6️⃣ Договір',
      'Етап_7_Заселення': '7️⃣ Заселення',
      'Етап_8_Виселення': '8️⃣ Виселення'
    };

    function fmtDate(d) { return formatDateSafe(d); }

    if (!leads || leads.length === 0) {
      const colCount = Object.values(vc).filter(v => v !== false).length + 2;
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">📭 Немає лідів</td></tr>`;
      return;
    }

    leadsCache = leads;

    leads.sort((a, b) => {
      const aNew = isLeadNew(a) ? 1 : 0;
      const bNew = isLeadNew(b) ? 1 : 0;
      if (bNew !== aNew) return bNew - aNew;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    });

    let newLeadsCount = 0;

    tbody.innerHTML = leads.map((lead, index) => {
      const stageName = stageNames[lead.stage] || (lead.stage || 'Контакт');

      let rowClasses = [];
      const unassigned = isLeadUnassigned(lead);
      if (unassigned) rowClasses.push('lead-unassigned');

      const isNew = isLeadNew(lead);
      if (isNew) { rowClasses.push('lead-new'); newLeadsCount++; }

      const newIndicator = isNew ? '<span class="new-lead-indicator">🔔 НОВИЙ</span>' : '';
      const managerDisplay = unassigned
        ? '<span style="color: #FF0000; font-weight: bold;">❌ Не назначено</span>'
        : `👤 ${lead.manager}`;

      const visibleCount = Object.values(vc).filter(v => v !== false).length + 1;

      // ⭐ Такий самий рядок як в Нерухомості (realty-lead-row)
      const mainRow = `
        <tr class="${rowClasses.join(' ')} realty-lead-row" data-lead-id="${lead.id}" data-lead-index="${index}">
          ${vc.id !== false ? `<td><strong>${lead.id || '—'}</strong>${newIndicator}</td>` : ''}
          ${vc.fullName !== false ? `<td>${lead.fullName || '—'}</td>` : ''}
          ${vc.phone !== false ? `<td>${lead.phone || '—'}</td>` : ''}
          ${vc.type !== false ? `<td>${lead.type || '—'}</td>` : ''}
          ${vc.manager !== false ? `<td>${managerDisplay}</td>` : ''}
          ${vc.stage !== false ? `<td>${stageName}</td>` : ''}
          ${vc.nextContact !== false ? `<td>${fmtDate(lead.nextContact)}</td>` : ''}
          ${vc.daysLeft !== false ? `<td>${lead.daysLeft || '—'}</td>` : ''}
          ${vc.status !== false ? `<td>${lead.status || '—'}</td>` : ''}
          <td style="min-width:200px">
            <div class="lead-actions">
              <button class="btn-details-realty" data-index="${index}">▼ Деталі</button>
              <button class="btn-edit-lead rent-edit-btn" data-lead-index="${index}" data-lead-id="${lead.id}">✏️</button>
              <button class="btn-delete-lead rent-delete-btn" data-lead-index="${index}" data-lead-id="${lead.id}" data-row-index="${lead.rowIndex}">🗑️</button>
            </div>
          </td>
        </tr>
      `;

      // ⭐ Деталі — такий самий стиль як в Нерухомості
      const detailsRow = `
        <tr class="realty-details-row" data-details-for="${index}" style="display: none; background: #f8f9fa;">
          <td colspan="${visibleCount}" style="padding: 15px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.85rem;">
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🔗 Джерело:</strong><br><span>${lead.source || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🌐 Мова:</strong><br><span>${lead.language || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">💰 Бюджет:</strong><br><span>${lead.budget || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📍 Район:</strong><br><span>${lead.district || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🛏️ Кімнати/Стан:</strong><br><span>${lead.roomsCondition || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🐾 Тварини/Формат:</strong><br><span>${lead.petsFormat || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🎯 Наступна дія:</strong><br><span>${lead.nextAction || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: span 2;">
                <strong style="color: #4472C4;">💬 Коментар:</strong><br><span>${lead.comment || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📆 Дата додавання:</strong><br><span>${fmtDate(lead.dateAdded)}</span>
              </div>
            </div>
          </td>
        </tr>
      `;

      return mainRow + detailsRow;
    }).join('');

    updateNewLeadsSignal(newLeadsCount);

    // ⭐ Деталі — ті ж обробники що й у Нерухомості
    document.querySelectorAll('.btn-details-realty').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = this.dataset.index;
        const detailsRow = document.querySelector(`tr.realty-details-row[data-details-for="${index}"]`);
        if (detailsRow.style.display === 'none') {
          detailsRow.style.display = 'table-row';
          this.textContent = '▲ Сховати';
          this.style.background = 'linear-gradient(135deg, #6c757d, #495057)';
        } else {
          detailsRow.style.display = 'none';
          this.textContent = '▼ Деталі';
          this.style.background = 'linear-gradient(135deg, #4472C4, #2d5aa0)';
        }
      });
    });

    // ⭐ Редагування
    document.querySelectorAll('.rent-edit-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const lead = leadsCache[parseInt(this.dataset.leadIndex)];
          if (!lead) throw new Error('Ліда не знайдено');
          removeNewLeadSignal(this.dataset.leadId);
          openEditSidebarRent(lead);
        } catch (err) {
          console.error('❌ Помилка:', err);
          alert('❌ Помилка: ' + err.message);
        }
      });
    });

    // ⭐ Видалення
    document.querySelectorAll('.rent-delete-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const confirmed = await confirmDeleteLead(this.dataset.leadId);
        if (confirmed) handleSoftDelete(this.dataset.leadId, this.dataset.rowIndex);
      });
    });

    // ⭐ Нові ліди
    document.querySelectorAll('tr.lead-new').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function(e) {
        if (!e.target.closest('.rent-edit-btn') && !e.target.closest('.rent-delete-btn') && !e.target.closest('.btn-details-realty')) {
          removeNewLeadSignal(this.dataset.leadId);
        }
      });
    });
  }
  
  // ⭐ ФУНКЦІЯ ВІДКРИТТЯ САЙДБАРУ РЕДАГУВАННЯ ДЛЯ ОРЕНДИ
  function openEditSidebarRent(lead) {
    console.log('📝 openEditSidebarRent:', lead);
    
    const sidebar = document.getElementById('editSidebarRent');
    
    // Заповнюю поля
    document.getElementById('rentLeadId').value = lead.id || '';
    document.getElementById('rentRowIndex').value = lead.rowIndex || '';
    document.getElementById('rentLeadId_display').value = lead.id || '';
    document.getElementById('rentFullName').value = lead.fullName || '';
    document.getElementById('rentPhone').value = lead.phone || '';
    document.getElementById('rentSource').value = lead.source || '';
    document.getElementById('rentLanguage').value = lead.language || 'Українська';
    document.getElementById('rentType').value = lead.type || 'Подобова';
    document.getElementById('rentStage').value = lead.stage || 'Етап_1_Контакт';
    document.getElementById('rentBudget').value = lead.budget || '';
    document.getElementById('rentRoomsCondition').value = lead.roomsCondition || '';
    document.getElementById('rentPetsFormat').value = lead.petsFormat || '';
    document.getElementById('rentPeople').value = lead.people || '';
    document.getElementById('rentTermType').value = lead.termType || '';
    document.getElementById('rentDateSeason').value = lead.dateSeason || '';
    document.getElementById('rentDistrict').value = lead.district || '';
    document.getElementById('rentNextAction').value = lead.nextAction || '';
    document.getElementById('rentComment').value = lead.comment || '';
    document.getElementById('rentContactTime').value = lead.contactTime || '';
    
    // ✅ Дата контакту (без UTC-зсуву)
    document.getElementById('rentNextContact').value = dateToInputValue(lead.nextContact);
    
    // Завантажую менеджерів для оренди
    loadRentManagers(lead.manager);
    
    // Відкриваю сайдбар
    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebarRent() {
    const sidebar = document.getElementById('editSidebarRent');
    sidebar.style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }
  
  function loadRentManagers(currentManager) {
    // ⭐ МУЛЬТИ-МЕНЕДЖЕР: checkbox-и замість dropdown
    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success && result.users) {
        const rentManagers = result.users
          .filter(u => u.role === 'Manager' || u.role === 'Admin')
          .map(u => u.name)
          .filter(name => name && name.trim() !== '');
        renderManagerCheckboxes('rentManager', rentManagers, currentManager);
      }
    })
    .catch(e => {
      console.error('Помилка завантаження менеджерів:', e);
      // Резервний варіант - беремо з лідів
      const uniqueManagers = [...new Set(leadsCache.map(l => l.manager).filter(m => m && m !== 'Не назначено'))];
      select.innerHTML = '<option value="Не назначено">❌ Не назначено</option>';
      uniqueManagers.forEach(name => {
        const selected = (name === currentManager) ? 'selected' : '';
        select.innerHTML += `<option value="${name}" ${selected}>👤 ${name}</option>`;
      });
    });
  }
  
  function handleSidebarEditRent(e) {
    e.preventDefault();
    
    const leadId = document.getElementById('rentLeadId').value;
    const rowIndex = document.getElementById('rentRowIndex').value;
    
    const updateData = {
      leadId: leadId,
      rowIndex: rowIndex ? parseInt(rowIndex) : null,
      fullName: document.getElementById('rentFullName').value,
      phone: document.getElementById('rentPhone').value,
      source: document.getElementById('rentSource').value,
      language: document.getElementById('rentLanguage').value,
      type: document.getElementById('rentType').value,
      manager: getSelectedManagersValue('rentManager'),
      stage: document.getElementById('rentStage').value,
      nextContact: document.getElementById('rentNextContact').value,
      contactTime: document.getElementById('rentContactTime').value,
      budget: document.getElementById('rentBudget').value,
      roomsCondition: document.getElementById('rentRoomsCondition').value,
      petsFormat: document.getElementById('rentPetsFormat').value,
      people: document.getElementById('rentPeople').value,
      termType: document.getElementById('rentTermType').value,
      dateSeason: document.getElementById('rentDateSeason').value,
      district: document.getElementById('rentDistrict').value,
      nextAction: document.getElementById('rentNextAction').value,
      comment: document.getElementById('rentComment').value
    };
    
    console.log('🔧 updateData RENT:', updateData);
    
    showLoading('⏳ Зберігаю дані...');
    
    fetch(SCRIPT_URL_RENT, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateLead',
        payload: updateData
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('🔧 updateLead RENT result:', result);
      if (result.success) {
        const textEl = document.getElementById('loadingText');
        if (textEl) textEl.textContent = '🔄 Оновлюю таблицю...';
        
        closeSidebarRent();
        
        loadLeadsWithCallback(() => {
          showSuccess('✅ Ліда оновлено!');
        });
      } else {
        showError('❌ ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      showError('❌ Помилка мережі: ' + e.message);
    });
  }
  
  // ========== ІПОТЕКА: ФУНКЦІЇ ==========

  // ⭐ Видимість колонок Іпотеки
  let visibleMortgageColumns = { id: true, fullName: true, phone: true, manager: true, stage: true, nextContact: true, daysLeft: true, status: true };

  function toggleMortgageColumn(col) {
    visibleMortgageColumns[col] = !visibleMortgageColumns[col];
    renderLeads(allLeads);
  }

  // ⭐ РЕНДЕР ТАБЛИЦІ ІПОТЕКИ
  function renderMortgageLeads(leads) {
    const tbody = document.getElementById('leadsTable');
    const thead = document.getElementById('leadsTableHead');
    const vc = visibleMortgageColumns;

    // ⭐ Заголовки — такий самий стиль як в Нерухомості
    thead.innerHTML = `
      <tr>
        ${vc.id !== false ? '<th style="width:8%">ID</th>' : ''}
        ${vc.fullName !== false ? '<th style="width:10%">ПІБ</th>' : ''}
        ${vc.phone !== false ? '<th style="width:11%">Телефон</th>' : ''}
        ${vc.manager !== false ? '<th style="width:9%">Менеджер</th>' : ''}
        ${vc.stage !== false ? '<th style="width:11%">Поточний Етап</th>' : ''}
        ${vc.nextContact !== false ? '<th style="width:10%">Наступний контакт</th>' : ''}
        ${vc.daysLeft !== false ? '<th style="width:6%">Днів залиш.</th>' : ''}
        ${vc.status !== false ? '<th style="width:10%">Статус</th>' : ''}
        <th style="width:auto">Дії</th>
      </tr>
    `;

    Object.keys(vc).forEach(col => {
      const cb = document.getElementById('mort-col-' + col);
      if (cb) cb.checked = vc[col] !== false;
    });

    const stageNames = {
      'Етап_1_Контакт': '1️⃣ Контакт',
      'Етап_2_Кваліфікація': '2️⃣ Кваліфікація',
      'Етап_3_Подача_в_банк': '3️⃣ Подача в банк',
      'Етап_4_Схвалення_ліміту': '4️⃣ Схвалення ліміту',
      'Етап_5_Підбір': '5️⃣ Підбір',
      "Етап_6_Оцінка_об'єкта": '6️⃣ Оцінка об\'єкта',
      'Етап_7_FIPER': '7️⃣ FIPER',
      'Етап_8_Нотаріус': '8️⃣ Нотаріус',
      'Етап_9_Після': '9️⃣ Після'
    };

    function fmtDate(d) { return formatDateSafe(d); }

    if (!leads || leads.length === 0) {
      const colCount = Object.values(vc).filter(v => v !== false).length + 2;
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">📭 Немає лідів</td></tr>`;
      return;
    }

    leadsCache = leads;

    leads.sort((a, b) => {
      const aNew = isLeadNew(a) ? 1 : 0;
      const bNew = isLeadNew(b) ? 1 : 0;
      if (bNew !== aNew) return bNew - aNew;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    });

    let newLeadsCount = 0;

    tbody.innerHTML = leads.map((lead, index) => {
      const stageName = stageNames[lead.stage] || (lead.stage || 'Контакт');

      let rowClasses = [];
      const unassigned = isLeadUnassigned(lead);
      if (unassigned) rowClasses.push('lead-unassigned');

      const isNew = isLeadNew(lead);
      if (isNew) { rowClasses.push('lead-new'); newLeadsCount++; }

      const newIndicator = isNew ? '<span class="new-lead-indicator">🔔 НОВИЙ</span>' : '';
      const managerDisplay = unassigned
        ? '<span style="color: #FF0000; font-weight: bold;">❌ Не назначено</span>'
        : `👤 ${lead.manager}`;

      const visibleCount = Object.values(vc).filter(v => v !== false).length + 1;

      // ⭐ Такий самий рядок як в Нерухомості (realty-lead-row)
      const mainRow = `
        <tr class="${rowClasses.join(' ')} realty-lead-row" data-lead-id="${lead.id}" data-lead-index="${index}">
          ${vc.id !== false ? `<td><strong>${lead.id || '—'}</strong>${newIndicator}</td>` : ''}
          ${vc.fullName !== false ? `<td>${lead.fullName || '—'}</td>` : ''}
          ${vc.phone !== false ? `<td>${lead.phone || '—'}</td>` : ''}
          ${vc.manager !== false ? `<td>${managerDisplay}</td>` : ''}
          ${vc.stage !== false ? `<td>${stageName}</td>` : ''}
          ${vc.nextContact !== false ? `<td>${fmtDate(lead.nextContact)}</td>` : ''}
          ${vc.daysLeft !== false ? `<td>${lead.daysLeft || '—'}</td>` : ''}
          ${vc.status !== false ? `<td>${lead.status || '—'}</td>` : ''}
          <td style="min-width:200px">
            <div class="lead-actions">
              <button class="btn-details-realty" data-index="${index}">▼ Деталі</button>
              <button class="btn-edit-lead mort-edit-btn" data-lead-index="${index}" data-lead-id="${lead.id}">✏️</button>
              <button class="btn-delete-lead mort-delete-btn" data-lead-index="${index}" data-lead-id="${lead.id}" data-row-index="${lead.rowIndex}">🗑️</button>
            </div>
          </td>
        </tr>
      `;

      // ⭐ Деталі — такий самий стиль як в Нерухомості
      const detailsRow = `
        <tr class="realty-details-row" data-details-for="${index}" style="display: none; background: #f8f9fa;">
          <td colspan="${visibleCount}" style="padding: 15px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.85rem;">
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🔗 Джерело:</strong><br><span>${lead.source || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🌐 Мова:</strong><br><span>${lead.language || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">💰 Бюджет:</strong><br><span>${lead.budget || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🏛 Податкова резиденція:</strong><br><span>${lead.taxResidency || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">💵 Дохід:</strong><br><span>${lead.income || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">🌍 Країна доходу:</strong><br><span>${lead.incomeCountry || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📆 Коли планує:</strong><br><span>${lead.whenPlans || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">👨‍👩‍👧 Дорослих:</strong><br><span>${lead.adults || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">👶 Дітей:</strong><br><span>${lead.children || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); grid-column: span 2;">
                <strong style="color: #4472C4;">💬 Коментар:</strong><br><span>${lead.comment || '—'}</span>
              </div>
              <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <strong style="color: #4472C4;">📆 Дата додавання:</strong><br><span>${fmtDate(lead.dateAdded)}</span>
              </div>
            </div>
          </td>
        </tr>
      `;

      return mainRow + detailsRow;
    }).join('');

    updateNewLeadsSignal(newLeadsCount);

    // ⭐ Деталі — ті ж обробники що й у Нерухомості
    document.querySelectorAll('.btn-details-realty').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const index = this.dataset.index;
        const detailsRow = document.querySelector(`tr.realty-details-row[data-details-for="${index}"]`);
        if (detailsRow.style.display === 'none') {
          detailsRow.style.display = 'table-row';
          this.textContent = '▲ Сховати';
          this.style.background = 'linear-gradient(135deg, #6c757d, #495057)';
        } else {
          detailsRow.style.display = 'none';
          this.textContent = '▼ Деталі';
          this.style.background = 'linear-gradient(135deg, #4472C4, #2d5aa0)';
        }
      });
    });

    // ⭐ Редагування
    document.querySelectorAll('.mort-edit-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const lead = leadsCache[parseInt(this.dataset.leadIndex)];
          if (!lead) throw new Error('Ліда не знайдено');
          removeNewLeadSignal(this.dataset.leadId);
          openEditSidebarMortgage(lead);
        } catch (err) {
          console.error('❌ Помилка:', err);
          alert('❌ Помилка: ' + err.message);
        }
      });
    });

    // ⭐ Видалення
    document.querySelectorAll('.mort-delete-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const confirmed = await confirmDeleteLead(this.dataset.leadId);
        if (confirmed) handleSoftDelete(this.dataset.leadId, this.dataset.rowIndex);
      });
    });

    // ⭐ Нові ліди
    document.querySelectorAll('tr.lead-new').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function(e) {
        if (!e.target.closest('.mort-edit-btn') && !e.target.closest('.mort-delete-btn') && !e.target.closest('.btn-details-realty')) {
          removeNewLeadSignal(this.dataset.leadId);
        }
      });
    });
  }

  // ⭐ ВІДКРИТИ САЙДБАР РЕДАГУВАННЯ ІПОТЕКИ
  function openEditSidebarMortgage(lead) {
    console.log('📝 openEditSidebarMortgage:', lead);
    const sidebar = document.getElementById('editSidebarMortgage');

    document.getElementById('mortLeadId').value = lead.id || '';
    document.getElementById('mortRowIndex').value = lead.rowIndex || '';
    document.getElementById('mortLeadId_display').value = lead.id || '';
    document.getElementById('mortFullName').value = lead.fullName || '';
    document.getElementById('mortPhone').value = lead.phone || '';
    document.getElementById('mortSource').value = lead.source || '';
    document.getElementById('mortLanguage').value = lead.language || '';
    document.getElementById('mortStage').value = lead.stage || 'Етап_1_Контакт';
    document.getElementById('mortBudget').value = lead.budget || '';
    document.getElementById('mortTaxResidency').value = lead.taxResidency || '';
    document.getElementById('mortIncome').value = lead.income || '';
    document.getElementById('mortIncomeCountry').value = lead.incomeCountry || '';
    document.getElementById('mortWhenPlans').value = lead.whenPlans || '';
    document.getElementById('mortAdults').value = lead.adults || '';
    document.getElementById('mortChildren').value = lead.children || '';
    document.getElementById('mortComment').value = lead.comment || '';
    document.getElementById('mortNextContact').value = dateToInputValue(lead.nextContact);

    // Завантажую менеджерів
    loadMortgageManagers(lead.manager);

    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }

  function closeMortgageSidebar() {
    document.getElementById('editSidebarMortgage').style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }

  function loadMortgageManagers(currentManager) {
    // ⭐ МУЛЬТИ-МЕНЕДЖЕР: checkbox-и замість dropdown
    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success && result.users) {
        const mgrs = result.users.filter(u => u.role === 'Manager' || u.role === 'Admin').map(u => u.name).filter(n => n && n.trim());
        renderManagerCheckboxes('mortManager', mgrs, currentManager);
      }
    }).catch(e => console.error('Помилка завантаження менеджерів:', e));
  }

  function handleSidebarEditMortgage(e) {
    e.preventDefault();
    const updateData = {
      leadId: document.getElementById('mortLeadId').value,
      rowIndex: document.getElementById('mortRowIndex').value ? parseInt(document.getElementById('mortRowIndex').value) : null,
      fullName: document.getElementById('mortFullName').value,
      phone: document.getElementById('mortPhone').value,
      source: document.getElementById('mortSource').value,
      language: document.getElementById('mortLanguage').value,
      type: 'Іпотека',
      manager: getSelectedManagersValue('mortManager'),
      stage: document.getElementById('mortStage').value,
      nextContact: document.getElementById('mortNextContact').value,
      budget: document.getElementById('mortBudget').value,
      taxResidency: document.getElementById('mortTaxResidency').value,
      income: document.getElementById('mortIncome').value,
      incomeCountry: document.getElementById('mortIncomeCountry').value,
      whenPlans: document.getElementById('mortWhenPlans').value,
      adults: document.getElementById('mortAdults').value,
      children: document.getElementById('mortChildren').value,
      comment: document.getElementById('mortComment').value
    };

    showLoading('⏳ Зберігаю дані...');

    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateLead', payload: updateData })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        closeMortgageSidebar();
        cachedMortgageLeads = null;
        loadLeadsWithCallback(() => { showSuccess('✅ Ліда оновлено!'); });
      } else {
        showError('❌ ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => { showError('❌ Помилка мережі: ' + e.message); });
  }

  // ⭐ ДОДАВАННЯ ЛІДА ІПОТЕКИ
  function openAddMortgageLeadSidebar() {
    const sidebar = document.getElementById('addMortgageLeadSidebar');
    // Завантажую менеджерів
    const select = document.getElementById('addMortManager');
    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success && result.users) {
        const mgrs = result.users.filter(u => u.role === 'Manager' || u.role === 'Admin').map(u => u.name).filter(n => n && n.trim());
        select.innerHTML = '<option value="">-- Вибери менеджера --</option>';
        mgrs.forEach(name => { select.innerHTML += `<option value="${name}">👤 ${name}</option>`; });
      }
    }).catch(e => console.error('Помилка:', e));

    sidebar.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }

  function closeAddMortgageLeadSidebar() {
    document.getElementById('addMortgageLeadSidebar').style.transform = 'translateX(100%)';
    document.body.style.overflow = 'auto';
  }

  function handleAddMortgageLead(e) {
    e.preventDefault();
    const data = {
      fullName: document.getElementById('addMortFullName').value,
      phone: document.getElementById('addMortPhone').value,
      source: document.getElementById('addMortSource').value,
      language: document.getElementById('addMortLanguage').value,
      type: 'Іпотека',
      manager: document.getElementById('addMortManager').value,
      budget: document.getElementById('addMortBudget').value,
      taxResidency: document.getElementById('addMortTaxResidency').value,
      income: document.getElementById('addMortIncome').value,
      incomeCountry: document.getElementById('addMortIncomeCountry').value,
      whenPlans: document.getElementById('addMortWhenPlans').value,
      adults: document.getElementById('addMortAdults').value,
      children: document.getElementById('addMortChildren').value,
      comment: document.getElementById('addMortComment').value
    };

    showLoading('⏳ Додаю ліда...');

    fetch(SCRIPT_URL_REALTY, {
      method: 'POST',
      body: JSON.stringify({ action: 'addLead', payload: data })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        closeAddMortgageLeadSidebar();
        const form = document.querySelector('#addMortgageLeadSidebar form');
        if (form) form.reset();
        cachedMortgageLeads = null;
        loadDataWithCallback(() => { showSuccess('✅ Ліда додано!'); });
      } else {
        showError('❌ ' + (result.error || 'Помилка'));
      }
    })
    .catch(e => { showError('❌ Помилка: ' + e.message); });
  }

  // ⭐ ФУНКЦІЯ ВИДАЛЕННЯ СИГНАЛУ НОВОГО ЛІДА
  function removeNewLeadSignal(leadId) {
    if (!leadId) return;
    
    // Позначаю як переглянутий
    markLeadAsViewed(leadId);
    
    // ⭐ Шукаю рядок по data-lead-id (екрануючи спецсимволи)
    const rows = document.querySelectorAll('tr[data-lead-id]');
    let targetRow = null;
    
    // Нормалізую ID для порівняння
    const normalizedId = String(leadId).replace(/[\s\n\r]+/g, '').trim();
    
    rows.forEach(row => {
      const rowId = String(row.dataset.leadId || '').replace(/[\s\n\r]+/g, '').trim();
      if (rowId === normalizedId) {
        targetRow = row;
      }
    });
    
    if (targetRow) {
      targetRow.classList.remove('lead-new');
      targetRow.style.cursor = '';
      const indicator = targetRow.querySelector('.new-lead-indicator');
      if (indicator) indicator.remove();
    }
    
    // Оновлюю лічильник нових лідів
    const newLeadsRows = document.querySelectorAll('tr.lead-new');
    updateNewLeadsSignal(newLeadsRows.length);
    
    // ⭐ Оновлюю бейджик на поточній вкладці
    refreshCurrentTabBadge();
    
    console.log('✅ Лід ' + normalizedId + ' позначено як переглянутий');
  }

  // ========== МОДАЛЬНІ ФУНКЦІЇ ==========
  function openAddLead() {
    console.log('📝 Відкриваю форму додавання ліда...');
    
    // Спочатку намагаюсь завантажити менеджерів з Google Apps Script
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      console.log('👥 Результат getAllUsers:', result);
      
      // ⭐ СПОЧАТКУ ПРОБУЮ З "ДОСТУПИ"
      if (result.success && result.users && result.users.length > 0) {
        const beforeCount = managers.length;
        managers = result.users
          .filter(u => u.role === 'Manager' || u.role === 'Admin')
          .map(u => u.name)
          .filter(name => name && name.trim() !== '');
        
        if (managers.length > 0) {
          console.log(`✅ З таблиці "доступи" завантажено ${managers.length} менеджерів`);
        }
      }
      
      // ⭐ РЕЗЕРВНИЙ ВАРІАНТ - БЕРУ З ТАБЛИЦІ ЛІДІВ
      if (!managers || managers.length === 0) {
        console.log('⚠️ В "доступи" менеджерів не знайдено');
        console.log('📋 Беру менеджерів з таблиці лідів (Нерухомість)...');
        
        // Беру УНІКАЛЬНІ імена менеджерів з allLeads, видаляю "Не назначено"
        const leadManagers = [...new Set(
          allLeads
            .map(l => l.manager)
            .filter(m => m && m !== 'Не назначено' && m.trim() !== '')
        )];
        
        if (leadManagers.length > 0) {
          managers = leadManagers;
          console.log(`✅ З таблиці лідів завантажено ${managers.length} менеджерів:`, managers);
        } else {
          console.warn('⚠️ Менеджери не знайдені нікуди!');
          managers = [];
        }
      }
      
      // Скидую форму
      const form = document.querySelector('#addModal form');
      if (form) form.reset();
      
      fillManagerSelect();
      updateFormFields();
      openAddLeadSidebar();  // ⭐ САЙДБАР ВМЕСТО МОДАЛКИ!
    })
    .catch(e => {
      console.error('❌ Помилка при завантаженні з "доступи":', e);
      console.log('📋 Беру менеджерів з таблиці лідів (Нерухомість) через помилку...');
      
      // ⭐ НА ПОМИЛКУ - БЕРУ З ТАБЛИЦІ ЛІДІВ
      const leadManagers = [...new Set(
        allLeads
          .map(l => l.manager)
          .filter(m => m && m !== 'Не назначено' && m.trim() !== '')
      )];
      
      if (leadManagers.length > 0) {
        managers = leadManagers;
        console.log(`✅ З таблиці лідів (fallback) завантажено ${managers.length} менеджерів:`, managers);
      } else {
        console.warn('⚠️ Менеджери не знайдені!');
        managers = [];
      }
      
      // Скидую форму
      const form2 = document.querySelector('#addModal form');
      if (form2) form2.reset();
      
      fillManagerSelect();
      updateFormFields();
      openAddLeadSidebar();  // ⭐ САЙДБАР ВМЕСТО МОДАЛКИ!
    });
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  function editLeadModal(lead) {
    document.getElementById('editLeadId').value = lead.id;
    document.getElementById('editPhone').value = lead.phone;
    document.getElementById('editStage').value = lead.stage;
    document.getElementById('editContactDate').value = dateToInputValue(lead.nextContact);
    document.getElementById('editNextAction').value = lead.nextAction || '';
    document.getElementById('editComment').value = lead.comment || '';
    document.getElementById('editModal').classList.add('active');
  }

  // ========== ФІКСЖ ==========
  function handleAddLead(e) {
    e.preventDefault();

    const role = localStorage.getItem('user_role');
    const userName = localStorage.getItem('user_name');
    const typeInput = document.getElementById('type').value;
    const selectedManager = document.getElementById('manager').value;

    if (!selectedManager) {
      alert('❌ Вибери менеджера!');
      return;
    }

    // Очищаю тип від смайликів
    const type = typeInput.replace(/🏡|🏠/g, '').trim();

    // Бюджет
    let budget = document.getElementById('budgetSelect').value || '';

    // Район
    const district = document.getElementById('district').value || '';

    // Площа
    const area = document.getElementById('area').value || '';

    // Кімнати
    const rooms = document.getElementById('rooms').value || '';

    // Мета/Тип
    const metaType = document.getElementById('metaType').value || '';

    // Коментар
    const comment = document.getElementById('comment').value || '';

    const data = {
      fullName: document.getElementById('addFullName').value || '',
      phone: document.getElementById('phone').value,
      source: document.getElementById('source').value,
      type: type,
      manager: selectedManager,
      budget: budget,
      district: district,
      metaType: metaType,
      area: area,
      rooms: rooms,
      comment: comment,
      language: 'Українська'
    };

    console.log('📝 handleAddLead: typeInput="' + typeInput + '" → type="' + type + '"');
    console.log('📝 handleAddLead: currentDashboardType="' + currentDashboardType + '"');
    console.log('📝 handleAddLead: data=', data);

    // ⭐ ПОКАЗУЮ OVERLAY ЗАВАНТАЖЕННЯ
    showLoading('⏳ Додаю ліда...');

    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: 'addLead',
        payload: data
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        // ⭐ Змінюю текст але залишаю спінер
        const textEl = document.getElementById('loadingText');
        if (textEl) textEl.textContent = '🔄 Оновлюю таблицю...';
        
        // ⭐ ЗАКРИВАЮ SIDEBAR (не modal!)
        closeAddLeadSidebar();
        
        // Очищаю форму
        const form = document.querySelector('#addLeadSidebar form');
        if (form) form.reset();
        
        // ⭐ Завантажую дані і ПОТІМ показую успіх
        loadDataWithCallback(() => {
          showSuccess('✅ Ліда додано!');
        });
      } else {
        showError('❌ ' + (result.error || 'Помилка'));
      }
    })
    .catch(e => {
      showError('❌ Помилка: ' + e.message);
    });
  }
  
  // ⭐ ФУНКЦІЯ ЗАВАНТАЖЕННЯ ДАНИХ З CALLBACK
  function loadDataWithCallback(callback) {
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    const type = currentDashboardType;

    // ⭐ Скидаю кеш — дані змінилися
    if (type === 'Іпотека') {
      cachedMortgageLeads = null;
    } else if (isRentMode()) {
      cachedRentLeads = null;
    } else {
      cachedRealtyLeads = null;
    }

    // Для режиму "Всі" оренди — використовую loadLeads
    if (type === 'Оренда') {
      loadLeads();
      loadStats();
      if (callback) callback();
      return;
    }

    console.log('📊 loadDataWithCallback: role=' + role + ', name=' + name + ', type=' + type);

    fetch(getScriptUrl(), {
      method: 'POST',
      body: JSON.stringify({
        action: role === 'Admin' ? 'getAllLeads' : 'getLeads',
        payload: role === 'Admin' ? { type: type } : { manager: name, type: type }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('📊 loadDataWithCallback result:', result);
      if (result.success) {
        allLeads = (result.leads || []).filter(lead => lead.deletedStatus !== 'ВИДАЛЕНО');
        console.log('📊 Ліди завантажені:', allLeads.length);
        renderLeads(allLeads);
        populateFilters(allLeads);
        loadStats();
      } else {
        console.error('📊 Помилка:', result.error);
      }
      // ⭐ ВИКЛИКАЮ CALLBACK ПІСЛЯ ОНОВЛЕННЯ
      if (callback) callback();
    })
    .catch(e => {
      console.error('❌ Помилка завантаження:', e);
      if (callback) callback();
    });
  }

  function handleEditLead(e) {
    e.preventDefault();

    const leadId = document.getElementById('editLeadId').value;
    const budgetSelect = document.getElementById('editBudgetSelect');
    const budgetManual = document.getElementById('editBudgetManual');
    
    // Визначаємо бюджет
    let budget = '';
    if (budgetSelect.value === 'custom') {
      budget = budgetManual.value + '€'; // Вручну введена сума
    } else if (budgetSelect.value) {
      budget = budgetSelect.value + '€'; // Вибрана сума
    }

    const data = {
      stage: document.getElementById('editStage').value,
      manager: document.getElementById('editManager').value,
      nextContact: document.getElementById('editContactDate').value,
      nextAction: document.getElementById('editNextAction').value,
      comment: document.getElementById('editComment').value
    };

    // Додаю бюджет якщо змінено
    if (budget) {
      data.budget = budget;
    }

    console.log('handleEditLead: data=', data);

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateLead',
        payload: { leadId, ...data }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('updateLead result:', result);
      if (result.success) {
        alert('✅ Збережено!');
        closeModal('editModal');
        // ⭐ Скидаю кеш — дані змінилися
        if (currentDashboardType === 'Іпотека') { cachedMortgageLeads = null; }
        else if (isRentMode()) { cachedRentLeads = null; } else { cachedRealtyLeads = null; }
        // Оновлюємо дашборд і таблицю
        loadStats(); // Оновляємо дашборд
        loadLeads(); // Оновляємо таблицю лідів
      } else {
        alert('❌ Помилка: ' + result.error);
      }
    })
    .catch(e => {
      console.error('Помилка при оновленні:', e);
      alert('❌ Помилка при оновленні');
    });
  }

  function deleteLead() {
    if (!confirm('❓ Видалити ліда?')) return;

    const leadId = document.getElementById('editLeadId').value;
    
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteLead',
        payload: { leadId }
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        alert('✅ Видалено!');
        closeModal('editModal');
        loadData();
      }
    });
  }

  // ========== DARK MODE TOGGLE ==========
  function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    const icon = document.querySelector('.dark-mode-toggle');
    
    // Зберігаю у localStorage
    localStorage.setItem('dark_mode', isDark);
    
    // Міняю іконку
    icon.textContent = isDark ? '☀️' : '🌙';
  }

  // Завантажую dark mode при завантаженні
  if (localStorage.getItem('dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('.dark-mode-toggle');
    if (icon) icon.textContent = '☀️';
  }

  // ========== ВИБІР ТИПУ ДАШБОРДУ ТА КНОПКИ ==========
  
  function selectDashboardType(type) {
    console.log('selectDashboardType:', type);

    // Оновлюю активну кнопку
    document.querySelectorAll('.type-pill').forEach(btn => btn.classList.remove('active'));
    const pill = document.getElementById('pill-' + type);
    if (pill) pill.classList.add('active');

    // Показую/ховаю великі кнопки оренди
    const rentBtns = document.getElementById('rentTypeButtons');
    if (type === 'Оренда') {
      if (rentBtns) rentBtns.style.display = 'block';
      currentRentSubtype = 'Всі';
      currentDashboardType = 'Оренда';
      document.querySelectorAll('.rent-type-btn').forEach(b => b.classList.remove('active'));
      const allBtn = document.getElementById('rentBtn-Всі');
      if (allBtn) allBtn.classList.add('active');
    } else {
      if (rentBtns) rentBtns.style.display = 'none';
      currentDashboardType = type;
    }

    // Визначаю emoji
    const emojiMap = { 'Купівля': '🏡', 'Продаж': '🏠', 'Оренда': '🏨', 'Іпотека': '🏦', 'Консультація': '💬', 'Подобова': '🌙', 'Сезонна': '☀️', 'Довгострокова': '📅', 'Управління': '🔑' };
    const emoji = emojiMap[type] || '🏢';

    document.getElementById('leadsTitle').textContent = `📋 Ліди (${emoji} ${type})`;

    const menu = document.getElementById('dashboardTypeMenu');
    if (menu) menu.style.display = 'none';

    // ⭐ Завжди згортаємо дашборд при зміні типу
    const content = document.getElementById('dashboardContent');
    const toggleBtn = document.getElementById('toggleDashboard');
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      content.classList.add('collapsed');
      toggleBtn.textContent = '+';
      document.body.classList.add('dashboard-collapsed');
    }

    loadStats();
    loadLeads();
  }

  // ⭐ ВИБІР ПІДТИПУ ОРЕНДИ (великі кнопки)
  function selectRentSubtype(subtype) {
    console.log('selectRentSubtype:', subtype);
    currentRentSubtype = subtype;

    document.querySelectorAll('.rent-type-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('rentBtn-' + subtype);
    if (btn) btn.classList.add('active');

    if (subtype === 'Всі') {
      currentDashboardType = 'Оренда';
      document.getElementById('leadsTitle').textContent = '📋 Ліди (🏨 Оренда — Всі)';
    } else {
      currentDashboardType = subtype;
      const emojiMap = { 'Подобова': '🌙', 'Сезонна': '☀️', 'Довгострокова': '📅', 'Управління': '🔑' };
      document.getElementById('leadsTitle').textContent = `📋 Ліди (${emojiMap[subtype] || '🏨'} ${subtype})`;
    }

    loadStats();
    loadLeads();
  }

  function logout() {
    // ⭐ Видаляю тільки дані авторизації, НЕ viewedLeads
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_token');
    // viewedLeads залишається — щоб при повторному вході ліди не світились як нові
    location.reload();
  }

  // ========== ПОКАЗ/СХОВАННЯ ПАРОЛЯ ==========
  function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleBtn = document.getElementById('togglePasswordBtn');

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      passwordInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  }

  // ========== НАЛАШТУВАННЯ КОЛОН ==========
  let visibleColumns = {
    id: true,
    phone: true,
    source: true,
    language: true,
    type: true,
    manager: true,
    stage: true,
    nextContact: true,
    daysLeft: true,
    status: true,
    budget: true,
    district: true,
    metaType: true,
    area: true,
    rooms: true,
    nextAction: true,
    comment: true,
    dateAdded: true
  };

  // Завантажую збережені налаштування
  function loadColumnSettings() {
    const saved = localStorage.getItem('visibleColumns');
    if (saved) {
      visibleColumns = JSON.parse(saved);
      // Встановлюю чекбокси
      Object.keys(visibleColumns).forEach(col => {
        const checkbox = document.getElementById(`col-${col}`);
        if (checkbox) {
          checkbox.checked = visibleColumns[col];
        }
      });
    }
  }

  function toggleColumnSettings() {
    if (isRentMode()) {
      document.getElementById('columnSettingsRentModal').classList.add('active');
    } else if (currentDashboardType === 'Іпотека') {
      document.getElementById('columnSettingsMortgageModal').classList.add('active');
    } else {
      document.getElementById('columnSettingsModal').classList.add('active');
    }
  }

  // ⭐ Окремий об'єкт для видимості колонок Оренди
  let visibleRentColumns = JSON.parse(localStorage.getItem('visibleRentColumns')) || {
    id: true, fullName: true, phone: true, type: true, manager: true, stage: true,
    nextContact: true, daysLeft: true, status: true
  };

  // ⭐ Окремий об'єкт для видимості колонок Нерухомості
  let visibleRealtyColumns = JSON.parse(localStorage.getItem('visibleRealtyColumns')) || {
    id: true, fullName: true, phone: true, type: true, manager: true, stage: true,
    nextContact: true, daysLeft: true, status: true
  };

  function toggleRentColumn(columnName) {
    visibleRentColumns[columnName] = !visibleRentColumns[columnName];
    localStorage.setItem('visibleRentColumns', JSON.stringify(visibleRentColumns));
    
    // Перерендерюю таблицю з новими налаштуваннями
    if (allLeads && allLeads.length > 0) {
      renderRentLeads(allLeads);
    }
  }

  function toggleRealtyColumn(columnName) {
    visibleRealtyColumns[columnName] = !visibleRealtyColumns[columnName];
    localStorage.setItem('visibleRealtyColumns', JSON.stringify(visibleRealtyColumns));
    
    // Перерендерюю таблицю з новими налаштуваннями
    if (allLeads && allLeads.length > 0) {
      renderLeads(allLeads);
    }
  }

  function toggleColumn(columnName) {
    visibleColumns[columnName] = !visibleColumns[columnName];
    localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns));
    
    // Приховую/показую колону
    const colIndex = getColumnIndex(columnName);
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      if (cells[colIndex]) {
        cells[colIndex].style.display = visibleColumns[columnName] ? '' : 'none';
      }
    });
  }

  function getColumnIndex(columnName) {
    const columns = [
      'id', 'phone', 'source', 'language', 'type', 'manager',
      'stage', 'nextContact', 'daysLeft', 'status', 'budget',
      'district', 'metaType', 'area', 'rooms', 'nextAction', 'comment', 'dateAdded'
    ];
    return columns.indexOf(columnName);
  }

  function applyColumnSettings() {
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      Object.keys(visibleColumns).forEach((col, index) => {
        if (cells[index]) {
          cells[index].style.display = visibleColumns[col] ? '' : 'none';
        }
      });
    });
  }

  // ========== ПОШУК І ФІЛЬТР ==========
  // ========== СИНХРОНІЗАЦІЯ ГОРИЗОНТАЛЬНОГО СКРОЛУ ==========
  // ========== СИНХРОНІЗАЦІЯ ГОРИЗОНТАЛЬНОГО СКРОЛУ ==========
  function populateFilters() {
    // Збираю унікальні менеджери, статуси, джерела з лідів
    const managers = [...new Set(allLeads.flatMap(l => (l.manager || '').split(',').map(s => s.trim())).filter(Boolean))].sort();
    const statuses = [...new Set(allLeads.map(l => l.status).filter(Boolean))].sort();
    const sources = [...new Set(allLeads.map(l => l.source).filter(Boolean))].sort();

    // ⭐ ОЧИЩУЮ і перезаповнюю checkboxи менеджерів
    ['managerOptions', 'sidebar_managerOptions'].forEach(id => {
      const managerOptions = document.getElementById(id);
      if (managerOptions) {
        managerOptions.innerHTML = ''; // Очищую
        managers.forEach(m => {
          const div = document.createElement('div');
          div.className = 'filter-option';
          div.innerHTML = `
            <input type="checkbox" class="manager-checkbox" value="${m}" onchange="filterLeads()">
            <label>${m}</label>
          `;
          managerOptions.appendChild(div);
        });
      }
    });

    // ⭐ ОЧИЩУЮ і перезаповнюю checkboxи статусів
    ['statusOptions', 'sidebar_statusOptions'].forEach(id => {
      const statusOptions = document.getElementById(id);
      if (statusOptions) {
        statusOptions.innerHTML = ''; // Очищую
        statuses.forEach(s => {
          const div = document.createElement('div');
          div.className = 'filter-option';
          div.innerHTML = `
            <input type="checkbox" class="status-checkbox" value="${s}" onchange="filterLeads()">
            <label>${s}</label>
          `;
          statusOptions.appendChild(div);
        });
      }
    });

    // ⭐ ОЧИЩУЮ і перезаповнюю checkboxи джерел
    ['sourceOptions', 'sidebar_sourceOptions'].forEach(id => {
      const sourceOptions = document.getElementById(id);
      if (sourceOptions) {
        sourceOptions.innerHTML = ''; // Очищую
        sources.forEach(src => {
          const div = document.createElement('div');
          div.className = 'filter-option';
          div.innerHTML = `
            <input type="checkbox" class="source-checkbox" value="${src}" onchange="filterLeads()">
            <label>${src}</label>
          `;
          sourceOptions.appendChild(div);
        });
      }
    });
    
    // ⭐ Оновлюю етапи для Оренди (інші етапи)
    updateStageFilters();
  }
  
  // ⭐ ФУНКЦІЯ ОНОВЛЕННЯ ЕТАПІВ В ЗАЛЕЖНОСТІ ВІД РОЗДІЛУ
  function updateStageFilters() {
    const stageMenu = document.getElementById('stageMenu');
    if (!stageMenu) return;
    
    // Етапи для Нерухомості
    const realtyStages = [
      { value: 'Етап_1_Контакт', label: 'Етап 1: Контакт' },
      { value: 'Етап_2_Кваліфікація', label: 'Етап 2: Кваліфікація' },
      { value: 'Етап_3_Підбір', label: 'Етап 3: Підбір' },
      { value: 'Етап_4_Покази', label: 'Етап 4: Покази' },
      { value: 'Етап_5_Намір', label: 'Етап 5: Намір' },
      { value: 'Етап_6_Arras', label: 'Етап 6: Arras' },
      { value: 'Етап_7_Юрист', label: 'Етап 7: Юрист' },
      { value: 'Етап_8_Нотаріус', label: 'Етап 8: Нотаріус' },
      { value: 'Етап_9_Після', label: 'Етап 9: Після' }
    ];
    
    // Етапи для Оренди
    const rentStages = [
      { value: 'Етап_1_Контакт', label: 'Етап 1: Контакт' },
      { value: 'Етап_2_Кваліфікація', label: 'Етап 2: Кваліфікація' },
      { value: 'Етап_3_Підбір', label: 'Етап 3: Підбір' },
      { value: 'Етап_4_Покази', label: 'Етап 4: Покази' },
      { value: 'Етап_5_Намір', label: 'Етап 5: Намір' },
      { value: 'Етап_6_Договір', label: 'Етап 6: Договір' },
      { value: 'Етап_7_Заселення', label: 'Етап 7: Заселення' },
      { value: 'Етап_8_Виселення', label: 'Етап 8: Виселення' }
    ];
    
    // Етапи для Іпотеки
    const mortgageStages = [
      { value: 'Етап_1_Контакт', label: 'Етап 1: Контакт' },
      { value: 'Етап_2_Кваліфікація', label: 'Етап 2: Кваліфікація' },
      { value: 'Етап_3_Подача_в_банк', label: 'Етап 3: Подача в банк' },
      { value: 'Етап_4_Схвалення_ліміту', label: 'Етап 4: Схвалення ліміту' },
      { value: 'Етап_5_Підбір', label: 'Етап 5: Підбір' },
      { value: "Етап_6_Оцінка_об'єкта", label: "Етап 6: Оцінка об'єкта" },
      { value: 'Етап_7_FIPER', label: 'Етап 7: FIPER' },
      { value: 'Етап_8_Нотаріус', label: 'Етап 8: Нотаріус' },
      { value: 'Етап_9_Після', label: 'Етап 9: Після' }
    ];

    let stages;
    if (isRentMode()) {
      stages = rentStages;
    } else if (currentDashboardType === 'Іпотека') {
      stages = mortgageStages;
    } else {
      stages = realtyStages;
    }
    
    // Перезаповнюю меню етапів
    stageMenu.innerHTML = `
      <div class="filter-option">
        <input type="checkbox" id="stage-all" class="stage-checkbox" value="" onchange="filterLeads()">
        <label for="stage-all">Всі етапи</label>
      </div>
    `;
    
    stages.forEach(s => {
      const div = document.createElement('div');
      div.className = 'filter-option';
      div.innerHTML = `
        <input type="checkbox" class="stage-checkbox" value="${s.value}" onchange="filterLeads()">
        <label>${s.label}</label>
      `;
      stageMenu.appendChild(div);
    });
  }

  // ===== ФУНКЦІЇ РЕДАГУВАННЯ ЛІДА (SIDEBAR) =====
  document.addEventListener('DOMContentLoaded', function() {
    // ===== УНІВЕРСАЛЬНИЙ ОБРОБНИК ДЛЯ ВСІХ КНОПОК =====
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
      btn.addEventListener('mousedown', function() {
        this.style.transform = 'translateY(0) scale(0.97)';
      });
      btn.addEventListener('mouseup', function() {
        this.style.transform = '';
      });
      btn.addEventListener('mouseleave', function() {
        this.style.transform = '';
      });
    });

    const searchInput = document.getElementById('searchInput');

    // Додаю слухач для пошуку
    if (searchInput) {
      searchInput.addEventListener('input', filterLeads);
    }

    // Ініціалізую toggle меню фільтрів
    setupFilterDropdowns();

    // Ініціалізую мультивибірні фільтри
    setupMultiSelect('manager-checkbox', 'managerMenu');
    setupMultiSelect('stage-checkbox', 'stageMenu');
    setupMultiSelect('status-checkbox', 'statusMenu');
    setupMultiSelect('source-checkbox', 'sourceMenu');

    // ⭐ ЗА ЗАМОВЧУВАННЯМ ДАШБОРД ЗГОРНУТИЙ
    setTimeout(() => {
      const dashboardContent = document.getElementById('dashboardContent');
      const toggleBtn = document.getElementById('toggleDashboard');
      // ⭐ Завжди згортаємо дашборд
      if (dashboardContent && toggleBtn) {
        dashboardContent.classList.add('collapsed');
        toggleBtn.textContent = '+';
        document.body.classList.add('dashboard-collapsed');
      }
    }, 500);

    // ⭐ ДОДАЮ ОБРОБКУ КЛІКУ НА ЕТАПИ В ДАШБОРДІ
    document.querySelectorAll('.stage-card').forEach(card => {
      card.addEventListener('click', function() {
        const stageName = this.getAttribute('data-stage');
        filterLeadsByStage(stageName);
      });
    });
  });

  // ========== МУЛЬТИВИБІР ФІЛЬТРІВ З ТЕГАМИ ==========
  // ========== TOGGLE МЕНЮ ФІЛЬТРІВ ==========
  function setupFilterDropdowns() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');

    dropdowns.forEach(dropdown => {
      const btn = dropdown.querySelector('.filter-btn');
      const menu = dropdown.querySelector('.filter-menu');

      if (!btn || !menu) return;

      // Клік на кнопку
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Закриваю інші меню
        dropdowns.forEach(d => {
          if (d !== dropdown) d.classList.remove('active');
        });
        
        // Toggle поточне меню
        dropdown.classList.toggle('active');
      });

      // Клік на checkbox - не закриваю меню
      const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      });

      // Клік за межами - закриваю
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
    });
  }

  function setupMultiSelect(filterClass, filterMenuId) {
    const checkboxes = document.querySelectorAll(`.${filterClass}`);
    const filterMenu = document.getElementById(filterMenuId);

    if (!filterMenu) return;

    // Функція для обновлення тегів
    function updateTags() {
      // Видаляю існуючі теги
      const existingTags = filterMenu.parentElement.querySelector('.filter-tags');
      if (existingTags) {
        existingTags.remove();
      }

      // Збираю вибрані значення
      const selected = Array.from(checkboxes)
        .filter(cb => cb.checked && cb.value)
        .map(cb => cb.value);

      if (selected.length === 0) return;

      // Створюю контейнер для тегів
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'filter-tags';

      selected.forEach(value => {
        const tag = document.createElement('span');
        tag.className = 'filter-tag';
        tag.innerHTML = `${value} <span class="filter-tag-remove" onclick="removeFilterTag(this, '${filterClass}', '${value}')">✕</span>`;
        tagsContainer.appendChild(tag);
      });

      filterMenu.parentElement.appendChild(tagsContainer);
    }

    // Додаю слухачей для всіх checkboxів
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        // Якщо це чекбокс "Всі", розчистити інші
        if (this.id && this.id.includes('-all') && this.checked) {
          checkboxes.forEach(cb => {
            if (cb !== this) cb.checked = false;
          });
        }
        // Якщо вибрав конкретний, розчистити "Всі"
        else if (this.checked && this.value) {
          const allCheckbox = filterMenu.querySelector('[id*="-all"]');
          if (allCheckbox) allCheckbox.checked = false;
        }

        updateTags();
        filterLeads();
      });
    });

    updateTags();
  }

  // Функція для видалення тега
  window.removeFilterTag = function(element, filterClass, value) {
    const checkbox = document.querySelector(`.${filterClass}[value="${value}"]`);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));
    }
  };

  function toggleFiltersPanel() {
    // ⭐ ЗАМІСТЬ СТАРОЇ ПАНЕЛІ - ВІДКРИВАЄМО САЙДБАР
    openFiltersSidebar();
  }


  function resetAllFilters() {
    // ⭐ Скидаю всі checkboxи
    document.querySelectorAll('.manager-checkbox, .stage-checkbox, .budget-checkbox, .status-checkbox, .source-checkbox').forEach(cb => {
      cb.checked = false;
    });
    
    // ⭐ Скидаю пошук
    document.getElementById('searchInput').value = '';
    
    // ⭐ Скидаю обраний етап
    selectedStage = null;
    
    // ⭐ Очищаю всі теги
    document.querySelectorAll('.filter-tag').forEach(tag => tag.remove());
    
    // ⭐ Фільтрую (показує ВСІ ліди)
    filterLeads();
  }

  // ========== АДМІН ПАНЕЛЬ - УПРАВЛІННЯ МЕНЕДЖЕРАМИ ==========
  function toggleAddManagerForm() {
    const role = localStorage.getItem('user_role');
    
    // ТІЛЬКИ ADMIN МОЖЕ ВІДКРИТИ
    if (role !== 'Admin') {
      alert('⛔ Тільки адміністратори можуть управляти менеджерами!');
      return;
    }
    
    // ⭐ ЗАМІСТЬ СТАРОЇ ПАНЕЛІ - ВІДКРИВАЄМО САЙДБАР
    openManagerSidebar();
  }

  function loadAdminManagersList() {
    console.log('📋 Завантажаю список менеджерів для адміна...');
    
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAllUsers', payload: {} })
    })
    .then(r => r.json())
    .then(result => {
      const listContainer = document.getElementById('adminManagersList');
      
      if (result.success && result.users && result.users.length > 0) {
        const managers = result.users.filter(u => u.role === 'Manager' || u.role === 'Admin');
        
        if (managers.length > 0) {
          const currentUserEmail = localStorage.getItem('user_email') || '';
          listContainer.innerHTML = managers.map(m => {
            const isSelf = m.email === currentUserEmail;
            const nextRole = m.role === 'Admin' ? 'Manager' : 'Admin';
            const roleBtnLabel = m.role === 'Admin' ? '⬇️ В Менеджери' : '⬆️ В Адміни';
            const roleBtn = isSelf
              ? `<button disabled title="Не можна змінити роль самому собі" style="
                  background: #ccc;
                  color: #fff;
                  border: none;
                  padding: 0.5rem 0.8rem;
                  border-radius: 4px;
                  cursor: not-allowed;
                  font-size: 0.85rem;
                ">🔒 Це ви</button>`
              : `<button onclick="changeUserRole('${m.email}', '${m.name.replace(/'/g, "\\'")}', '${nextRole}')" style="
                  background: #4472C4;
                  color: white;
                  border: none;
                  padding: 0.5rem 0.8rem;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.85rem;
                ">${roleBtnLabel}</button>`;
            return `
            <div style="
              background: #f8f8f8;
              padding: 0.8rem;
              border-radius: 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-left: 4px solid #4472C4;
              gap: 0.5rem;
            ">
              <div>
                <strong>👤 ${m.name}</strong><br>
                <small style="color: #666;">📧 ${m.email}</small><br>
                <small style="color: #999;">Роль: ${m.role}</small>
              </div>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end;">
                ${roleBtn}
                <button onclick="deleteManager('${m.email}')" style="
                  background: #ff6b6b;
                  color: white;
                  border: none;
                  padding: 0.5rem 0.8rem;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.85rem;
                ">🗑️ Видалити</button>
              </div>
            </div>
          `;
          }).join('');
          
          console.log(`✅ Завантажено ${managers.length} менеджерів`);
        } else {
          listContainer.innerHTML = '<div style="color: #999; text-align: center;">Менеджери не знайдені</div>';
        }
      } else {
        listContainer.innerHTML = '<div style="color: #ff6b6b; text-align: center;">❌ Помилка завантаження</div>';
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      document.getElementById('adminManagersList').innerHTML = '<div style="color: #ff6b6b;">❌ Помилка мережі</div>';
    });
  }

  function addNewManager() {
    const email = document.getElementById('adminNewManagerEmail').value.trim();
    const name = document.getElementById('adminNewManagerName').value.trim();
    const password = document.getElementById('adminNewManagerPassword').value.trim();
    const role = document.getElementById('adminNewManagerRole').value; // ✅ БЕРУ РОЛЬ З DROPDOWN
    
    if (!email || !name || !password) {
      alert('❌ Заповніть всі поля!');
      return;
    }
    
    console.log('➕ Додаю користувача:', name, email, 'Роль:', role);
    
    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'addUser',
        payload: {
          email: email,
          name: name,
          password: password,  // ✅ ДОДАВ ПАРОЛЬ
          role: role           // ✅ ДИНАМІЧНА РОЛЬ
        }
      })
    })
    .then(r => r.json())
    .then(result => {
      console.log('Результат addUser:', result);
      
      if (result.success) {
        alert(`✅ ${role === 'Admin' ? 'Адміністратор' : 'Менеджер'} ${name} успішно додан!`);
        
        // Очищаю форму
        document.getElementById('adminNewManagerEmail').value = '';
        document.getElementById('adminNewManagerName').value = '';
        document.getElementById('adminNewManagerPassword').value = '';
        document.getElementById('adminNewManagerRole').value = 'Manager';
        
        // Перезавантажаю список
        loadAdminManagersList();
        loadManagers(); // ✅ ОНОВЛЮЮ МЕНЕДЖЕРІВ В DROPDOWN ЛІДІВ
      } else {
        alert('❌ Помилка: ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      alert('❌ Помилка мережі: ' + e.message);
    });
  }

  function deleteManager(email) {
    if (!confirm(`⚠️ Ви впевнені що хочете видалити менеджера?`)) {
      return;
    }

    console.log('🗑️ Видаляю менеджера:', email);

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteUser',
        payload: { email: email }
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        alert('✅ Менеджер видален!');
        loadAdminManagersList();
      } else {
        alert('❌ Помилка: ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      alert('❌ Помилка мережі: ' + e.message);
    });
  }

  function changeUserRole(email, name, newRole) {
    // Захист: не дозволяємо змінити роль самому собі
    const currentUserEmail = localStorage.getItem('user_email') || '';
    if (email === currentUserEmail) {
      alert('❌ Не можна змінити роль самому собі!');
      return;
    }

    if (newRole !== 'Admin' && newRole !== 'Manager') {
      alert('❌ Невідома роль: ' + newRole);
      return;
    }

    const roleLabel = newRole === 'Admin' ? 'Адміністратор' : 'Менеджер';
    if (!confirm(`Змінити роль користувача "${name}" на "${roleLabel}"?`)) {
      return;
    }

    console.log('🔄 Змінюю роль:', email, '->', newRole);

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateUser',
        payload: { email: email, role: newRole }
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        alert(`✅ Роль змінено на "${roleLabel}"!`);
        loadAdminManagersList();
        loadManagers(); // Оновлюю dropdown менеджерів
      } else {
        alert('❌ Помилка: ' + (result.error || 'Невідома помилка'));
      }
    })
    .catch(e => {
      console.error('❌ Помилка:', e);
      alert('❌ Помилка мережі: ' + e.message);
    });
  }

  function filterLeads() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();

    console.log('🔍 Пошук:', search);
    console.log('📊 Всього лідів:', allLeads.length);

    // Збираю вибрані значення з checkboxів (мультивибір)
    const filterTableManagers = Array.from(document.querySelectorAll('.manager-checkbox:checked'))
      .map(el => el.value)
      .filter(v => v);

    const selectedStages = Array.from(document.querySelectorAll('.stage-checkbox:checked'))
      .map(el => el.value)
      .filter(v => v);

    const selectedBudgets = Array.from(document.querySelectorAll('.budget-checkbox:checked'))
      .map(el => parseInt(el.value))
      .filter(v => v > 0);

    const selectedStatuses = Array.from(document.querySelectorAll('.status-checkbox:checked'))
      .map(el => el.value)
      .filter(v => v);

    const selectedSources = Array.from(document.querySelectorAll('.source-checkbox:checked'))
      .map(el => el.value)
      .filter(v => v);

    let filtered = allLeads;

    // ⭐ ФІЛЬТР ПО ПОШУКУ - ДЕТАЛЬНИЙ
    if (search) {
      filtered = filtered.filter(l => {
        const matchId = l.id && String(l.id).toLowerCase().includes(search);
        const matchPhone = l.phone && String(l.phone).toLowerCase().replace(/\s+/g, '').includes(search.replace(/\s+/g, ''));
        const matchManager = l.manager && String(l.manager).toLowerCase().includes(search);
        const matchSource = l.source && String(l.source).toLowerCase().includes(search);
        const matchDistrict = l.district && String(l.district).toLowerCase().includes(search);
        const matchComment = l.comment && String(l.comment).toLowerCase().includes(search);
        
        return matchId || matchPhone || matchManager || matchSource || matchDistrict || matchComment;
      });

      console.log('✅ Знайдено після пошуку:', filtered.length);
    }

    // Фільтр по етапам
    if (selectedStages.length > 0) {
      filtered = filtered.filter(l => selectedStages.includes(l.stage));
    }

    // ⭐ ВИПРАВЛЕНО: Фільтр по менеджерам (підтримка мульти-менеджер)
    if (filterTableManagers.length > 0) {
      filtered = filtered.filter(l => {
        const leadMgrs = (l.manager || 'Не назначено').split(',').map(s => s.trim());
        return leadMgrs.some(m => filterTableManagers.includes(m));
      });
    }

    // ⭐ ВИПРАВЛЕНО: Фільтр по бюджетам (парсинг текстових значень)
    if (selectedBudgets.length > 0) {
      filtered = filtered.filter(l => {
        const leadBudget = parseBudgetForFilter(l.budget);
        // Перевіряю чи бюджет ліда менший або рівний вибраному ліміту
        return selectedBudgets.some(limit => leadBudget <= limit);
      });
    }

    // Фільтр по статусам
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(l => selectedStatuses.includes(l.status));
    }

    // Фільтр по джерелам
    if (selectedSources.length > 0) {
      filtered = filtered.filter(l => selectedSources.includes(l.source));
    }

    console.log('📋 Фінальний результат:', filtered.length, filtered);

    // ⭐ Показую скільки лідів знайдено
    const filteredCount = document.getElementById('filteredCount');
    if (filtered.length === allLeads.length) {
      filteredCount.textContent = `Всього: ${filtered.length} лідів`;
    } else {
      filteredCount.textContent = `Показано: ${filtered.length} з ${allLeads.length} лідів`;
    }

    renderLeads(filtered);
  }
  
  // ⭐ ФУНКЦІЯ ПАРСИНГУ БЮДЖЕТУ ДЛЯ ФІЛЬТРА
  function parseBudgetForFilter(budgetString) {
    if (!budgetString) return 0;
    budgetString = String(budgetString).trim();
    
    // Прибираю всі символи крім цифр і дефісів
    // Замінюю різні типи дефісів на звичайний
    budgetString = budgetString.replace(/[–—−]/g, '-');
    
    // Якщо є k (тисячі) - множу на 1000
    if (budgetString.toLowerCase().includes('k')) {
      const match = budgetString.match(/(\d+)\s*k/i);
      if (match) {
        return parseInt(match[1]) * 1000;
      }
    }
    
    // Якщо є діапазон (100-200 або 100 - 200) - беру верхню межу
    if (budgetString.includes('-')) {
      const parts = budgetString.replace(/[^\d\-]/g, '').split('-').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return parseInt(parts[parts.length - 1]) || 0;
      }
    }
    
    // Просто число
    const cleaned = budgetString.replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  }

// ============================================
// МОБІЛЬНА АДАПТАЦІЯ v3
// ============================================

(function() {
    'use strict';

    // ============ 1. АВАТАРКА: ініціали + дропдаун ============
    var avatarBtn = document.getElementById('mobileAvatarBtn');
    var avatarDropdown = document.getElementById('mobileAvatarDropdown');
    var avatarInitials = document.getElementById('mobileAvatarInitials');
    var avatarName = document.getElementById('mobileAvatarName');
    var avatarRole = document.getElementById('mobileAvatarRole');

    function getInitials(name) {
        if (!name) return '?';
        var clean = name.replace(/^👤\s*/, '').trim();
        var parts = clean.split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function syncAvatar() {
        var nameEl = document.getElementById('userName');
        var roleEl = document.getElementById('userRole');
        var rawName = nameEl ? nameEl.textContent.replace(/^👤\s*/, '').trim() : '';
        var rawRole = roleEl ? roleEl.textContent.trim() : '';
        if (avatarInitials) avatarInitials.textContent = getInitials(rawName);
        if (avatarName) avatarName.textContent = rawName || 'Користувач';
        if (avatarRole) avatarRole.textContent = rawRole || 'Менеджер';
    }

    // Синхронізуємо при завантаженні + спостерігаємо за змінами userName
    syncAvatar();
    var userNameEl = document.getElementById('userName');
    if (userNameEl) {
        new MutationObserver(syncAvatar).observe(userNameEl, { childList: true, characterData: true, subtree: true });
    }

    if (avatarBtn) {
        avatarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            avatarDropdown.classList.toggle('open');
        });
    }
    document.addEventListener('click', function() {
        if (avatarDropdown) avatarDropdown.classList.remove('open');
    });

    // ============ 2. КАРТОЧКИ ЛІДІВ ============
    var cardsContainer = document.getElementById('mobileCards');
    var tbody = document.getElementById('leadsTable');

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function buildCards() {
        if (!cardsContainer || !isMobile()) return;

        var thead = document.getElementById('leadsTableHead');
        if (!thead) return;

        // Читаємо заголовки колонок
        var ths = thead.querySelectorAll('th');
        var headers = [];
        for (var i = 0; i < ths.length; i++) {
            headers.push(ths[i].textContent.trim());
        }

        // Знаходимо індекси потрібних колонок
        var colMap = {};
        var labelMap = {
            'ID': 'id', 'ПІБ': 'name', 'Телефон': 'phone', 'Тип': 'type',
            'Менеджер': 'manager', 'Поточний Етап': 'stage', 'Наступний контакт': 'nextContact',
            'Днів залиш.': 'daysLeft', 'Статус': 'status', 'Бюджет': 'budget',
            'Район': 'district', 'Дії': 'actions'
        };
        for (var h = 0; h < headers.length; h++) {
            var key = labelMap[headers[h]];
            if (key) colMap[key] = h;
        }

        // Шукаємо рядки (тільки основні, без деталей)
        var rows = tbody.querySelectorAll('tr.realty-lead-row, tr.rent-lead-row');
        if (rows.length === 0) {
            // Можливо, ще загружається або немає лідів
            var allRows = tbody.querySelectorAll('tr');
            if (allRows.length === 1 && allRows[0].querySelector('td[colspan]')) {
                cardsContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">' +
                    allRows[0].querySelector('td').textContent + '</div>';
                return;
            }
            if (allRows.length === 0) {
                cardsContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#999;">Немає лідів</div>';
                return;
            }
        }

        var html = '';
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var tds = row.querySelectorAll('td');
            var leadId = row.getAttribute('data-lead-id') || '';
            var leadIndex = row.getAttribute('data-lead-index') || '';
            var isRent = row.classList.contains('rent-lead-row');

            function cellText(key) {
                var idx = colMap[key];
                if (idx === undefined || idx >= tds.length) return '';
                return tds[idx].textContent.trim();
            }

            var name = cellText('name') || cellText('phone') || 'Без імені';
            var phone = cellText('phone');
            var type = cellText('type');
            var manager = cellText('manager');
            var stage = cellText('stage');
            var daysLeft = cellText('daysLeft');
            var status = cellText('status');
            var id = cellText('id') || leadId;

            // Бюджет може бути у деталях, беремо якщо є колонка
            var budget = cellText('budget');
            var district = cellText('district');

            // Класи карточки
            var cardClasses = 'mobile-lead-card';
            if (row.classList.contains('lead-unassigned')) cardClasses += ' card-unassigned';
            if (row.classList.contains('lead-new')) cardClasses += ' card-new';

            // Днів залишилось — стиль
            var daysClass = '';
            var daysNum = parseInt(daysLeft);
            if (!isNaN(daysNum)) {
                daysClass = daysNum < 0 ? 'overdue' : 'on-time';
            }

            // Отримуємо джерело та менеджера з leadsCache (бо колонки можуть бути приховані)
            var source = '';
            var managerFromCache = '';
            if (typeof leadsCache !== 'undefined' && leadsCache[parseInt(leadIndex)]) {
                var cachedLead = leadsCache[parseInt(leadIndex)];
                source = cachedLead.source || '';
                managerFromCache = cachedLead.manager || '';
            }
            // Якщо з кешу є — пріоритет кешу, інакше з таблиці
            if (managerFromCache) manager = managerFromCache;

            html += '<div class="' + cardClasses + '" data-lead-id="' + leadId +
                '" data-lead-index="' + leadIndex + '" data-is-rent="' + (isRent ? '1' : '0') + '">';

            // Ряд 0: ID зліва + Джерело справа (окремий рядок, нічого не налазить)
            html += '<div class="mobile-card-header">';
            html += '<span class="mobile-card-id" onclick="event.stopPropagation(); navigator.clipboard.writeText(\'' + escapeHtml(id) + '\'); this.textContent=\'Скопійовано!\'; var el=this; setTimeout(function(){el.textContent=\'#' + escapeHtml(id) + '\';},1200);">#' + escapeHtml(id) + '</span>';
            if (source) html += '<span class="mobile-card-source">' + escapeHtml(source) + '</span>';
            html += '</div>';

            // Ряд 1: Ім'я + Етап
            html += '<div class="mobile-card-row">';
            html += '<span class="mobile-card-name">' + escapeHtml(name) + '</span>';
            if (stage) html += '<span class="mobile-card-stage">' + escapeHtml(stage) + '</span>';
            html += '</div>';

            // Ряд 2: Телефон + Менеджер (виразно)
            html += '<div class="mobile-card-row">';
            if (phone) html += '<span class="mobile-card-phone">' + escapeHtml(phone) + '</span>';
            var isUnassigned = !manager || manager === '❌ Не назначено' || manager.indexOf('Не назначено') !== -1;
            if (isUnassigned) {
                html += '<span class="mobile-card-manager mobile-card-manager-none">не призн.</span>';
            } else if (manager) {
                html += '<span class="mobile-card-manager">' + escapeHtml(manager) + '</span>';
            }
            html += '</div>';

            // Ряд 3: Бюджет · Район + Днів
            html += '<div class="mobile-card-row mobile-card-bottom">';
            html += '<span class="mobile-card-budget">' + (budget ? escapeHtml(budget) : '') +
                (district ? ' · ' + escapeHtml(district) : '') + '</span>';
            if (daysLeft) {
                html += '<span class="mobile-card-days ' + daysClass + '">' +
                    escapeHtml(daysLeft) + ' дн.</span>';
            }
            html += '</div>';

            // Блок деталей (прихований, розгортається по кліку)
            html += '<div class="mobile-card-details" style="display:none;"></div>';

            html += '</div>';
        }

        cardsContainer.innerHTML = html;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Обробник кліків на карточки — розгортка деталей (як на ПК)
    if (cardsContainer) {
        cardsContainer.addEventListener('click', function(e) {
            // Не реагуємо на клік по ID (він копіює)
            if (e.target.classList.contains('mobile-card-id')) return;
            // Не реагуємо на кнопки редагування/видалення
            if (e.target.closest('.mobile-card-actions-btn')) return;

            var card = e.target.closest('.mobile-lead-card');
            if (!card) return;

            var leadIndex = parseInt(card.getAttribute('data-lead-index'));
            var detailsDiv = card.querySelector('.mobile-card-details');
            if (!detailsDiv) return;

            // Toggle деталей
            if (detailsDiv.style.display !== 'none') {
                detailsDiv.style.display = 'none';
                card.classList.remove('card-expanded');
                return;
            }

            // Закриваю інші відкриті деталі
            cardsContainer.querySelectorAll('.mobile-card-details').forEach(function(d) {
                d.style.display = 'none';
            });
            cardsContainer.querySelectorAll('.mobile-lead-card').forEach(function(c) {
                c.classList.remove('card-expanded');
            });

            // Генерую деталі з leadsCache
            if (typeof leadsCache !== 'undefined' && leadsCache[leadIndex]) {
                var lead = leadsCache[leadIndex];
                var isRent = card.getAttribute('data-is-rent') === '1';

                var detHtml = '<div class="mobile-details-grid">';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Джерело</span><span class="mobile-detail-value">' + escapeHtml(lead.source || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Мова</span><span class="mobile-detail-value">' + escapeHtml(lead.language || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Бюджет</span><span class="mobile-detail-value">' + escapeHtml(lead.budget || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Район</span><span class="mobile-detail-value">' + escapeHtml(lead.district || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Мета/Тип</span><span class="mobile-detail-value">' + escapeHtml(lead.metaType || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Площа</span><span class="mobile-detail-value">' + escapeHtml(lead.area || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Кімнати</span><span class="mobile-detail-value">' + escapeHtml(lead.rooms || '—') + '</span></div>';
                detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Наступна дія</span><span class="mobile-detail-value">' + escapeHtml(lead.nextAction || '—') + '</span></div>';

                if (isRent) {
                    detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Заїзд</span><span class="mobile-detail-value">' + escapeHtml(lead.checkIn || '—') + '</span></div>';
                    detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Виїзд</span><span class="mobile-detail-value">' + escapeHtml(lead.checkOut || '—') + '</span></div>';
                    detHtml += '<div class="mobile-detail-item"><span class="mobile-detail-label">Гостей</span><span class="mobile-detail-value">' + escapeHtml(lead.guests || '—') + '</span></div>';
                }

                detHtml += '<div class="mobile-detail-item mobile-detail-comment"><span class="mobile-detail-label">Коментар</span><span class="mobile-detail-value">' + escapeHtml(lead.comment || '—') + '</span></div>';
                detHtml += '</div>';

                // Кнопки дій
                detHtml += '<div class="mobile-card-actions">';
                detHtml += '<button class="mobile-card-actions-btn mobile-card-edit-btn" data-lead-index="' + leadIndex + '" data-is-rent="' + (isRent ? '1' : '0') + '">✏️ Редагувати</button>';
                detHtml += '</div>';

                detailsDiv.innerHTML = detHtml;
                detailsDiv.style.display = 'block';
                card.classList.add('card-expanded');

                // Кнопка редагування в деталях
                var editBtn = detailsDiv.querySelector('.mobile-card-edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        var idx = parseInt(this.getAttribute('data-lead-index'));
                        var rent = this.getAttribute('data-is-rent') === '1';
                        if (typeof leadsCache !== 'undefined' && leadsCache[idx]) {
                            try {
                                if (rent && typeof openEditSidebarRent === 'function') {
                                    openEditSidebarRent(leadsCache[idx]);
                                } else if (typeof openEditSidebarDirect === 'function') {
                                    openEditSidebarDirect(leadsCache[idx]);
                                }
                            } catch (err) {
                                console.error('Edit btn error:', err);
                            }
                        }
                    });
                }
            }
        });
    }

    // ============ 3. MUTATION OBSERVER: стежимо за таблицею ============
    if (tbody) {
        var debounceTimer;
        var observer = new MutationObserver(function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(buildCards, 100);
        });
        observer.observe(tbody, { childList: true, subtree: true });
    }

    // Перебудовуємо при зміні розміру (десктоп ↔ мобілка)
    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (isMobile()) {
                buildCards();
            }
        }, 200);
    });

    // Перша побудова
    if (isMobile()) {
        setTimeout(buildCards, 500);
    }
})();
