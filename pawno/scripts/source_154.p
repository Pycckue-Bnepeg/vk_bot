#include <core>

forward main();

public main() {
  new strHello[] = "Hello!";
  new intValue = 0x7F;
  new fuckgg = 1337;
  new unused = 0x100;
  printf("Say %s fuckgg %x wow %d", strHello, intValue, 1337); // Say Hello! fuckgg 0x7F wow 1337
  test(intValue);
  return intValue;
}