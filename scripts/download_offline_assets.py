import os
import urllib.request
import gzip

def download_file(url, filepath):
    """Download a file from an URL to a local path (creates directories if needed)."""
    if os.path.exists(filepath):
        print(f"Already exists: {filepath}")
        return

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    print(f"Downloading {url} -> {filepath}...")
    try:
        urllib.request.urlretrieve(url, filepath)
    except Exception as e:
        print(f"  Error downloading {url}: {e}")

def main():
    base_dir = r"c:\Users\abhim\OneDrive\Documents\Mini Project\UHT\Main"
    libs_dir = os.path.join(base_dir, "libs")
    models_dir = os.path.join(base_dir, "models")
    
    os.makedirs(libs_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    # 1. Tesseract.js
    # We need: tesseract.min.js, worker.min.js, tesseract-core.wasm.js
    tess_version = "5.0.4"
    tess_base = f"https://cdn.jsdelivr.net/npm/tesseract.js@{tess_version}/dist"
    download_file(f"{tess_base}/tesseract.min.js", os.path.join(libs_dir, "tesseract.min.js"))
    download_file(f"{tess_base}/worker.min.js", os.path.join(libs_dir, "worker.min.js"))
    
    # Core WASM files for v5
    tess_core_v = "5.0.0" 
    tess_core_base = f"https://cdn.jsdelivr.net/npm/tesseract.js-core@{tess_core_v}"
    download_file(f"{tess_core_base}/tesseract-core.wasm.js", os.path.join(libs_dir, "tesseract-core.wasm.js"))
    download_file(f"{tess_core_base}/tesseract-core-simd.wasm.js", os.path.join(libs_dir, "tesseract-core-simd.wasm.js"))
    
    # Tesseract language data
    print("\nDownloading Tesseract Languages...")
    # Using the fast models from tesseract-ocr
    lang_base = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main"
    langs = ["eng", "fra", "deu", "spa", "hin", "chi_sim"]
    for lang in langs:
        url = f"{lang_base}/{lang}.traineddata"
        dest = os.path.join(models_dir, f"{lang}.traineddata")
        download_file(url, dest)
        # Note: Tesseract.js v5 often downloads language files compressed as gzip (.gz). 
        # When creating offline files, it expects a .gz file. Let's create one.
        dest_gz = dest + ".gz"
        if os.path.exists(dest) and not os.path.exists(dest_gz):
             print(f"Compressing {dest} to {dest_gz}...")
             with open(dest, 'rb') as f_in, gzip.open(dest_gz, 'wb') as f_out:
                  f_out.writelines(f_in)

    print("\nDownloading TensorFlow.js...")
    # 2. TFJS
    tfjs_version = "4.17.0"
    download_file(f"https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@{tfjs_version}/dist/tf.min.js", 
                  os.path.join(libs_dir, "tf.min.js"))

    print("\nDownloading MediaPipe & Hand Pose Models...")
    # 3. MediaPipe Hands
    mp_hands_version = "0.4.1646424915"
    mp_hands_base = f"https://cdn.jsdelivr.net/npm/@mediapipe/hands@{mp_hands_version}"
    download_file(f"{mp_hands_base}/hands.js", os.path.join(libs_dir, "hands.js"))
    
    # The solutionPath points to a directory of files loaded by WASM.
    hands_solution_dir = os.path.join(libs_dir, "hands")
    hands_files = [
        "hands.js", "hands_solution_packed_assets.data", "hands_solution_simd_wasm_bin.js", 
        "hands_solution_simd_wasm_bin.wasm", "hands_solution_wasm_bin.js", "hands_solution_wasm_bin.wasm"
    ]
    for hf in hands_files:
        download_file(f"{mp_hands_base}/{hf}", os.path.join(hands_solution_dir, hf))

    # tfjs-models hand-pose-detection
    hand_pose_ver = "2.0.1"
    download_file(f"https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection@{hand_pose_ver}/dist/hand-pose-detection.min.js",
                  os.path.join(libs_dir, "hand-pose-detection.min.js"))

    print("\nDownloading MediaPipe Face Mesh Models...")
    # 4. MediaPipe Face Mesh
    mp_face_version = "0.4.1633559619"
    mp_face_base = f"https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@{mp_face_version}"
    download_file(f"{mp_face_base}/face_mesh.js", os.path.join(libs_dir, "face_mesh.js"))

    face_solution_dir = os.path.join(libs_dir, "face_mesh")
    face_files = [
        "face_mesh.js", "face_mesh_solution_packed_assets.data", "face_mesh_solution_simd_wasm_bin.js",
        "face_mesh_solution_simd_wasm_bin.wasm", "face_mesh_solution_wasm_bin.js", "face_mesh_solution_wasm_bin.wasm"
    ]
    for ff in face_files:
        download_file(f"{mp_face_base}/{ff}", os.path.join(face_solution_dir, ff))

    # tfjs-models face-landmarks-detection
    face_landmarks_ver = "1.0.5"
    download_file(f"https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@{face_landmarks_ver}/dist/face-landmarks-detection.min.js",
                  os.path.join(libs_dir, "face-landmarks-detection.min.js"))

    print("\nAll downloads completed!")

if __name__ == "__main__":
    main()
