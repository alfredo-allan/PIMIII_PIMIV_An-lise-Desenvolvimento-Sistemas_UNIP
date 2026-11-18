/*
 * telemetria.c - Leitura dos pacotes JSON vindos do Broker MQTT.
 * O parser e intencionalmente simples (busca de chave), suficiente para o
 * payload plano do sensor; em producao usa-se uma biblioteca como cJSON.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "telemetria.h"

/* Copia o valor de "chave": "valor" ou "chave": numero para destino. */
int extrairCampoJson(const char *json, const char *chave, char *destino, size_t tam) {
    char padrao[64];
    const char *p;
    size_t n = 0;
    sprintf(padrao, "\"%s\"", chave);
    p = strstr(json, padrao);
    if (p == NULL) return 0;
    p += strlen(padrao);
    while (*p == ' ' || *p == ':') p++;
    if (*p == '"') {
        p++;
        while (*p && *p != '"' && n + 1 < tam) destino[n++] = *p++;
    } else {
        while (*p && *p != ',' && *p != '}' && *p != ' ' && n + 1 < tam) destino[n++] = *p++;
    }
    destino[n] = '\0';
    return n > 0;
}

int interpretarPacote(const char *json, TelemetriaLog *log) {
    char tensao[16];
    if (!extrairCampoJson(json, "bus_id", log->bus_id, sizeof log->bus_id)) return 0;
    if (!extrairCampoJson(json, "hydraulic_ramp_status", log->ramp_status, sizeof log->ramp_status))
        return 0;
    if (!extrairCampoJson(json, "timestamp", log->timestamp, sizeof log->timestamp))
        strcpy(log->timestamp, "-");
    log->battery_voltage = extrairCampoJson(json, "battery_voltage", tensao, sizeof tensao)
                               ? atof(tensao) : 0.0;
    return 1;
}

static int possuiOrdemCorretivaAberta(const CadastroOS *c, const char *placa) {
    int i;
    for (i = 0; i < c->quantidade; i++)
        if (strcmp(c->itens[i].placa_veiculo, placa) == 0 &&
            strcmp(c->itens[i].tipo, "CORRETIVA") == 0 &&
            strcmp(c->itens[i].status, "EM_ABERTO") == 0)
            return 1;
    return 0;
}

/*
 * Processa um pacote: grava no log (RF08) e, se o sensor indicar falha,
 * atualiza o status do veiculo e abre OS automatica (RF03), sem duplicar.
 * Retorno: 1 = OK, 2 = OS aberta, 0 = pacote rejeitado.
 */
int processarPacote(const char *json, Frota *f, CadastroOS *c) {
    TelemetriaLog log;
    FILE *arq;
    int idx, id;
    Veiculo *v;
    char descricao[100];

    if (!interpretarPacote(json, &log)) {
        printf("  [!] Pacote mal formado descartado.\n");
        return 0;
    }
    idx = buscarVeiculoPorPrefixo(f, log.bus_id);
    if (idx < 0) {
        printf("  [!] %s nao pertence a frota cadastrada. Pacote ignorado.\n", log.bus_id);
        return 0;
    }
    arq = fopen(ARQ_TELEMETRIA, "a");
    if (arq != NULL) {
        fprintf(arq, "%s;%s;%s;%.1f\n", log.timestamp, log.bus_id, log.ramp_status,
                log.battery_voltage);
        fclose(arq);
    }
    v = &f->itens[idx];
    if (strcmp(log.ramp_status, "OK") == 0) {
        printf("  %s (%s): sensores OK.\n", log.bus_id, v->placa);
        return 1;
    }
    strcpy(v->status_elevador, strcmp(log.ramp_status, "WARN") == 0 ? "ALERTA" : "QUEBRADO");
    salvarFrota(f);
    if (strcmp(v->status_elevador, "QUEBRADO") != 0 || possuiOrdemCorretivaAberta(c, v->placa)) {
        printf("  %s (%s): status %s registrado.\n", log.bus_id, v->placa, v->status_elevador);
        return 1;
    }
    sprintf(descricao, "[AUTO IoT] Falha no elevador reportada pelo sensor %s", log.bus_id);
    id = abrirOrdem(c, f, v->placa, "CORRETIVA", descricao, NULL);
    printf("  %s (%s): FALHA! OS automatica #%d aberta.\n", log.bus_id, v->placa, id);
    return 2;
}

/* RF08 - Le um arquivo JSON Lines (um pacote por linha) exportado pelo broker */
void ingerirArquivoIoT(Frota *f, CadastroOS *c) {
    FILE *arq = fopen(ARQ_ENTRADA_IOT, "r");
    char linha[512];
    int total = 0, ordens = 0, r;
    printf("\n=== RF08 - INGESTAO DE LOG TELEMETRICO ===\n");
    if (arq == NULL) {
        printf("  [!] Arquivo %s nao encontrado.\n", ARQ_ENTRADA_IOT);
        return;
    }
    while (fgets(linha, sizeof linha, arq) != NULL) {
        if (linha[0] != '{') continue;
        r = processarPacote(linha, f, c);
        if (r) total++;
        if (r == 2) ordens++;
    }
    fclose(arq);
    printf(">> %d pacote(s) gravados em %s; %d OS automatica(s).\n", total, ARQ_TELEMETRIA, ordens);
}

void ingerirPacoteManual(Frota *f, CadastroOS *c) {
    char json[400];
    printf("\nCole o pacote JSON em uma unica linha:\n");
    lerTexto("> ", json, sizeof json);
    processarPacote(json, f, c);
}
