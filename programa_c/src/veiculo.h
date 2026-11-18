/*
 * veiculo.h - Cadastro de onibus e diagnostico de acessibilidade (RF01, RF02, RF06)
 */
#ifndef VEICULO_H
#define VEICULO_H

#define MAX_VEICULOS 500
#define ARQ_FROTA "frota_urbanoacessivel.txt"

typedef struct {
    int  id;
    char placa[9];            /* AAA0A00 ou AAA-0000 */
    char prefixo[12];         /* identificador IoT, ex.: BUS-9042 */
    char modelo[30];
    int  ano;
    char status_elevador[20]; /* OPERACIONAL, ALERTA, QUEBRADO */
    char status_rampa[20];    /* OPERACIONAL, ALERTA, QUEBRADO */
} Veiculo;

typedef struct {
    Veiculo itens[MAX_VEICULOS];
    int quantidade;
    int proximo_id;
} Frota;

int  carregarFrota(Frota *f);
int  salvarFrota(const Frota *f);
int  buscarVeiculoPorPlaca(const Frota *f, const char *placa);
int  buscarVeiculoPorPrefixo(const Frota *f, const char *prefixo);
int  statusValido(const char *status);
void cadastrarVeiculo(Frota *f);
void registrarDiagnostico(Frota *f);
void listarFrota(const Frota *f);
void relatorioFrotaOperacional(const Frota *f);

#endif
