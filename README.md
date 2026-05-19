# IA JONASNETTO

Ferramenta de comparação multi-modelo de IA: consulta ChatGPT, Gemini, DeepSeek, Claude, Perplexity e Llama em paralelo, consolida respostas e mantém histórico de pesquisas.

## Stack

- React + Vite + TypeScript
- Estilização 100% via inline styles (sem CSS framework)
- Histórico de pesquisas em localStorage
- Auth via backend externo (base44.app)
- Queries de IA via backend externo (base44.app)

## Funcionalidades

- 🔐 Login com aprovação do administrador
- 🤖 Consulta simultânea a 6 modelos: ChatGPT, Gemini, DeepSeek, Claude, Perplexity, Llama
- 📋 Perfil de Pesquisa (área, tema, objetivo, dados, ação)
- 🕑 Modo conversa (acumula histórico na sessão)
- ✨ Consolidação de respostas
- 📎 Anexo de arquivos (PDF, Word, imagens, texto)
- ⭐ Templates de prompts salvos
- 📚 Histórico de pesquisas (localStorage)
- ⚡ Ranking de velocidade dos modelos
- ⬇️ Exportar resultados em TXT
- 👥 Painel Admin para aprovar/rejeitar usuários
- 🎨 3 temas: Light Minimalista, Dark Refinado, Dark + Glass

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

## Estrutura

```
src/
  App.tsx          # Entry point
  index.css        # Estilos globais e keyframes
  pages/
    Home.tsx       # Componente principal (todos os sub-componentes)
```
