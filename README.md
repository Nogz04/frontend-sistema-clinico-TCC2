# Instruções de instalação e execução do sistema web de apoio à decisão clínica

Sistema Web de Apoio à Documentação Clínica com Transcrição de Fala e IA para Prontuários no Padrão SOAP

**Matheus Nogueira Albuquerque** — Ciência da Computação, Universidade Franciscana (UFN)

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Programas necessários](#2-programas-necessários)
3. [Backend](#3-backend)
4. [Frontend](#4-frontend)
5. [Primeiro acesso: criar o primeiro médico](#5-primeiro-acesso-criar-o-primeiro-médico)
6. [Primeiro uso](#6-primeiro-uso)
7. [Resumo dos comandos](#7-resumo-dos-comandos)
8. [Sobre o frontend](#8-sobre-o-frontend)

## 1. Visão geral

Este documento ensina a executar o meu sistema *web* de apoio à decisão clínica (SADC), desenvolvido como meu Trabalho de Conclusão de Curso (TCC), e explica como baixá-lo e configurá-lo. O sistema tem duas aplicações, cada uma em um repositório do GitHub (Tabela 1), e as duas precisam estar rodando ao mesmo tempo.

**Tabela 1: Aplicações do sistema e seus repositórios**

| Aplicação | Tecnologias | Repositório |
|---|---|---|
| Backend (API) | Java 21, Spring Boot, MySQL | <https://github.com/Nogz04/backend-sistema-clinico-TCC2> |
| Frontend (telas) | HTML, CSS e JavaScript | <https://github.com/Nogz04/frontend-sistema-clinico-TCC2> |

A ordem de execução é: primeiro o backend, na porta 8080, e depois o frontend, na porta 5500.

## 2. Programas necessários

Antes de começar, instale os programas da Tabela 2. A última coluna mostra como conferir se cada um está instalado.

**Tabela 2: Programas necessários**

| Programa | Para que serve | Como conferir |
|---|---|---|
| Git (<https://git-scm.com/downloads>) | Baixar (clonar) os repositórios | `git --version` |
| JDK 21 (<https://adoptium.net>) | Executar o backend | `java -version` |
| MySQL 8 (<https://dev.mysql.com/downloads/mysql/>) | Banco de dados | `mysql --version` |
| Python 3, ou Visual Studio Code com a extensão Live Server, ou Node.js (basta um deles) | Servir o frontend ([Seção 4.2](#42-executar-o-frontend)) | `python --version` |
| Google Chrome ou Microsoft Edge | Usar o sistema; o ditado por voz funciona nesses navegadores | — |

O comando `java -version` deve mostrar a versão 21. Não é preciso instalar o Maven, porque o projeto já inclui o Maven Wrapper (`mvnw`).

## 3. Backend

### 3.1 Baixar o código

O repositório do backend fica em <https://github.com/Nogz04/backend-sistema-clinico-TCC2>. O README da página descreve o projeto e a configuração segura, e este documento o complementa.

Abra um terminal (no Windows, o PowerShell) na pasta onde o projeto ficará e execute:

```powershell
git clone https://github.com/Nogz04/backend-sistema-clinico-TCC2.git
cd backend-sistema-clinico-TCC2
```

Quem não usa Git pode clicar em *Code* e depois em *Download ZIP* no GitHub, extrair o arquivo e abrir o terminal dentro da pasta extraída.

### 3.2 Banco de dados

O MySQL precisa estar em execução (no Windows, é o serviço `MySQL80`), e é preciso saber a senha do usuário `root`, definida na instalação.

Não é necessário criar o banco nem as tabelas. O endereço de conexão do projeto tem o parâmetro `createDatabaseIfNotExist=true`, então na primeira execução o sistema cria o banco `clinica_IA_TCC` e as tabelas sozinho (opção `JPA_DDL_AUTO=update`). Se preferir criar o banco manualmente, entre no MySQL com `mysql -u root -p` e execute:

```sql
CREATE DATABASE IF NOT EXISTS clinica_IA_TCC CHARACTER SET utf8mb4;
```

### 3.3 Arquivo de configuração `.env`

O repositório não contém senhas nem chaves. Elas ficam em um arquivo local chamado `.env`, que não é enviado ao GitHub. O repositório traz um modelo, o `.env.example`, e o `.env` é criado a partir dele:

```powershell
Copy-Item .env.example .env
```

No Linux ou no macOS, use `cp .env.example .env`. Depois, abra o arquivo em um editor de texto e preencha os valores conforme as próximas subseções. Não use aspas nos valores nem espaços ao redor do sinal de igual.

O `.env` guarda informações sigilosas e nunca deve ser enviado ao GitHub nem compartilhado.

#### 3.3.1 Variáveis obrigatórias

Sem as duas variáveis da Tabela 3, o sistema não inicia ou não consegue conectar ao banco.

**Tabela 3: Variáveis obrigatórias**

| Variável | O que colocar | Como obter |
|---|---|---|
| `DB_PASSWORD` | Senha do usuário do MySQL | É a senha do `root` definida na instalação do MySQL; se o banco não tem senha, deixe vazio |
| `JWT_SECRET` | Texto secreto e aleatório, com pelo menos 32 caracteres, usado para assinar os logins | Gere com o comando abaixo e cole o resultado |

Para gerar o `JWT_SECRET` no PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

#### 3.3.2 Banco de dados

As variáveis da Tabela 4 já vêm com valores que funcionam em um MySQL local. Só mude se o seu for diferente. O endereço de conexão padrão (`DB_URL`) é:

```text
jdbc:mysql://localhost:3306/clinica_IA_TCC?createDatabaseIfNotExist=true&serverTimezone=America/Sao_Paulo
```

Se o seu MySQL usa outra porta, troque o `3306` nesse endereço.

**Tabela 4: Variáveis do banco de dados e da porta do servidor**

| Variável | Valor padrão | Descrição |
|---|---|---|
| `DB_USERNAME` | `root` | Usuário do MySQL |
| `JPA_DDL_AUTO` | `update` | Cria e atualiza as tabelas automaticamente; mantenha esse valor |
| `SERVER_PORT` | `8080` | Porta do backend; se mudar, ajuste também o frontend ([Seção 4.3](#43-conexão-com-o-backend)) |

#### 3.3.3 Inteligência artificial (Gemini)

As variáveis da Tabela 5 são opcionais, mas necessárias para a análise por IA na consulta. Sem a chave, o cadastro, a consulta manual e o prontuário funcionam normalmente, e só a análise por IA fica indisponível.

**Tabela 5: Variáveis da integração com a Gemini API**

| Variável | Valor | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | sua chave | Chave da API do Google Gemini. Para obtê-la, acesse <https://aistudio.google.com/apikey>, entre com uma conta Google, clique em *Create API key* e copie a chave |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Modelo principal; pode manter |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.1-flash-lite` | Modelo reserva, usado quando o principal falha; pode manter |

As outras variáveis que começam com `GEMINI_` (tempos limite, número de tentativas, limite de tokens, limite diário e identificação de falas) já têm valores adequados e podem ficar como estão. Se o Google descontinuar um dos modelos, troque o nome por um modelo atual, listado em <https://ai.google.dev/gemini-api/docs/models>.

#### 3.3.4 Convites, recuperação de senha e e-mail

Para avaliar o sistema, mantenha os valores da Tabela 6, que dispensam o envio real de e-mails.

**Tabela 6: Variáveis de convites, recuperação de senha e e-mail**

| Variável | Valor recomendado | Descrição |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:5500` | Endereço do frontend, usado nos links de convite |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5500,http://127.0.0.1:5500` | Endereços do frontend autorizados a acessar a API |
| `EXPOSE_INVITE_LINK` | `true` | Mostra na tela o link de convite de um novo médico, sem precisar de e-mail; só para uso local |
| `EXPOSE_PASSWORD_RESET_LINK` | `true` | Devolve o link de recuperação de senha na resposta da API, para testar o fluxo sem e-mail; só para uso local |
| `MAIL_ENABLED` | `false` | Desliga o envio de e-mail; convites e recuperação de senha passam a depender das duas opções acima |
| `INVITE_EXPIRATION` | `PT24H` | Validade do link de convite (24 horas) |
| `PASSWORD_RESET_EXPIRATION` | `PT30M` | Validade do link de recuperação de senha (30 minutos) |
| `JWT_EXPIRATION` | `PT8H` | Duração do login (8 horas) |

O envio real de e-mail é opcional e serve apenas para testar essa função. Nesse caso, defina `MAIL_ENABLED=true` e `EXPOSE_INVITE_LINK=false` e preencha as variáveis da Tabela 7.

**Tabela 7: Variáveis para o envio real de e-mail**

| Variável | O que colocar |
|---|---|
| `MAIL_HOST` e `MAIL_PORT` | `smtp.gmail.com` e `587` (para o Gmail) |
| `MAIL_USERNAME` | Seu endereço de e-mail do Gmail |
| `MAIL_PASSWORD` | Senha de aplicativo do Google, e não a senha normal da conta. Ative a verificação em duas etapas e crie a senha em <https://myaccount.google.com/apppasswords>; digite-a sem espaços |
| `MAIL_SMTP_AUTH` e `MAIL_STARTTLS` | `true` e `true` |

### 3.4 Executar o backend

Com o MySQL ligado e o `.env` preenchido, execute na pasta do backend:

```powershell
.\mvnw.cmd spring-boot:run
```

No Linux ou no macOS, use `./mvnw spring-boot:run`. Na primeira execução o Maven baixa as dependências, o que pode levar alguns minutos. O backend está pronto quando o terminal mostra uma linha parecida com `Started BackendTccClinicaIaApplication ... in X seconds`, e ele passa a responder em <http://localhost:8080>. Deixe esse terminal aberto enquanto usar o sistema. Para encerrar, pressione `Ctrl+C`.

**Alternativa: executar pelo IntelliJ IDEA**

O backend também pode ser executado direto pela IDE, sem digitar comandos:

1. Abra a pasta do backend (*File* → *Open*, escolhendo `backend-sistema-clinico-TCC2`) e espere o IntelliJ importar o projeto Maven e baixar as dependências.
2. Confira se o projeto usa o JDK 21 (*File* → *Project Structure* → *Project* → *SDK*).
3. Abra a classe principal, a que tem a anotação `@SpringBootApplication`, em `src/main/java` (`BackendTccClinicaIaApplication`).
4. Clique no botão verde de executar, ao lado da classe ou do método `main`, ou no botão de executar da barra superior, e escolha *Run*.
5. Deixe o `.env` na raiz do projeto, na mesma pasta do `pom.xml`, porque o backend o lê a partir do diretório de trabalho. O IntelliJ já usa a raiz por padrão. Se aparecer o erro de `JWT_SECRET` ([Seção 3.6](#36-problemas-comuns)), confira em *Run* → *Edit Configurations* se o campo *Working directory* aponta para essa pasta.

O resultado é o mesmo: o backend responde em <http://localhost:8080>, e o console do IntelliJ mostra a linha `Started BackendTccClinicaIaApplication`. Para encerrar, use o botão vermelho de parar.

### 3.5 Testes automatizados

Se quiser, execute os testes automatizados com o comando abaixo. Eles usam um banco em memória (H2), então não acessam o seu MySQL nem usam a chave da Gemini.

```powershell
.\mvnw.cmd test
```

### 3.6 Problemas comuns

**Tabela 8: Problemas comuns ao executar o backend**

| Sintoma | Causa provável e solução |
|---|---|
| `Could not resolve placeholder 'JWT_SECRET'` | O `.env` não existe ou está sem `JWT_SECRET`. Confirme que o arquivo se chama exatamente `.env` (e não `.env.txt`) e que está na raiz do projeto |
| `Access denied for user 'root'` | Senha incorreta em `DB_PASSWORD` |
| `Communications link failure`, ou não conecta | MySQL desligado ou em outra porta. Inicie o serviço e confira o `DB_URL` |
| `Port 8080 was already in use` | Outro programa está usando a porta. Feche-o ou mude o `SERVER_PORT` |
| `release version 21 not supported`, ou outro erro de Java | JDK anterior ao 21. Instale o JDK 21 e confira com `java -version` |
| Análise por IA indisponível | `GEMINI_API_KEY` vazia ou inválida, ou cota diária da chave esgotada |

## 4. Frontend

### 4.1 Baixar o código

O repositório do frontend fica em <https://github.com/Nogz04/frontend-sistema-clinico-TCC2>. Em outro terminal, mantendo aberto o do backend, execute:

```powershell
git clone https://github.com/Nogz04/frontend-sistema-clinico-TCC2.git
cd frontend-sistema-clinico-TCC2
```

Dentro dessa pasta ficam diretamente o arquivo `index.html`, a pasta `assets` e o `README.md`.

### 4.2 Executar o frontend

O frontend é um site estático e não precisa instalar dependências. Ele deve ser aberto por um servidor local, e não com um duplo clique no `index.html`, e na porta 5500, que é a única autorizada pelo backend. Qualquer servidor de arquivos estáticos que sirva a pasta nessa porta funciona. O Python é só uma forma simples de fazer isso, foi o que usei durante o desenvolvimento, e não faz parte do sistema. Também servem, por exemplo, `php -S localhost:5500`, o Apache ou o Nginx apontando para a pasta, ou a extensão de servidor local de outro editor.

**Opção A: Python**

```powershell
python -m http.server 5500
```

**Opção B: Visual Studio Code**

Instale a extensão Live Server, abra a pasta do frontend, clique com o botão direito no `index.html` e escolha *Open with Live Server*. A porta padrão da extensão já é a 5500.

**Opção C: Node.js**

```powershell
npx serve -l 5500
```

Depois, abra o sistema no navegador em <http://localhost:5500>.

### 4.3 Conexão com o backend

O frontend procura a API em `http://localhost:8080/api`, endereço definido no arquivo `assets/js/config.js`. Se você mudou o `SERVER_PORT` do backend, basta editar essa linha com a nova porta.

### 4.4 Problemas comuns

**Tabela 9: Problemas comuns ao executar o frontend**

| Sintoma | Causa provável e solução |
|---|---|
| A tela carrega, mas o login dá erro de conexão | Backend desligado, ou frontend aberto em porta diferente de 5500 (CORS). Inicie o backend e use a porta 5500 |
| Erro de CORS no console do navegador | O endereço do frontend não está em `CORS_ALLOWED_ORIGINS`. Use `http://localhost:5500` ou `http://127.0.0.1:5500` |
| O ditado por voz não funciona | Use o Chrome ou o Edge, permita o acesso ao microfone e acesse por `localhost`, porque o navegador só libera o microfone em `localhost` ou em HTTPS |

## 5. Primeiro acesso: criar o primeiro médico

Por segurança, o sistema não tem cadastro público: só um médico já logado pode cadastrar (convidar) outros. Por isso, o primeiro médico e a clínica dele precisam ser inseridos direto no banco, uma única vez. Os médicos seguintes são cadastrados pela própria tela, por convite.

**Passo 1.** Suba o backend pelo menos uma vez ([Seção 3.4](#34-executar-o-backend)), para que as tabelas sejam criadas.

**Passo 2.** Abra o MySQL (pelo `mysql -u root -p`, pelo MySQL Workbench ou pelo cliente de banco de dados do IntelliJ) e execute o script abaixo.

```sql
USE clinica_IA_TCC;

-- 1) Clínica (o médico precisa pertencer a uma)
INSERT INTO clinicas (nome) VALUES ('Clínica Demonstração');

-- 2) Usuário base (senha = hash BCrypt da senha Admin@12345)
INSERT INTO usuarios (nome_completo, email, senha, senha_definida)
VALUES ('Médico Demonstração', 'medico@teste.com',
        '$2a$10$eB6sCTctbTL1vSUWv6k1oOOHA28NvyqOT7bYX8XiHVamR/StkUqwu', TRUE);

-- 3) Dados de médico, ligados ao usuário e à clínica recém-criados
INSERT INTO medicos (id, crm, cpf, data_nascimento, clinica_id)
VALUES (LAST_INSERT_ID(), 'CRM-RS 12345', '52998224725', '1990-01-01',
        (SELECT id FROM clinicas WHERE nome = 'Clínica Demonstração' LIMIT 1));

-- 4) Especialidade
INSERT INTO medico_especialidades (medico_id, especialidade)
VALUES (LAST_INSERT_ID(), 'Clínica Geral');
```

Execute os quatro comandos na ordem e na mesma sessão do MySQL, porque eles usam `LAST_INSERT_ID()` para ligar as tabelas. Se algum comando reclamar de coluna inexistente ou obrigatória, confira a estrutura com `DESCRIBE usuarios;`, `DESCRIBE medicos;` e `DESCRIBE clinicas;` e ajuste o `INSERT`.

O texto que começa com `$2a$10$` não é a senha: é o hash BCrypt dela. A senha para entrar é `Admin@12345`. Para usar outra, gere um hash BCrypt com custo 10, por exemplo em um gerador on-line confiável, e troque no script. Também dá para mudar o e-mail, o CRM e o CPF; o CPF do exemplo é válido só para testes.

**Passo 3.** Acesse <http://localhost:5500> e entre com o e-mail `medico@teste.com` e a senha `Admin@12345`.

## 6. Primeiro uso

Depois de entrar, uma sequência simples para testar o sistema:

1. Cadastre um paciente. O prontuário único é criado junto com o cadastro.
2. Inicie uma consulta, dite ou digite o relato e use a análise por IA, que precisa da `GEMINI_API_KEY`.
3. Para convidar outro médico da mesma clínica, use *Equipe médica* → *Novo médico*. Com `EXPOSE_INVITE_LINK=true`, o link de ativação aparece na própria tela.

## 7. Resumo dos comandos

Para quem já tem os programas instalados, os comandos são estes. Depois de criar o `.env`, edite-o e preencha `DB_PASSWORD`, `JWT_SECRET` e, se quiser a análise por IA, `GEMINI_API_KEY`.

**Terminal 1: backend**

```powershell
git clone https://github.com/Nogz04/backend-sistema-clinico-TCC2.git
cd backend-sistema-clinico-TCC2
Copy-Item .env.example .env
.\mvnw.cmd spring-boot:run
```

**Terminal 2: frontend**

```powershell
git clone https://github.com/Nogz04/frontend-sistema-clinico-TCC2.git
cd frontend-sistema-clinico-TCC2
python -m http.server 5500
```

Em seguida, acesse <http://localhost:5500>.

## 8. Sobre o frontend

### Tecnologias

- HTML semântico para estrutura e acessibilidade.
- CSS responsivo, temas claro/escuro e identidade visual própria.
- JavaScript ES Modules para navegação, estado e consumo da API REST.
- Web Speech API (`SpeechRecognition`) para converter fala em texto no navegador.
- Font Awesome para ícones funcionais.
