/*
 * main.c - Sistema Corporativo de Gestao da Frota, Manutencao Preventiva
 *          e Chamados de Acessibilidade - UrbanoAcessivel S.A. (PIM IV)
 *
 * Compilacao (Linux ou Windows/MinGW):
 *   gcc -std=c99 -Wall -Wextra -o urbano auth.c main.c ordem.c telemetria.c util.c veiculo.c
 *   (ou simplesmente: make)
 */
#include <stdio.h>
#include "util.h"
#include "veiculo.h"
#include "ordem.h"
#include "telemetria.h"
#include "auth.h"

/* Estruturas grandes ficam em memoria estatica, fora da pilha. */
static Frota frota;
static CadastroOS ordens;

/* Matriz de permissoes por perfil (RF07) */
static int permitido(Perfil p, int opcao) {
    switch (opcao) {
        case 1: case 9:          return p == PERFIL_GESTOR;                       /* cadastrar, IoT */
        case 2: case 7:          return p == PERFIL_GESTOR || p == PERFIL_MECANICO; /* diagnostico, concluir */
        case 3: case 4: case 10: return p == PERFIL_GESTOR || p == PERFIL_MECANICO; /* abrir OS, preventiva, pacote */
        default:                 return 1;                                        /* consultas */
    }
}

static void exibirMenu(const char *login, Perfil p) {
    printf("\n==========================================================\n");
    printf("  URBANOACESSIVEL S.A. - Gestao de Frota e Acessibilidade\n");
    printf("  Operador: %s (%s)\n", login, nomePerfil(p));
    printf("==========================================================\n");
    printf("  1  - Cadastrar onibus                 (RF01)\n");
    printf("  2  - Registrar diagnostico            (RF02)\n");
    printf("  3  - Abrir ordem de servico           (RF03)\n");
    printf("  4  - Agendar manutencao preventiva    (RF04)\n");
    printf("  5  - Consultar historico do veiculo   (RF05)\n");
    printf("  6  - Relatorio de frota operacional   (RF06)\n");
    printf("  7  - Concluir ordem de servico\n");
    printf("  8  - Listar frota / ordens pendentes\n");
    printf("  9  - Ingerir arquivo de telemetria    (RF08)\n");
    printf("  10 - Ingerir pacote JSON avulso       (RF08)\n");
    printf("  0  - Sair\n");
}

int main(void) {
    char login[20];
    Perfil perfil;
    int opcao;

    carregarFrota(&frota);
    carregarOrdens(&ordens);
    printf("Dados carregados do disco: %d veiculo(s), %d ordem(ns).\n",
           frota.quantidade, ordens.quantidade);

    perfil = autenticar(login, 3);
    if (perfil == PERFIL_NENHUM) {
        printf("Acesso bloqueado apos 3 tentativas.\n");
        return 1;
    }

    do {
        exibirMenu(login, perfil);
        opcao = lerInteiro("Escolha: ", 0, 10);
        if (opcao != 0 && !permitido(perfil, opcao)) {
            printf("  [RF07] Perfil %s sem permissao para esta operacao.\n", nomePerfil(perfil));
            continue;
        }
        switch (opcao) {
            case 1:  cadastrarVeiculo(&frota); break;
            case 2:  registrarDiagnostico(&frota); break;
            case 3:  abrirOrdemManual(&ordens, &frota); break;
            case 4:  agendarPreventiva(&ordens, &frota); break;
            case 5:  consultarHistorico(&ordens, &frota); break;
            case 6:  relatorioFrotaOperacional(&frota); break;
            case 7:  concluirOrdem(&ordens, &frota); break;
            case 8:  listarFrota(&frota); listarOrdensAbertas(&ordens); break;
            case 9:  ingerirArquivoIoT(&frota, &ordens); break;
            case 10: ingerirPacoteManual(&frota, &ordens); break;
            case 0:  printf("Dados persistidos. Ate logo!\n"); break;
        }
    } while (opcao != 0);
    return 0;
}
