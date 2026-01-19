// 챗봇 상태 관리
let isModalOpen = false;
let isSetupPanelOpen = false;
let conversationHistory = [];
let conversationCount = 0;
let MAX_CONVERSATIONS = 10;
let currentThreadId = null; // 현재 대화 스레드 ID

// AI 설정 관리
let aiSettings = {
    apiKey: '',
    assistantId: '', // Assistants API ID
    saveHistory: false,
    typingAnimation: true
};

// OpenAI API 기본 URL
const OPENAI_API_BASE = 'https://api.openai.com/v1';

// DOM 요소들
const searchInput = document.getElementById('search-input');
const chatbotModal = document.getElementById('chatbot-modal');
const chatbotClose = document.getElementById('chatbot-close');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-btn');
const conversationCounter = document.getElementById('conversation-counter');

// 셋업 패널 DOM 요소들
const setupButton = document.getElementById('setup-button');
const setupPanel = document.getElementById('setup-panel');
const setupClose = document.getElementById('setup-close');
const apiKeyInput = document.getElementById('api-key-input');
const assistantIdInput = document.getElementById('assistant-id-input');
const maxConversationsInput = document.getElementById('max-conversations-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const testApiBtn = document.getElementById('test-api-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// === Core Logic: Assistants API ===

// 1. 스레드 생성 (대화 시작 시 1회)
async function createThread() {
    try {
        const response = await fetch(`${OPENAI_API_BASE}/threads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '스레드 생성 실패');
        return data.id;
    } catch (error) {
        console.error('스레드 생성 오류:', error);
        throw error;
    }
}

// 2. 메시지 추가 및 실행 (Run)
async function sendMessageToAssistant(message) {
    if (!aiSettings.apiKey || !aiSettings.assistantId) {
        throw new Error('API 키 또는 Assistant ID가 설정되지 않았습니다.');
    }

    // 스레드가 없으면 생성
    if (!currentThreadId) {
        currentThreadId = await createThread();
    }

    try {
        // 2-1. 메시지 추가
        await fetch(`${OPENAI_API_BASE}/threads/${currentThreadId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                role: "user",
                content: message
            })
        });

        // 2-2. 실행 (Run) 생성
        const runResponse = await fetch(`${OPENAI_API_BASE}/threads/${currentThreadId}/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                assistant_id: aiSettings.assistantId,
                // Enforce strict citation and grounding (Anti-Hallucination)
                additional_instructions: "Answer the user's question using ONLY the provided files. Do NOT use outside knowledge or general information. If the answer is not found in the documents, state clearly: 'The provided documents do not contain information about [topic].' You must precisely cite the source for every statement in the format: [Source: Document, p.Page]. Example: [Source: 104th Minutes, p.123]."
            })
        });

        const runData = await runResponse.json();
        if (!runResponse.ok) throw new Error(runData.error?.message || 'Run 생성 실패');

        // 2-3. 완료 대기 (Polling)
        return await pollForCompletion(currentThreadId, runData.id);

    } catch (error) {
        console.error('Assistant API 호출 오류:', error);
        throw error;
    }
}

// 3. 실행 상태 확인 (Polling)
async function pollForCompletion(threadId, runId) {
    let status = 'queued';

    while (status !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기

        const response = await fetch(`${OPENAI_API_BASE}/threads/${threadId}/runs/${runId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${aiSettings.apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        const data = await response.json();
        status = data.status;

        if (status === 'failed' || status === 'cancelled' || status === 'expired') {
            throw new Error(`Run failed with status: ${status}`);
        }
    }

    // 완료되면 메시지 가져오기
    return await getMessages(threadId);
}

// 4. 메시지 가져오기
async function getMessages(threadId) {
    const response = await fetch(`${OPENAI_API_BASE}/threads/${threadId}/messages`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${aiSettings.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
        }
    });

    const data = await response.json();
    // 가장 최근 메시지 (AI 응답) 반환
    const lastMessage = data.data[0];
    if (lastMessage.role === 'assistant') {
        return lastMessage.content[0].text.value;
    }
    return "응답을 가져올 수 없습니다.";
}

// === UI & Event Handlers ===

function openSetupPanel() {
    isSetupPanelOpen = true;
    setupPanel.classList.add('show');
    loadSettingsToUI();
    checkApiStatus();
}

function closeSetupPanel() {
    isSetupPanelOpen = false;
    setupPanel.classList.remove('show');
}

function loadSettingsToUI() {
    if (aiSettings.apiKey) {
        apiKeyInput.value = aiSettings.apiKey; // 간편하게 그냥 표시 (보안보다 편의성 우선시 요청된 경우)
    }
    assistantIdInput.value = aiSettings.assistantId || '';
    maxConversationsInput.value = MAX_CONVERSATIONS;
}

function saveSettings(showAlert = true) {
    const apiKey = apiKeyInput.value.trim();
    const assistantId = assistantIdInput.value.trim();

    if (!apiKey) {
        if (showAlert) alert('API 키를 입력해주세요.');
        return;
    }
    if (!assistantId) {
        if (showAlert) alert('Assistant ID를 입력해주세요.');
        return;
    }

    aiSettings.apiKey = apiKey;
    aiSettings.assistantId = assistantId;
    MAX_CONVERSATIONS = parseInt(maxConversationsInput.value);

    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    localStorage.setItem('maxConversations', MAX_CONVERSATIONS);

    updateConversationCounter();
    checkApiStatus();

    if (showAlert) alert('설정이 저장되었습니다!');
}

function resetSettings() {
    if (confirm('설정을 초기화하시겠습니까?')) {
        localStorage.removeItem('aiSettings');
        localStorage.removeItem('maxConversations');
        aiSettings = { apiKey: '', assistantId: '', saveHistory: false, typingAnimation: true }; // 초기화
        loadSettingsToUI();
        alert('초기화되었습니다.');
    }
}

async function checkApiStatus() {
    if (aiSettings.apiKey && aiSettings.assistantId) {
        updateApiStatus(true, '설정됨');
    } else {
        updateApiStatus(false, '설정 핗요');
    }
}

function updateApiStatus(isConnected, message) {
    statusIndicator.className = `status-indicator ${isConnected ? '' : 'error'}`;
    statusText.textContent = message;
}

// 모달 열기
async function openChatbotModal(initialQuestion) {
    if (!aiSettings.apiKey || !aiSettings.assistantId) {
        alert('API 키와 Assistant ID 설정이 필요합니다.');
        openSetupPanel();
        return;
    }

    isModalOpen = true;
    chatbotModal.classList.add('show');
    conversationCount = 0;
    currentThreadId = null; // 모달 열 때마다 새로운 대화 시작 (선택 사항)
    updateConversationCounter();

    chatbotMessages.innerHTML = ''; // 이전 대화 클리어

    if (initialQuestion) {
        addMessage('user', initialQuestion);
        processUserMessage(initialQuestion);
    }
}

// 모달 닫기
function closeChatbotModal() {
    isModalOpen = false;
    chatbotModal.classList.remove('show');
}

// 메시지 처리 Main Loop
async function processUserMessage(message) {
    showTypingIndicator();

    try {
        const response = await sendMessageToAssistant(message);
        replaceTypingIndicatorWithResponse(response);
    } catch (error) {
        replaceTypingIndicatorWithResponse("오류가 발생했습니다: " + error.message);
    }
}

function sendMessage() {
    const message = chatbotInput.value.trim();
    if (!message) return;

    addMessage('user', message);
    chatbotInput.value = '';

    processUserMessage(message);
}

// 대화 내용 저장 함수
function saveConversation() {
    if (conversationHistory.length === 0) {
        alert('저장할 대화 내용이 없습니다.');
        return;
    }

    let content = "한국기독교장로회 헌법 AI 상담 기록\n";
    content += `저장 일시: ${new Date().toLocaleString()}\n`;
    content += "========================================\n\n";

    conversationHistory.forEach(msg => {
        const role = msg.sender === 'user' ? '질문자' : 'AI 어시스턴트';
        content += `[${role}]\n${msg.content}\n\n`;
    });

    content += "========================================\n";
    content += "본 내용은 AI에 의해 생성되었으며, 법적 효력이 없습니다.";

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PROK_헌법상담_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// UI 헬퍼 함수들
function addMessage(sender, content) {
    // 히스토리 저장
    conversationHistory.push({ sender, content, timestamp: new Date() });

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}`;

    // Markdown 파싱 (marked 라이브러리 사용)
    const parsedContent = typeof marked !== 'undefined' ? marked.parse(content) : content.replace(/\n/g, '<br>');

    messageDiv.innerHTML = `<div class="message-content">${parsedContent}</div>`;
    chatbotMessages.appendChild(messageDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message bot';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<div class="message-content">AI가 헌법을 검색 중입니다...</div>';
    chatbotMessages.appendChild(typingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function replaceTypingIndicatorWithResponse(response) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        // Remove raw citation markers (handle variations like 【4:4 † source】 or 【4:4†source】)
        const cleanResponse = response.replace(/【\d+:\d+[^】]*】/g, '');

        // 응답 텍스트에만 히스토리 저장 (타이핑 인디케이터는 제외)
        conversationHistory.push({ sender: 'bot', content: cleanResponse, timestamp: new Date() });

        // Markdown 파싱
        const parsedContent = typeof marked !== 'undefined' ? marked.parse(cleanResponse) : cleanResponse.replace(/\n/g, '<br>');

        indicator.innerHTML = `<div class="message-content">${parsedContent}</div>`;
        indicator.id = ''; // ID 제거
    }
}

function updateConversationCounter() {
    if (conversationCounter) conversationCounter.textContent = `대화: ${conversationCount}/${MAX_CONVERSATIONS}`;
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
    // 저장된 설정 로드
    const savedSettings = localStorage.getItem('aiSettings');
    if (savedSettings) aiSettings = JSON.parse(savedSettings);

    const savedMax = localStorage.getItem('maxConversations');
    if (savedMax) MAX_CONVERSATIONS = parseInt(savedMax);

    checkApiStatus();

    // 버튼 이벤트
    setupButton.addEventListener('click', openSetupPanel);
    setupClose.addEventListener('click', () => {
        saveSettings(false); // 닫을 때 조용히 저장 (showAlert=false)
        closeSetupPanel();
    });
    saveSettingsBtn.addEventListener('click', () => saveSettings(true)); // 저장 버튼은 알림 표시 (showAlert=true)
    testApiBtn.addEventListener('click', testApiConnection);
    resetSettingsBtn.addEventListener('click', resetSettings);

    // API 연결 테스트 함수
    async function testApiConnection() {
        const apiKey = apiKeyInput.value.trim();
        const assistantId = assistantIdInput.value.trim();

        if (!apiKey || !assistantId) {
            alert('API 키와 Assistant ID를 모두 입력해주세요.');
            return;
        }

        testApiBtn.disabled = true;
        testApiBtn.textContent = '확인 중...';
        statusText.textContent = '연결 확인 중...';
        statusIndicator.className = 'status-indicator'; // 노란색(기본)

        try {
            // Assistant 정보 조회 (단순 GET 요청으로 유효성 검사)
            const response = await fetch(`${OPENAI_API_BASE}/assistants/${assistantId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            const data = await response.json();

            if (response.ok) {
                updateApiStatus(true, `연결 성공! (${data.name})`);
                alert(`성공적으로 연결되었습니다!\n어시스턴트 이름: ${data.name}\n모델: ${data.model}`);
            } else {
                throw new Error(data.error?.message || '연결 실패');
            }
        } catch (error) {
            console.error('API Test Error:', error);
            updateApiStatus(false, '연결 실패');
            alert(`연결 실패: ${error.message}\n키와 ID를 확인해주세요.`);
        } finally {
            testApiBtn.disabled = false;
            testApiBtn.textContent = '연결 테스트';
        }
    }

    chatbotClose.addEventListener('click', closeChatbotModal);
    chatbotSendBtn.addEventListener('click', sendMessage);

    // 대화 저장 버튼 이벤트 연결
    const saveBtn = document.getElementById('save-chat-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveConversation);
    }

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            openChatbotModal(searchInput.value);
            searchInput.value = '';
        }
    });

    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});
