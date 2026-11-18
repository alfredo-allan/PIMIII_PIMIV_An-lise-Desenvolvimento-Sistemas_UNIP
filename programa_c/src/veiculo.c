/*
 * veiculo.c - Persistencia da frota em arquivo texto delimitado por ';'
 * Formato da linha: id;placa;prefixo;modelo;ano;status_elevador;status_rampa
 */
#include <stdio.h>
#include <string.h>
#include "veiculo.h"
#include "util.h"

int carregarFrota(Frota *f) {
    FILE *arq;
    char linha[256];
    f->quantidade = 0;
    f->proximo_id = 1;

    arq = fopen(ARQ_FROTA, "r");
    if (arq == NULL) return 0; /* primeira execucao: arquivo ainda nao existe */

    while (fgets(linha, sizeof linha, arq) != NULL && f->quantidade < MAX_VEICULOS) {
        Veiculo v;
        int lidos = sscanf(linha, "%d;%8[^;];%11[^;];%29[^;];%d;%19[^;];%19[^\r\n]",
                           &v.id, v.placa, v.prefixo, v.modelo, &v.ano,
                           v.status_elevador, v.status_rampa);
        if (lidos == 7) { /* linhas corrompidas sao ignoradas, nao travam o laco */
            f->itens[f->quantidade++] = v;
            if (v.id >= f->proximo_id) f->proximo_id = v.id + 1;
        }
    }
    fclose(arq);
    return f->quantidade;
}

/* Grava em arquivo temporario e substitui o original: evita perda em caso de falha. */
int salvarFrota(const Frota *f) {
    const char *tmp = ARQ_FROTA ".tmp";
    FILE *arq = fopen(tmp, "w");
    int i;
    if (arq == NULL) {
        printf("  [ERRO] Nao foi possivel gravar o arquivo de frota.\n");
        return 0;
    }
    for (i = 0; i < f->quantidade; i++) {
        const Veiculo *v = &f->itens[i];
        fprintf(arq, "%d;%s;%s;%s;%d;%s;%s\n", v->id, v->placa, v->prefixo,
                v->modelo, v->ano, v->status_elevador, v->status_rampa);
    }
    if (fclose(arq) != 0) return 0;
    remove(ARQ_FROTA);
    if (rename(tmp, ARQ_FROTA) != 0) {
        printf("  [ERRO] Falha ao substituir o arquivo de frota.\n");
        return 0;
    }
    return 1;
}

int buscarVeiculoPorPlaca(const Frota *f, const char *placa) {
    int i;
    for (i = 0; i < f->quantidade; i++)
        if (strcmp(f->itens[i].placa, placa) == 0) return i;
    return -1;
}

int buscarVeiculoPorPrefixo(const Frota *f, const char *prefixo) {
    int i;
    for (i = 0; i < f->quantidade; i++)
        if (strcmp(f->itens[i].prefixo, prefixo) == 0) return i;
    return -1;
}

int statusValido(const char *s) {
    return strcmp(s, "OPERACIONAL") == 0 || strcmp(s, "ALERTA") == 0 ||
           strcmp(s, "QUEBRADO") == 0;
}

static const char *escolherStatus(const char *rotulo) {
    int op;
    printf("%s\n  1 - OPERACIONAL\n  2 - ALERTA\n  3 - QUEBRADO\n", rotulo);
    op = lerInteiro("  Opcao: ", 1, 3);
    return op == 1 ? "OPERACIONAL" : (op == 2 ? "ALERTA" : "QUEBRADO");
}

