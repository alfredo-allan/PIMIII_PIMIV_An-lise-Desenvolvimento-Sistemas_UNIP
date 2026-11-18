/*
 * ordem.c - Persistencia das ordens de servico
 * Formato: id;placa;tipo;descricao;data_abertura;data_agendada;data_conclusao;status
 */
#include <stdio.h>
#include <string.h>
#include "ordem.h"

int carregarOrdens(CadastroOS *c) {
    FILE *arq;
    char linha[384];
    c->quantidade = 0;
    c->proximo_id = 1;
    arq = fopen(ARQ_ORDENS, "r");
    if (arq == NULL) return 0;
    while (fgets(linha, sizeof linha, arq) != NULL && c->quantidade < MAX_ORDENS) {
        OrdemServico o;
        int lidos = sscanf(linha, "%d;%8[^;];%11[^;];%99[^;];%19[^;];%19[^;];%19[^;];%14[^\r\n]",
                           &o.id_os, o.placa_veiculo, o.tipo, o.descricao_falha,
                           o.data_abertura, o.data_agendada, o.data_conclusao, o.status);
        if (lidos == 8) {
            c->itens[c->quantidade++] = o;
            if (o.id_os >= c->proximo_id) c->proximo_id = o.id_os + 1;
        }
    }
    fclose(arq);
    return c->quantidade;
}

int salvarOrdens(const CadastroOS *c) {
    const char *tmp = ARQ_ORDENS ".tmp";
    FILE *arq = fopen(tmp, "w");
    int i;
    if (arq == NULL) {
        printf("  [ERRO] Nao foi possivel gravar o arquivo de ordens.\n");
        return 0;
    }
    for (i = 0; i < c->quantidade; i++) {
        const OrdemServico *o = &c->itens[i];
        fprintf(arq, "%d;%s;%s;%s;%s;%s;%s;%s\n", o->id_os, o->placa_veiculo, o->tipo,
                o->descricao_falha, o->data_abertura, o->data_agendada,
                o->data_conclusao, o->status);
    }
    if (fclose(arq) != 0) return 0;
    remove(ARQ_ORDENS);
    return rename(tmp, ARQ_ORDENS) == 0;
}

/*
 * Nucleo de abertura de OS. RNF04 - Integridade referencial:
 * a OS so e criada se a placa existir na frota (equivalente a FOREIGN KEY).
 * Retorna o id da OS criada ou 0 em caso de recusa.
 */
int abrirOrdem(CadastroOS *c, const Frota *f, const char *placa,
               const char *tipo, const char *descricao, const char *data_agendada) {
    OrdemServico o;
    if (buscarVeiculoPorPlaca(f, placa) < 0) {
        printf("  [RNF04] Recusado: veiculo %s nao existe na frota.\n", placa);
        return 0;
    }
    if (c->quantidade >= MAX_ORDENS) {
        printf("  [!] Limite de ordens atingido.\n");
        return 0;
    }
    o.id_os = c->proximo_id;
    strncpy(o.placa_veiculo, placa, sizeof o.placa_veiculo - 1);
    o.placa_veiculo[sizeof o.placa_veiculo - 1] = '\0';
    strncpy(o.tipo, tipo, sizeof o.tipo - 1);
    o.tipo[sizeof o.tipo - 1] = '\0';
    strncpy(o.descricao_falha, descricao, sizeof o.descricao_falha - 1);
    o.descricao_falha[sizeof o.descricao_falha - 1] = '\0';
    dataHoraAtual(o.data_abertura, sizeof o.data_abertura);
    strcpy(o.data_agendada, data_agendada ? data_agendada : "-");
    strcpy(o.data_conclusao, "-");
    strcpy(o.status, data_agendada ? "AGENDADA" : "EM_ABERTO");

    c->itens[c->quantidade++] = o;
    if (!salvarOrdens(c)) {
        c->quantidade--;
        return 0;
    }
    return c->proximo_id++;
}

/* RF03 - Abertura manual de OS corretiva */
void abrirOrdemManual(CadastroOS *c, const Frota *f) {
    char placa[9], descricao[100];
    int id;
    printf("\n=== RF03 - ABRIR ORDEM DE SERVICO ===\n");
    lerTexto("Placa do veiculo: ", placa, sizeof placa);
    paraMaiusculas(placa);
    if (buscarVeiculoPorPlaca(f, placa) < 0) {
        printf("  [RNF04] Recusado: veiculo %s nao existe na frota.\n", placa);
        return;
    }
    lerTexto("Descricao da falha: ", descricao, sizeof descricao);
    id = abrirOrdem(c, f, placa, "CORRETIVA", descricao, NULL);
    if (id) printf(">> OS #%d aberta para o veiculo %s.\n", id, placa);
}

