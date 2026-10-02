# Portfólio Digital CEUNSP

Site acadêmico responsivo, feito com HTML5, CSS3 e JavaScript puro. A versão atual inclui o projeto real Reward Library, cinco projetos demonstrativos e três cursos, sem depender do Supabase.

## Visualizar localmente

Abra esta pasta com o Live Server ou inicie um servidor local:

```powershell
python -m http.server 5500
```

Depois acesse `http://localhost:5500`. O painel fica em `http://localhost:5500/admin/`.

## Informações acadêmicas atuais

- Curso: Análise e Desenvolvimento de Sistemas.
- Disciplina: Análise e Projeto de Sistemas II.
- Professora: Prof.ª Waldinelly Martha Alves Costa.
- O coordenador permanece como `A definir`.
- Os três cursos participantes ficam em `js/courses.js`.
- Os seis projetos fictícios ficam em `js/projects.js`.

## Conectar ao Supabase

1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor. O script cria as tabelas, índices, políticas RLS e o bucket público `project-images`.
3. Em `js/config.js`, preencha apenas `SUPABASE_URL` e a chave publicável/anon. Nunca use `service_role` ou uma chave secreta no navegador.
4. Crie o usuário responsável no Supabase Auth.
5. Pelo Dashboard ou por uma rotina segura no servidor, adicione `{ "role": "admin" }` ao `app_metadata` desse usuário. Não use `user_metadata` para autorização.
6. Para atualização automática entre o painel e a vitrine, habilite Realtime para a tabela `public.projects` em Database > Replication.

Quando as credenciais estão vazias, o painel funciona em modo de demonstração e mantém alterações no `localStorage` do navegador. Quando o Supabase está configurado, o painel exige login e as políticas de banco impedem escrita por visitantes comuns.

## Estrutura

```text
portfolio-ceunsp/
├── index.html
├── css/
├── js/
├── admin/
├── assets/
├── supabase/schema.sql
├── scripts/build.mjs
├── .env.example
└── README.md
```

## Publicação estática

O comando abaixo gera a pasta `dist`, usada pela publicação:

```powershell
node scripts/build.mjs
```

O projeto não usa React, Vue ou qualquer outro framework.
