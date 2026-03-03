# INVEST LIFE CRM

CRM система для управління лідами нерухомості та оренди.

## Структура проекту

| Файл | Опис |
|---|---|
| `index.html` | HTML розмітка (логін, таблиці, сайдбари, модалки) |
| `styles.css` | Всі стилі + мобільна адаптація |
| `app.js` | Вся JS логіка (API, рендеринг, утиліти, мобілка) |
| `APPSestate.txt` | Google Apps Script бекенд — Нерухомість |
| `APPSoernda.txt` | Google Apps Script бекенд — Оренда |
| `index(exp2).html` | Старий монолітний файл (не використовується) |

## API ендпоінти

- **Нерухомість:** `https://script.google.com/macros/s/AKfycbzUFoaCa7dvOUrznW_0pHfV_W72jaNxD1Tw1fGCsoY_Q-mdNYjdOlxt_nbeFEDi2y_riw/exec`
- **Оренда:** `https://script.google.com/macros/s/AKfycbw8eSq8QVd2fxeXeU_blzLLOVUAIpz-wMiL6AFNMx98MZDLD8_lqGesmFWs8qHevck/exec`

## Типи лідів

- **Нерухомість** (APPSestate): Купівля, Продаж, Консультація
- **Оренда** (APPSoernda): Подобова, Сезонна, Довгострокова, Управління

Який API використовується визначається по `RENT_TYPES` в `app.js`.

## Колонки Google Sheets

### Нерухомість (A-T)
A=ID, B=Телефон, C=Джерело, D=Мова, E=Тип, F=Менеджер, G=Етап, H=Дата контакту, I=Днів(формула), J=Статус(формула), K=Бюджет, L=Район, M=Мета/Тип, N=Площа, O=Кімнати, P=Next Action, Q=Коментар, R=Дата додавання, S=ПІБ, T=ВИДАЛЕНО

### Оренда (A-W)
A=ID, B=Телефон, C=Джерело, D=Мова, E=Тип, F=Менеджер, G=Етап, H=Дата контакту, I=Днів(формула), J=Статус(формула), K=Бюджет, L=Кімнати/Стан, M=Тварини/Формат, N=Люди, O=Термін/Тип, P=Дата/Сезон, Q=Район, R=Наступна дія, S=Коментар, T=Дата додавання, U=Час контакту, V=ПІБ, W=ВИДАЛЕНО

## Ключові функції в app.js

- `dateToInputValue(dateStr)` / `formatDateSafe(dateStr)` — безпечна конвертація дат (без UTC-зсуву)
- `renderRealtyLeads(leads)` — рендеринг таблиці нерухомості
- `renderRentLeads(leads)` — рендеринг таблиці оренди
- `openEditSidebar(lead)` — сайдбар редагування (нерухомість)
- `openEditSidebarRent(lead)` — сайдбар редагування (оренда)
- `loadLeads()` — завантаження лідів з API

## Ролі користувачів

- **Admin** — бачить всіх лідів, може керувати менеджерами
- **Manager** — бачить тільки своїх лідів

## Важливі нюанси

- Дати з Google Sheets приходять як ISO UTC строки. На бекенді `safeDateStr()` конвертує їх в `yyyy-MM-dd` через `Utilities.formatDate()` з таймзоною спредшита. На фронтенді `dateToInputValue()` та `formatDateSafe()` використовують `Math.round` до найближчої доби як fallback.
- Етапи нерухомості: 1-9 (Контакт → Після)
- Етапи оренди: 1-8 (Контакт → Виселення)
- М'яке видалення: колонка T(нерухомість) або W(оренда) = "ВИДАЛЕНО"
