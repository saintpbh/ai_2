
import re
import os

input_file = "2025 『총회제반규칙집·정치치리총람집』.md"
output_file = "2025_총회제반규칙집_정치치리총람집_optimized.md"

# List of known regulation titles to detect sections and update context
# Based on the TOC seen in the file
regulations = {
    "한국기독교장로회총회 규칙": "총회규칙",
    "총회 실행위원회 규정": "실행위원회규정",
    "헌법위원회 규정": "헌법위원회규정",
    "고시위원회 규정": "고시위원회규정",
    "목사수련생 수련과정 시행세칙": "목사수련생시행세칙",
    "재단법인 한국기독교장로회총회 유지재단 정관": "유지재단정관",
    "유지재단 유지관리 시행세칙": "유지재단시행세칙",
    "장학기금 관리세칙": "장학기금관리세칙",
    "선교기금 관리세칙": "선교기금관리세칙",
    "교육위원회 규정": "교육위원회규정",
    "목회신학대학 정관": "목회신학대학정관",
    "선교위원회 규정": "선교위원회규정",
    "이주민선교운동본부 시행세칙": "이주민선교시행세칙",
    "국제협력선교위원회 규정": "국제협력선교규정",
    "교회와사회위원회 규정": "교회와사회규정",
    "사회선교사운영위원회 시행세칙": "사회선교사시행세칙",
    "평화ㆍ통일위원회 규정": "평화통일규정",
    "평화공동체운동본부 시행세칙": "평화공동체시행세칙",
    "기후정의위원회 규정": "기후정의규정",
    "생태공동체운동본부 시행세칙": "생태공동체시행세칙",
    "양성평등위원회 규정": "양성평등규정",
    "재단법인 한국기독교장로회총회 연금재단 정관": "연금재단정관",
    "연금재단 운영세칙": "연금재단운영세칙",
    "신도위원회 규정": "신도위원회규정",
    "재정위원회 규정": "재정위원회규정",
    "생활보장제위원회 규정": "생활보장제규정",
    "무임교역자 생활보장제 지급 시행세칙": "무임교역자지원세칙",
    "선거관리위원회 규정": "선거관리규정",
    "선거관리위원회 시행세칙": "선거관리시행세칙",
    "공천위원회 규정": "공천위원회규정",
    "총회 공천업무 시행세칙": "공천업무시행세칙",
    "총회 역사위원회 규정": "역사위원회규정",
    "총회 역사유적 지정 및 관리 규정": "역사유적관리규정",
    "총회 역사자료관 운영세칙": "역사자료관운영세칙",
    "노회록검사위원회 규정": "노회록검사규정",
    "노회록검사위원회 시행세칙": "노회록검사시행세칙",
    "학교법인 한신학원 정관": "한신학원정관",
    "학교법인 한신학원 정관 시행세칙": "한신학원정관시행세칙",
    "한신대학교신학대학원운영위원회 규정": "신대원운영규정",
    "기독교농촌개발원운영위원회 규정": "농촌개발원운영규정",
    "영성수련원운영위원회 규정": "영성수련원운영규정",
    "목회와신학연구소 정관": "목신연정관",
    "목회학박사원 정관": "목회학박사원정관",
    "사회복지법인 한기장복지재단 정관": "한기장복지재단정관",
    "사회복지법인 한기장복지재단 운영세칙": "한기장복지재단운영세칙",
    "총회 감사 규정": "총회감사규정",
    "총회본부 처무 규정": "총회본부처무규정",
    "한국기독교장로회총회 취업세칙": "취업세칙",
    "재정회계 세칙": "재정회계세칙",
    "여비 지급 세칙": "여비지급세칙",
    "총회장(葬) 규정": "총회장규정",
    "총회 의전 규정": "총회의전규정",
    "한국기독교장로회 일반회의 규칙": "일반회의규칙",
    "한국기독교장로회 법제업무 규칙": "법제업무규칙",
    "한국기독교장로회총회 기록관리 규칙": "기록관리규칙",
    "전자문서 및 전자문서보관소 시행세칙": "전자문서세칙",
    "정치치리총람집": "정치치리총람집"
}

def clean_line(line):
    # Remove page numbers and headers/footers
    # E.g. "14 / 총회제반규칙집", "총회 실행위원회 규정 / 33"
    if re.search(r'^\s*\d+\s*/', line): return ""
    if re.search(r'/\s*\d+\s*$', line): return ""
    if "CTP-1" in line: return ""
    return line

def optimize_file():
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    optimized_lines = []
    current_context = "총회제반규칙집"
    
    optimized_lines.append("# 제5편 총회제반규칙집 · 정치치리총람집\n\n")

    for line in lines:
        cleaned = clean_line(line.strip())
        if not cleaned:
            continue
        
        # Check for regulation titles to update context and add header
        is_regulation_title = False
        for title, tag in regulations.items():
            if cleaned == title:
                current_context = tag
                optimized_lines.append(f"\n## {title}\n\n")
                is_regulation_title = True
                break
        
        if is_regulation_title:
            continue

        # Check for Chapter headers
        if re.match(r'^제\d+장', cleaned):
            optimized_lines.append(f"\n### {cleaned}\n")
            continue
            
        # Check for Section headers (e.g. 제1절)
        if re.match(r'^제\d+절', cleaned):
            optimized_lines.append(f"\n#### {cleaned}\n")
            continue

        # Check for Articles (e.g. 제1조)
        if re.match(r'^제\d+조', cleaned):
            optimized_lines.append(f"\n##### [{current_context}] {cleaned}\n")
            continue

        # Check for Q&A in Polity Manual (e.g. 1. 문: ...) 
        # But looking at content, it seems to be "1. ... ?" "답 : ..."
        # I'll try to format them if they are obvious.
        
        # Normal lines
        optimized_lines.append(f"{cleaned}\n")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(optimized_lines)

    print(f"Optimized file saved to {output_file}")

if __name__ == "__main__":
    optimize_file()
