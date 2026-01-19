const apiKeyInput = document.getElementById('api-key');
const fileInput = document.getElementById('file-input');
const createBtn = document.getElementById('create-btn');
const logArea = document.getElementById('log-area');
const resultArea = document.getElementById('result-area');
const assistantIdResult = document.getElementById('assistant-id-result');
const fileList = document.getElementById('file-list');

// API URL
const OPENAI_API_BASE = 'https://api.openai.com/v1';

// 로깅 함수
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span style="opacity:0.6;">[${new Date().toLocaleTimeString()}]</span> ${message}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

// 파일 선택 표시
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileList.textContent = `선택된 파일: ${fileInput.files.length}개`;
        for (let i = 0; i < fileInput.files.length; i++) {
            fileList.innerHTML += `<br> - ${fileInput.files[i].name}`;
        }
    } else {
        fileList.textContent = '';
    }
});

// 탭 전환 로직
let currentTab = 'file'; // 'file' or 'text'
window.switchTab = function (tabId) {
    currentTab = tabId;

    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 탭 내용 활성화
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

// 메인 생성 로직
createBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    let files = [];

    if (!apiKey) {
        alert('API 키를 입력해주세요.');
        return;
    }

    // 탭에 따라 파일 소스 결정
    if (currentTab === 'file') {
        files = Array.from(fileInput.files);
        if (files.length === 0) {
            alert('업로드할 파일을 선택해주세요.');
            return;
        }
    } else if (currentTab === 'text') {
        const filename = document.getElementById('md-filename').value.trim();
        const content = document.getElementById('md-content').value.trim();

        if (!filename) {
            alert('파일 이름을 입력해주세요.');
            return;
        }
        if (!content) {
            alert('내용을 입력해주세요.');
            return;
        }

        // 텍스트를 Markdown 파일(Blob)로 변환
        const blob = new Blob([content], { type: 'text/markdown' });
        // File 객체 생성 (IE/Edge 구버전 호환성 문제 시 Blob 사용 로직 분기 필요하지만 모던 브루저는 File 생성자 지원)
        const file = new File([blob], `${filename}.md`, { type: 'text/markdown' });
        files = [file];
    }

    createBtn.disabled = true;
    createBtn.textContent = '진행 중... (창을 닫지 마세요)';
    logArea.innerHTML = '';
    resultArea.style.display = 'none';

    try {
        log('작업을 시작합니다...', 'info');

        // 1. 파일 업로드
        const fileIds = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            log(`파일 업로드 중: ${file.name}...`, 'info');
            const fileId = await uploadFile(apiKey, file);
            fileIds.push(fileId);
            log(`파일 업로드 완료: ${file.name} (ID: ${fileId})`, 'success');
        }

        // 2. 벡터 스토어 생성
        log('벡터 스토어(지식 저장소) 생성 중...', 'info');
        const vectorStoreId = await createVectorStore(apiKey, 'PROK_Constitution_Store', fileIds);
        log(`벡터 스토어 생성 완료 (ID: ${vectorStoreId})`, 'success');

        // 3. 어시스턴트 생성
        log('AI 어시스턴트 생성 중...', 'info');
        const assistantId = await createAssistant(apiKey, vectorStoreId);
        log(`🎉 모든 작업 완료! 어시스턴트 ID: ${assistantId}`, 'success');

        // 결과 표시
        assistantIdResult.value = assistantId;
        resultArea.style.display = 'block';

    } catch (error) {
        log(`오류 발생: ${error.message}`, 'error');
        console.error(error);
        alert('오류가 발생했습니다. 로그를 확인해주세요.');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = '🚀 AI 어시스턴트 생성 및 학습 시작';
    }
});

// 1. 파일 업로드 함수
async function uploadFile(apiKey, file) {
    const formData = new FormData();
    formData.append('purpose', 'assistants');
    formData.append('file', file);

    const response = await fetch(`${OPENAI_API_BASE}/files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || '파일 업로드 실패');
    return data.id;
}

// 2. 벡터 스토어 생성 및 파일 연결
async function createVectorStore(apiKey, name, fileIds) {
    // 스토어 생성
    const response = await fetch(`${OPENAI_API_BASE}/vector_stores`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({ name: name })
    });

    const storeData = await response.json();
    if (!response.ok) throw new Error(storeData.error?.message || '벡터 스토어 생성 실패');
    const storeId = storeData.id;

    // 파일 일괄 추가 (Batch)
    const batchResponse = await fetch(`${OPENAI_API_BASE}/vector_stores/${storeId}/file_batches`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({ file_ids: fileIds })
    });

    if (!batchResponse.ok) {
        const err = await batchResponse.json();
        throw new Error(err.error?.message || '벡터 스토어 파일 추가 실패');
    }

    // 배치 처리가 완료될 때까지 기다릴 수도 있지만, 일단 생성되면 어시스턴트에 연결 가능하므로 패스
    return storeId;
}

// 3. 어시스턴트 생성
async function createAssistant(apiKey, vectorStoreId) {
    const systemPrompt = `You are a strict, retrieval-augmented AI assistant for the Presbyterian Church in the Republic of Korea (PROK).
    1. GROUNDING RULE: You must answer questions using ONLY the information found in the provided files (Vector Store).
    2. ANTI-HALLUCINATION: If the answer is not explicitly stated in the documents, you MUST say "I cannot find information about [topic] in the provided documents." Do NOT make up answers or use outside knowledge (e.g., general Christian theology).
    3. CITATION RULE: You must cite the exact source document and page number for every claim. Format: [Source: Document Name, p.Page Number].
    4. TONE: Professional, objective, and precise.`;

    const response = await fetch(`${OPENAI_API_BASE}/assistants`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
            name: "PROK Constitution Expert",
            instructions: systemPrompt,
            model: "gpt-4o-mini", // 비용 효율적인 모델 사용
            tools: [{ type: "file_search" }],
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStoreId]
                }
            }
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || '어시스턴트 생성 실패');
    return data.id;
}

function copyResult() {
    const copyText = document.getElementById("assistant-id-result");
    copyText.select();
    document.execCommand("copy");
    alert("어시스턴트 ID가 복사되었습니다: " + copyText.value);
}
