/*
 * util.h - Funcoes utilitarias de entrada, texto e data
 * UrbanoAcessivel S.A. - PIM IV
 */
#ifndef UTIL_H
#define UTIL_H

#include <stddef.h>

#define TAM_DATA 20 /* "AAAA-MM-DD HH:MM" + '\0' com folga */

void lerTexto(const char *rotulo, char *destino, size_t tamanho);
int  lerInteiro(const char *rotulo, int minimo, int maximo);
void paraMaiusculas(char *texto);
void dataHoraAtual(char *destino, size_t tamanho);
int  contemSeparador(const char *texto);
void pausar(void);

#endif
