/*
 * auth.c - Controle de acesso. As senhas sao gravadas como hash djb2 (nunca em
 * texto puro). Observacao academica: djb2 nao e criptografico; em producao
 * usa-se bcrypt/Argon2 com sal.
 */
#include <stdio.h>
#include <string.h>
#include "auth.h"
#include "util.h"

unsigned long hashSenha(const char *senha) {
    unsigned long h = 5381;
    int c;
    while ((c = (unsigned char)*senha++) != 0) h = (((h << 5) + h) + (unsigned long)c) & 0xFFFFFFFFUL; /* 32 bits: mesmo valor no Windows e no Linux */
    return h;
}

const char *nomePerfil(Perfil p) {
    switch (p) {
        case PERFIL_GESTOR:   return "GESTOR";
        case PERFIL_MECANICO: return "MECANICO";
        case PERFIL_FISCAL:   return "FISCAL";
        default:              return "NENHUM";
    }
}

/* Cria os operadores padrao na primeira execucao. */
static void criarOperadoresPadrao(void) {
    FILE *arq = fopen(ARQ_OPERADORES, "w");
    if (arq == NULL) return;
    fprintf(arq, "gestor;%lu;%d\n", hashSenha("gestor123"), PERFIL_GESTOR);
    fprintf(arq, "mecanico;%lu;%d\n", hashSenha("mec123"), PERFIL_MECANICO);
    fprintf(arq, "fiscal;%lu;%d\n", hashSenha("fiscal123"), PERFIL_FISCAL);
    fclose(arq);
    printf("\n(Primeira execucao: operadores padrao criados em %s)\n", ARQ_OPERADORES);
    printf("  +-----------+------------+------------------------------------+\n");
    printf("  | USUARIO   | SENHA      | PERMISSOES                         |\n");
    printf("  +-----------+------------+------------------------------------+\n");
    printf("  | gestor    | gestor123  | acesso total                       |\n");
    printf("  | mecanico  | mec123     | diagnostico e ordens de servico    |\n");
    printf("  | fiscal    | fiscal123  | somente consultas e relatorios     |\n");
    printf("  +-----------+------------+------------------------------------+\n");
}

static Perfil verificar(const char *login, const char *senha) {
    FILE *arq = fopen(ARQ_OPERADORES, "r");
    Operador op;
    int perfil;
    unsigned long h = hashSenha(senha);
    if (arq == NULL) {
        criarOperadoresPadrao();
        arq = fopen(ARQ_OPERADORES, "r");
        if (arq == NULL) return PERFIL_NENHUM;
    }
    while (fscanf(arq, "%19[^;];%lu;%d\n", op.login, &op.hash_senha, &perfil) == 3) {
        if (strcmp(op.login, login) == 0 && op.hash_senha == h) {
            fclose(arq);
            return (Perfil)perfil;
        }
    }
    fclose(arq);
    return PERFIL_NENHUM;
}

Perfil autenticar(char *login_out, int tentativas) {
    char login[20], senha[32];
    Perfil p;
    FILE *teste = fopen(ARQ_OPERADORES, "r");
    if (teste == NULL) criarOperadoresPadrao(); else fclose(teste);

    while (tentativas-- > 0) {
        printf("\n--- LOGIN DE OPERADOR (RF07) ---\n");
        printf("(Perfis: gestor, mecanico, fiscal. Senhas padrao no README.md)\n");
        lerTexto("Usuario: ", login, sizeof login);
        lerTexto("Senha: ", senha, sizeof senha);
        p = verificar(login, senha);
        if (p != PERFIL_NENHUM) {
            strcpy(login_out, login);
            return p;
        }
        printf("  [!] Credenciais invalidas. Tentativas restantes: %d\n", tentativas);
    }
    return PERFIL_NENHUM;
}
