#!/usr/bin/env bash
# Encerra processos órfãos ou travados de teste executados via tsx
echo "🔍 Buscando processos tsx --test ativos..."
PIDS=$(pgrep -f "tsx --test" || true)

if [ -n "$PIDS" ]; then
  echo "⚠️  Encerrando processos de teste pendentes: $PIDS"
  pkill -f "tsx --test" || true
  sleep 1
  echo "✅ Todos os processos de teste foram encerrados com sucesso."
else
  echo "✅ Nenhum processo tsx --test travado foi encontrado."
fi