/* RF01 - Cadastrar Onibus */
void cadastrarVeiculo(Frota *f) {
    Veiculo v;
    if (f->quantidade >= MAX_VEICULOS) {
        printf("  [!] Capacidade maxima de cadastro atingida.\n");
        return;
    }
    printf("\n=== RF01 - CADASTRO DE ONIBUS ===\n");
    lerTexto("Placa (ex.: BRA2E19): ", v.placa, sizeof v.placa);
    paraMaiusculas(v.placa);
    if (strlen(v.placa) < 7) {
        printf("  [!] Placa deve ter ao menos 7 caracteres.\n");
        return;
    }
    if (buscarVeiculoPorPlaca(f, v.placa) >= 0) { /* equivale ao UNIQUE do SQL */
        printf("  [!] Ja existe um veiculo com a placa %s.\n", v.placa);
        return;
    }
    lerTexto("Prefixo IoT (ex.: BUS-9042): ", v.prefixo, sizeof v.prefixo);
    paraMaiusculas(v.prefixo);
    if (buscarVeiculoPorPrefixo(f, v.prefixo) >= 0) {
        printf("  [!] Prefixo %s ja esta associado a outro veiculo.\n", v.prefixo);
        return;
    }
    lerTexto("Modelo: ", v.modelo, sizeof v.modelo);
    v.ano = lerInteiro("Ano de fabricacao (1990-2027): ", 1990, 2027);
    strcpy(v.status_elevador, "OPERACIONAL");
    strcpy(v.status_rampa, "OPERACIONAL");
    v.id = f->proximo_id;

    f->itens[f->quantidade++] = v;
    if (salvarFrota(f)) {
        f->proximo_id++;
        printf(">> Veiculo %s (ID %d) cadastrado e salvo em %s.\n", v.placa, v.id, ARQ_FROTA);
    } else {
        f->quantidade--; /* desfaz a insercao em memoria se o disco falhou */
    }
}

/* RF02 - Registrar Diagnostico de Acessibilidade */
void registrarDiagnostico(Frota *f) {
    char placa[9];
    int idx;
    Veiculo *v;
    printf("\n=== RF02 - DIAGNOSTICO DE ACESSIBILIDADE ===\n");
    lerTexto("Placa do veiculo: ", placa, sizeof placa);
    paraMaiusculas(placa);
    idx = buscarVeiculoPorPlaca(f, placa);
    if (idx < 0) {
        printf("  [!] Veiculo %s nao encontrado.\n", placa);
        return;
    }
    v = &f->itens[idx];
    strcpy(v->status_elevador, escolherStatus("Status do elevador hidraulico:"));
    strcpy(v->status_rampa, escolherStatus("Status da rampa de acesso:"));
    if (salvarFrota(f))
        printf(">> Diagnostico salvo: elevador %s, rampa %s.\n",
               v->status_elevador, v->status_rampa);
}

void listarFrota(const Frota *f) {
    int i;
    printf("\n=== RELATORIO DE FROTA CADASTRADA (ARQUIVO EM DISCO) ===\n");
    if (f->quantidade == 0) {
        printf("Nenhum registro de frota encontrado.\n");
        return;
    }
    printf("%-4s %-9s %-10s %-22s %-5s %-12s %-12s\n",
           "ID", "PLACA", "PREFIXO", "MODELO", "ANO", "ELEVADOR", "RAMPA");
    for (i = 0; i < f->quantidade; i++) {
        const Veiculo *v = &f->itens[i];
        printf("%-4d %-9s %-10s %-22s %-5d %-12s %-12s\n", v->id, v->placa,
               v->prefixo, v->modelo, v->ano, v->status_elevador, v->status_rampa);
    }
}

/* RF06 - Percentual da frota com acessibilidade 100% ativa */
void relatorioFrotaOperacional(const Frota *f) {
    int i, ativos = 0, alerta = 0, quebrados = 0;
    printf("\n=== RF06 - RELATORIO DE FROTA OPERACIONAL ===\n");
    if (f->quantidade == 0) {
        printf("Frota vazia.\n");
        return;
    }
    for (i = 0; i < f->quantidade; i++) {
        const Veiculo *v = &f->itens[i];
        if (strcmp(v->status_elevador, "QUEBRADO") == 0 ||
            strcmp(v->status_rampa, "QUEBRADO") == 0)
            quebrados++;
        else if (strcmp(v->status_elevador, "ALERTA") == 0 ||
                 strcmp(v->status_rampa, "ALERTA") == 0)
            alerta++;
        else
            ativos++;
    }
    printf("Total de veiculos ........: %d\n", f->quantidade);
    printf("Acessibilidade 100%% ativa : %d (%.1f%%)\n", ativos, 100.0 * ativos / f->quantidade);
    printf("Em alerta ................: %d (%.1f%%)\n", alerta, 100.0 * alerta / f->quantidade);
    printf("Com equipamento quebrado .: %d (%.1f%%)\n", quebrados, 100.0 * quebrados / f->quantidade);
}
