import os
import subprocess
import shutil
import glob

def run_command(command):
    print(f"Running: {' '.join(command)}")
    result = subprocess.run(command, text=True)
    if result.returncode != 0:
        print(f"Error executing command: {' '.join(command)}")
        exit(1)

def setup():
    print("Installing npm dependencies...")
    run_command(["npm", "install"])

    print("Setting up offline translation dependencies...")

    # Create the libs directory if it doesn't exist
    libs_dir = "libs"
    os.makedirs(libs_dir, exist_ok=True)

    # Source files
    transformers_min_js = os.path.join("node_modules", "@xenova", "transformers", "dist", "transformers.min.js")
    wasm_pattern = os.path.join("node_modules", "@xenova", "transformers", "dist", "*.wasm")

    # Copy transformers.min.js
    if os.path.exists(transformers_min_js):
        print(f"Copying {transformers_min_js} to {libs_dir}/")
        shutil.copy(transformers_min_js, libs_dir)
    else:
        print(f"Warning: {transformers_min_js} not found.")

    # Copy all .wasm files
    wasm_files = glob.glob(wasm_pattern)
    for wasm_file in wasm_files:
        print(f"Copying {wasm_file} to {libs_dir}/")
        shutil.copy(wasm_file, libs_dir)
        
    if not wasm_files:
        print(f"Warning: No .wasm files found matching {wasm_pattern}.")

    print("Setup Complete! The necessary AI models and WASM files have been moved into your libs directory.")

if __name__ == "__main__":
    setup()
