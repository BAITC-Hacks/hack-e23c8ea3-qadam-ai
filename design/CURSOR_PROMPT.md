Прочитай design/DESIGN.md и .cursor/rules/qadam-design.mdc. Перенеси design/QadamPrototype.jsx во front/:

1. Установка по DESIGN.md §1: tailwindcss v4 + @tailwindcss/vite, lucide-react, шрифты Rubik/Onest/JetBrains Mono в index.html, новый src/index.css. Удали старый каркас (App.css, components/Header*, Footer*, Layout.jsx, pages/Home*).
2. Сначала быстрый старт: скопируй прототип в src/, отрендери в App.jsx и убедись, что `npm run dev` работает без ошибок.
3. Затем разбей по DESIGN.md §6: логику в src/lib (scoring.js, ai.js), данные в src/data/seed.js, i18n в src/i18n (kk/ru/en + useT), состояние в src/store, UI — в components/ и features/.
4. Дизайн, тексты и поведение не меняй. Перенеси все оставшиеся русские строки интерфейса в словари i18n (DESIGN.md §4a), казахский и английский переводы добавь по образцу.
5. Проверь демо-сценарий DESIGN.md §7 целиком на десктопе и на ширине 390px.
