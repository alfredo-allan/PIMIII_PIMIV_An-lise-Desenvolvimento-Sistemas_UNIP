# UrbanoAcessível S.A. — Programa em C (PIM IV)

Sistema de Gestão da Frota, Manutenção Preventiva e Chamados de Acessibilidade.
Autor: Alfredo Allan Teixeira Sousa — RA 2636870 — UNIP EAD.

## Como compilar

Linux (GCC):

```bash
make            # ou: gcc -std=c99 -Wall -Wextra -o urbano src/*.c
./urbano
```

Windows (MinGW):

```bat
gcc -std=c99 -Wall -Wextra -o urbano.exe src\auth.c src\main.c src\ordem.c src\telemetria.c src\util.c src\veiculo.c
urbano.exe
```

## Login (RF07)

Na primeira execução o programa cria o arquivo `operadores.txt` com três contas padrão:

| Usuário    | Senha       | Perfil   | O que pode fazer                                        |
|------------|-------------|----------|---------------------------------------------------------|
| `gestor`   | `gestor123` | GESTOR   | Tudo: cadastro, ordens, preventivas, telemetria, relatórios |
| `mecanico` | `mec123`    | MECANICO | Diagnóstico, abrir/concluir OS, agendar preventiva, consultas |
| `fiscal`   | `fiscal123` | FISCAL   | Somente consultas e relatórios (opções 5, 6 e 8)        |

As senhas ficam gravadas como hash (djb2, uso didático). Para voltar às contas padrão,
apague `operadores.txt`. Após 3 tentativas erradas o programa encerra.

## Arquivos de dados

| Arquivo                      | Conteúdo                                   |
|------------------------------|--------------------------------------------|
| `frota_urbanoacessivel.txt`  | Veículos (RF01, RF02)                      |
| `ordens_servico.txt`         | Ordens de serviço e preventivas (RF03–RF05)|
| `telemetria_log.txt`         | Pacotes IoT processados (RF08)             |
| `telemetria_entrada.jsonl`   | Pacotes de exemplo para a opção 9          |
| `operadores.txt`             | Usuários e hashes de senha (RF07)          |

## Roteiro rápido de teste

1. Entre como `gestor` / `gestor123`.
2. Opção 1: cadastre `BRA2E19`, prefixo `BUS-9042`, e `FIX3D45`, prefixo `BUS-7110`.
3. Opção 9: importa a telemetria — o pacote FAIL do BUS-9042 abre uma OS automática.
4. Opção 6: relatório de frota operacional.
5. Opção 7: conclua a OS 1 e rode a opção 6 de novo.
6. Saia (0), execute de novo e veja os dados recarregados do disco.

## Banco de dados

`sql/urbanoacessivel.sql` (MySQL 8) e `sql/telemetry_log_exemplo.json` (MongoDB).
