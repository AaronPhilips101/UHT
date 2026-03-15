import os
import re
import urllib.request
import urllib.error

FONTS_CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"
MAIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Main'))
FONTS_DIR = os.path.join(MAIN_DIR, 'fonts')

def download_fonts():
    os.makedirs(FONTS_DIR, exist_ok=True)
    
    # Modern Chrome User-Agent ensures we get WOFF2 format
    req = urllib.request.Request(
        FONTS_CSS_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            css_content = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching fonts CSS: {e}")
        return
        
    print("Fetched fonts CSS.")

    local_css_content = css_content
    
    # Find all url(...)
    url_pattern = re.compile(r'url\((https://[^)]+)\)')
    urls = url_pattern.findall(css_content)
    
    downloaded_urls = {}
    
    for url in urls:
        if url in downloaded_urls:
            continue
            
        # extract filename
        filename = url.split('/')[-1]
        filepath = os.path.join(FONTS_DIR, filename)
        
        print(f"Downloading {filename}...")
        try:
            urllib.request.urlretrieve(url, filepath)
            downloaded_urls[url] = filename
            
            # replace in CSS
            local_css_content = local_css_content.replace(url, f"./{filename}")
        except Exception as e:
            print(f"Failed to download {url}: {e}")
            
    # Save the local CSS
    css_filepath = os.path.join(FONTS_DIR, 'fonts.css')
    with open(css_filepath, 'w', encoding='utf-8') as f:
        f.write(local_css_content)
        
    print(f"Saved local fonts CSS to {css_filepath}")

if __name__ == "__main__":
    download_fonts()
