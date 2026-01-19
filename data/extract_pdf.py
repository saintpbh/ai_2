
import pdfplumber
import os


import pdfplumber
import os
import glob

# Get all PDF files in current directory
pdf_files = glob.glob("*.pdf")

for pdf_path in pdf_files:
    # Skip already processed or unrelated files if needed
    # (You might want to skip the one we already did, but re-doing it is fine too to be safe)
    
    filename = os.path.splitext(pdf_path)[0]
    md_path = f"{filename}.md"
    
    print(f"Processing {pdf_path}...")
    
    try:
        full_text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n\n"
        
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(full_text)
            
        print(f" -> Saved to {md_path}")
        
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
