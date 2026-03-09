#include <Servo.h>

Servo servos[6];

// Logical dot order (1–6)
int pins[6] = {7, 6, 2, 5, 3, 4};
int direction[6] = {-1, -1, 1, 1, 1, -1};

int upAngle = 90;
int downAngle = 80;

void setup() {
  Serial.begin(9600);

  for (int i = 0; i < 6; i++) {
    servos[i].attach(pins[i]);
  }

  resetDots();
}

void loop() {

  if (Serial.available()) {

    String data = Serial.readStringUntil('\n');
    data.trim();

    // If space received
    if (data == "SPACE") {
      resetDots();
      delay(1200);   // longer delay for space
      return;
    }

    // If braille pattern received
    if (data.length() == 6) {

      displayPattern(data);
      delay(1500);   // show letter

      resetDots();   // go back to idle
      delay(500);    // gap before next
    }
  }
}

void displayPattern(String pattern) {

  for (int i = 0; i < 6; i++) {

    if (pattern[i] == '1') {
      servos[i].write(adjustAngle(i, upAngle));
    } else {
      servos[i].write(adjustAngle(i, downAngle));
    }
  }
}

void resetDots() {
  for (int i = 0; i < 6; i++) {
    servos[i].write(adjustAngle(i, downAngle));
  }
}

int adjustAngle(int index, int angle) {
  if (direction[index] == 1)
    return angle;
  else
    return 180 - angle;
}