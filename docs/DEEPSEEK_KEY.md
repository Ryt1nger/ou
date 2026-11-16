# Куда вставить ключ DeepSeek

**Не вставляйте DeepSeek API key в GitHub, HTML, JavaScript, README, GitHub Issues или коммиты.**

## Локально

1. Создайте `.env` в корне проекта рядом с `compose.yaml` из `.env.example`.
2. Впишите свой ключ в строку `DEEPSEEK_API_KEY=...`.
3. Запустите `docker compose up --build`.
4. Проверьте `http://localhost:8000/api/health` — поле `api_configured` должно быть `true`.

## На Vercel

Откройте https://vercel.com/dashboard → выберите **ваш проект LEX** → **Settings → Environment Variables** → **Add New**.
Добавьте переменные:

- `DEEPSEEK_API_KEY` — значение ключа; тип Secret/Sensitive при наличии.
- `DEEPSEEK_BASE_URL` = `https://api.deepseek.com`
- `DEEPSEEK_MODEL` = `deepseek-flash`
- `DEMO_ACCESS_CODE` — отдельный секретный пароль доступа к чату для защиты вашего баланса API.

Примените переменные к **Production** и сделайте **Redeploy**. GitHub Secrets не заменяют переменные Vercel.

## На Render

Откройте https://dashboard.render.com/ → ваш сервис → **Environment → Add Environment Variable**.
Введите те же переменные, сохраните и выполните Deploy, если он не запустился сам.

## Публикация без ключа

В статическом демо представлены только подготовленные примеры. Оно не вызывает DeepSeek и не принимает ключ в браузере. Для реальных ответов необходим сервер с настроенным ключом.
