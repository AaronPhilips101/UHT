import serial
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Automatically handles all OPTIONS and cross-origin requests

# port
try:
    ser = serial.Serial('/dev/ttyUSB0', 9600)
    time.sleep(2)
except Exception as e:
    print(f"Warning: Could not open serial port: {e}")
    ser = None

braille_map = {
    "a": "100000", "b": "110000", "c": "100100", "d": "100110", "e": "100010",
    "f": "110100", "g": "110110", "h": "110010", "i": "010100", "j": "010110",
    "k": "101000", "l": "111000", "m": "101100", "n": "101110", "o": "101010",
    "p": "111100", "q": "111110", "r": "111010", "s": "011100", "t": "011110",
    "u": "101001", "v": "111001", "w": "010111", "x": "101101", "y": "101111",
    "z": "101011"
}

def send_letter(letter):
    if ser is None:
        print(f"[Simulated Serial] Sent: {letter}")
        return
    if letter == " ":
        print("-> Sending SPACE to Arduino")
        ser.write(("SPACE\n").encode())
        time.sleep(1)
        return

    if letter in braille_map:
        pattern = braille_map[letter]
        print(f"-> Sending letter '{letter}' as pattern '{pattern}' to Arduino")
        ser.write((pattern + "\n").encode())
        time.sleep(2)
    else:
        print(f"-> Ignoring unknown letter '{letter}'")

@app.route('/print-braille', methods=['POST'])
def print_braille():
    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '').lower()
        print(f"Received text to print: '{text}'")
        
        # In a real production app you'd run this heavily blocking 
        # sleep-based loop in a background thread, but for this 
        # local tool, it is fine here.
        for char in text:
            if char == " ":
                time.sleep(1)
                send_letter(char)
            else:
                send_letter(char)
        
        return jsonify({'status': 'success', 'message': f'Printing {len(text)} characters'})
    except Exception as e:
        print(f"Server processing error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    print("Starting Braille Flask server on port 5001...")
    try:
        app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
    except KeyboardInterrupt:
        pass
    if ser:
        ser.close()
    print("Server stopped.")
