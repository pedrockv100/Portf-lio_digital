# Portfólio Digital CEUNSP

Projeto acadêmico responsivo feito com HTML5, CSS3 e JavaScript puro.

Esta versão foi organizada para evitar arquivos duplicados: o site usa diretamente os arquivos da raiz, sem uma segunda cópia em `dist/`.

## Estrutura

```text
Portfólio_digital_LIMPO/
├── index.html
├── admin/
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── assets/
│   ├── icons/
│   └── images/
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── config.js
│   ├── courses.js
│   ├── projects.js
│   └── supabase.js
├── supabase/
│   └── schema.sql
└── README.md
```

## Abrir o site

A forma mais simples no VS Code é abrir esta pasta e usar a extensão **Live Server** no `index.html`.

Também é possível iniciar um servidor local pelo terminal, dentro da pasta do projeto:

```powershell
python -m http.server 5500
```

Depois acesse:

- Site: `http://localhost:5500/`
- Painel: `http://localhost:5500/admin/`

## Supabase

O projeto continua com os arquivos de integração e com `supabase/schema.sql` para não perder nenhuma funcionalidade existente. Se as credenciais em `js/config.js` estiverem vazias, o painel mantém o modo de demonstração/local já existente.

## Importante

Não existe mais a pasta `dist/` nem scripts que recriem uma cópia do projeto. Edite somente os arquivos destas pastas principais; assim não há risco de alterar uma cópia e abrir outra por engano.
