/*
 * auth.h - Autenticacao de operadores por perfil (RF07)
 */
#ifndef AUTH_H
#define AUTH_H

#define ARQ_OPERADORES "operadores.txt"

typedef enum { PERFIL_NENHUM = 0, PERFIL_GESTOR, PERFIL_MECANICO, PERFIL_FISCAL } Perfil;

typedef struct {
    char login[20];
    unsigned long hash_senha;
    Perfil perfil;
} Operador;

unsigned long hashSenha(const char *senha);
Perfil autenticar(char *login_out, int tentativas);
const char *nomePerfil(Perfil p);

#endif
