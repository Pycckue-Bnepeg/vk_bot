#include <core>

forward main();

public main() {
  new strHello[] = "Hello!";
  new intValue = 0x7F;
  new unused = 0x100;
  printf("Say %s fuckgg %d", strHello, intValue);
  return intValue;
}