/*
 * telemetria.h - Ingestao de log telemetrico IoT (RF08) com abertura automatica de OS (RF03)
 */
#ifndef TELEMETRIA_H
#define TELEMETRIA_H

#include "veiculo.h"
#include "ordem.h"

#define ARQ_TELEMETRIA "telemetria_log.txt"
#define ARQ_ENTRADA_IOT "telemetria_entrada.jsonl"

typedef struct {
    char bus_id[12];
    char timestamp[25];
    char ramp_status[12];   /* OK, WARN, FAIL */
    double battery_voltage;
} TelemetriaLog;

int  extrairCampoJson(const char *json, const char *chave, char *destino, size_t tam);
int  interpretarPacote(const char *json, TelemetriaLog *log);
int  processarPacote(const char *json, Frota *f, CadastroOS *c);
void ingerirArquivoIoT(Frota *f, CadastroOS *c);
void ingerirPacoteManual(Frota *f, CadastroOS *c);

#endif
