/*
 * util.c - Implementacao das funcoes utilitarias
 * Leitura segura com fgets (evita estouro de buffer do scanf("%s")).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>
#include "util.h"

/* Le uma linha do teclado, remove o '\n' e descarta o excesso. */
void lerTexto(const char *rotulo, char *destino, size_t tamanho) {
    do {
        printf("%s", rotulo);
        fflush(stdout);
        if (fgets(destino, (int)tamanho, stdin) == NULL) {
            destino[0] = '\0';
            return;
        }
        if (strchr(destino, '\n') == NULL) {
            int c;
            while ((c = getchar()) != '\n' && c != EOF) { /* descarta */ }
        }
        destino[strcspn(destino, "\r\n")] = '\0';
        if (contemSeparador(destino)) {
            printf("  [!] O caractere ';' e reservado ao arquivo de dados.\n");
            destino[0] = '\0';
        }
    } while (destino[0] == '\0');
}

/* Le um inteiro dentro do intervalo [minimo, maximo], repetindo ate ser valido. */
int lerInteiro(const char *rotulo, int minimo, int maximo) {
    char buffer[32];
    char *fim;
    long valor;
    for (;;) {
        printf("%s", rotulo);
        fflush(stdout);
        if (fgets(buffer, sizeof buffer, stdin) == NULL) return minimo;
        valor = strtol(buffer, &fim, 10);
        if (fim != buffer && (*fim == '\n' || *fim == '\0' || *fim == '\r')
            && valor >= minimo && valor <= maximo) {
            return (int)valor;
        }
        printf("  [!] Valor invalido. Informe um numero entre %d e %d.\n", minimo, maximo);
    }
}

void paraMaiusculas(char *texto) {
    for (; *texto; texto++) *texto = (char)toupper((unsigned char)*texto);
}

void dataHoraAtual(char *destino, size_t tamanho) {
    time_t agora = time(NULL);
    struct tm *t = localtime(&agora);
    strftime(destino, tamanho, "%Y-%m-%d %H:%M", t);
}

int contemSeparador(const char *texto) {
    return strchr(texto, ';') != NULL;
}

void pausar(void) {
    char lixo[8];
    printf("\nPressione ENTER para continuar...");
    fflush(stdout);
    if (fgets(lixo, sizeof lixo, stdin) == NULL) { /* fim da entrada */ }
}
