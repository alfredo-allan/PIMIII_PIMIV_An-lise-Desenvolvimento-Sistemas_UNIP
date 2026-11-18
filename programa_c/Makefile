CC = gcc
CFLAGS = -std=c99 -Wall -Wextra -pedantic -O2
SRC = $(wildcard src/*.c)

urbano: $(SRC) $(wildcard src/*.h)
	$(CC) $(CFLAGS) -o $@ $(SRC)

clean:
	rm -f urbano urbano.exe *.tmp
