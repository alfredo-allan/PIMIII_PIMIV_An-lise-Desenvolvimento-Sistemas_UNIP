/*
 * ordem.h - Ordens de servico, manutencao preventiva e historico (RF03, RF04, RF05)
 */
#ifndef ORDEM_H
#define ORDEM_H

#include "veiculo.h"
#include "util.h"

#define MAX_ORDENS 2000
#define ARQ_ORDENS "ordens_servico.txt"

typedef struct {
    int  id_os;
    char placa_veiculo[9];
    char tipo[12];             /* CORRETIVA, PREVENTIVA */
    char descricao_falha[100];
    char data_abertura[TAM_DATA];
    char data_agendada[TAM_DATA]; /* "-" quando nao se aplica */
    char data_conclusao[TAM_DATA];/* "-" enquanto aberta */
    char status[15];           /* EM_ABERTO, AGENDADA, CONCLUIDA */
} OrdemServico;

typedef struct {
    OrdemServico itens[MAX_ORDENS];
    int quantidade;
    int proximo_id;
} CadastroOS;

int  carregarOrdens(CadastroOS *c);
int  salvarOrdens(const CadastroOS *c);
int  abrirOrdem(CadastroOS *c, const Frota *f, const char *placa,
                const char *tipo, const char *descricao, const char *data_agendada);
void abrirOrdemManual(CadastroOS *c, const Frota *f);
void agendarPreventiva(CadastroOS *c, const Frota *f);
void concluirOrdem(CadastroOS *c, Frota *f);
void consultarHistorico(const CadastroOS *c, const Frota *f);
void listarOrdensAbertas(const CadastroOS *c);

#endif
