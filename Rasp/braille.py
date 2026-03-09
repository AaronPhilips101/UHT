import serial
import time

# port
ser = serial.Serial('/dev/ttyUSB0', 9600)
time.sleep(2)

braille_map = {
    "a": "100000",
    "b": "110000",
    "c": "100100",
    "d": "100110",
    "e": "100010",
    "f": "110100",
    "g": "110110",
    "h": "110010",
    "i": "010100",
    "j": "010110",
    "k": "101000",
    "l": "111000",
    "m": "101100",
    "n": "101110",
    "o": "101010",
    "p": "111100",
    "q": "111110",
    "r": "111010",
    "s": "011100",
    "t": "011110",
    "u": "101001",
    "v": "111001",
    "w": "010111",
    "x": "101101",
    "y": "101111",
    "z": "101011"
}

def send_letter(letter):
    if letter == " ":
        ser.write(("SPACE\n").encode())
        time.sleep(1)
        return

    if letter in braille_map:
        pattern = braille_map[letter]
        ser.write((pattern + "\n").encode())
        time.sleep(2)

while True:
    text = input("Enter text: ")

    for char in text:
        if char == " ":
            time.sleep(1)
        else:
            send_letter(char)