/* RF04 - Agendar manutencao preventiva */
void agendarPreventiva(CadastroOS *c, const Frota *f) {
    char placa[9], data[TAM_DATA], descricao[100];
    int dia, mes, ano, id;
    printf("\n=== RF04 - AGENDAR MANUTENCAO PREVENTIVA ===\n");
    lerTexto("Placa do veiculo: ", placa, sizeof placa);
    paraMaiusculas(placa);
    if (buscarVeiculoPorPlaca(f, placa) < 0) {
        printf("  [RNF04] Recusado: veiculo %s nao existe na frota.\n", placa);
        return;
    }
    dia = lerInteiro("Dia (1-31): ", 1, 31);
    mes = lerInteiro("Mes (1-12): ", 1, 12);
    ano = lerInteiro("Ano (2026-2030): ", 2026, 2030);
    sprintf(data, "%04d-%02d-%02d 08:00", ano, mes, dia);
    lerTexto("Servico previsto: ", descricao, sizeof descricao);
    id = abrirOrdem(c, f, placa, "PREVENTIVA", descricao, data);
    if (id) printf(">> Preventiva #%d agendada para %s.\n", id, data);
}

/* Fechamento da OS: devolve o equipamento ao estado OPERACIONAL */
void concluirOrdem(CadastroOS *c, Frota *f) {
    int id, i, idx;
    printf("\n=== CONCLUIR ORDEM DE SERVICO ===\n");
    id = lerInteiro("Numero da OS: ", 1, 999999);
    for (i = 0; i < c->quantidade; i++) {
        OrdemServico *o = &c->itens[i];
        if (o->id_os != id) continue;
        if (strcmp(o->status, "CONCLUIDA") == 0) {
            printf("  [!] A OS #%d ja esta concluida.\n", id);
            return;
        }
        strcpy(o->status, "CONCLUIDA");
        dataHoraAtual(o->data_conclusao, sizeof o->data_conclusao);
        salvarOrdens(c);
        idx = buscarVeiculoPorPlaca(f, o->placa_veiculo);
        if (idx >= 0 && strcmp(o->tipo, "CORRETIVA") == 0) {
            strcpy(f->itens[idx].status_elevador, "OPERACIONAL");
            strcpy(f->itens[idx].status_rampa, "OPERACIONAL");
            salvarFrota(f);
        }
        printf(">> OS #%d concluida em %s.\n", id, o->data_conclusao);
        return;
    }
    printf("  [!] OS #%d nao encontrada.\n", id);
}

/* RF05 - Historico de manutencoes por placa */
void consultarHistorico(const CadastroOS *c, const Frota *f) {
    char placa[9];
    int i, encontrados = 0;
    printf("\n=== RF05 - HISTORICO DO VEICULO ===\n");
    lerTexto("Placa: ", placa, sizeof placa);
    paraMaiusculas(placa);
    if (buscarVeiculoPorPlaca(f, placa) < 0) {
        printf("  [!] Veiculo %s nao cadastrado.\n", placa);
        return;
    }
    for (i = 0; i < c->quantidade; i++) {
        const OrdemServico *o = &c->itens[i];
        if (strcmp(o->placa_veiculo, placa) != 0) continue;
        printf("OS #%-4d %-10s %-10s aberta %s | agendada %s | concluida %s\n    %s\n",
               o->id_os, o->tipo, o->status, o->data_abertura, o->data_agendada,
               o->data_conclusao, o->descricao_falha);
        encontrados++;
    }
    printf("-- %d registro(s) para %s.\n", encontrados, placa);
}

void listarOrdensAbertas(const CadastroOS *c) {
    int i, n = 0;
    printf("\n=== ORDENS EM ABERTO / AGENDADAS ===\n");
    for (i = 0; i < c->quantidade; i++) {
        const OrdemServico *o = &c->itens[i];
        if (strcmp(o->status, "CONCLUIDA") == 0) continue;
        printf("OS #%-4d %-9s %-10s %-10s %s\n", o->id_os, o->placa_veiculo,
               o->tipo, o->status, o->descricao_falha);
        n++;
    }
    if (n == 0) printf("Nenhuma ordem pendente.\n");
}
