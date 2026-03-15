import os
import urllib.request
import json

def download_jsdelivr_package(package_name, version, out_dir):
    api_url = f"https://data.jsdelivr.com/v1/package/npm/{package_name}@{version}"
    print(f"Fetching file list for {package_name}@{version}...")
    
    req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Failed to fetch metadata for {package_name}: {e}")
        return

    # Extract all files
    files_to_download = []
    def traverse(node, current_path=""):
        if node['type'] == 'directory':
            for child in node['files']:
                traverse(child, current_path + "/" + node['name'] if current_path else node['name'])
        elif node['type'] == 'file':
            path = current_path + "/" + node['name'] if current_path else node['name']
            files_to_download.append(path)
            
    # The root files are in data['files']
    for child in data['files']:
        traverse(child)

    base_dl_url = f"https://cdn.jsdelivr.net/npm/{package_name}@{version}"
    
    os.makedirs(out_dir, exist_ok=True)
    
    for f in files_to_download:
        clean_f = f.lstrip('/')
        url = f"{base_dl_url}/{clean_f}"
        dest = os.path.join(out_dir, clean_f.replace('/', os.sep))
        
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest):
            print(f"Downloading {clean_f}...")
            try:
                urllib.request.urlretrieve(url, dest)
            except Exception as e:
                print(f"  Failed: {e}")
        else:
            print(f"Already exists: {clean_f}")

if __name__ == "__main__":
    base_dir = r"c:\Users\abhim\OneDrive\Documents\Mini Project\UHT\Main\libs"
    
    # MediaPipe Hands
    download_jsdelivr_package("@mediapipe/hands", "0.4.1646424915", os.path.join(base_dir, "hands"))
    
    # MediaPipe Face Mesh
    download_jsdelivr_package("@mediapipe/face_mesh", "0.4.1633559619", os.path.join(base_dir, "face_mesh"))
    
    print("Done!")
