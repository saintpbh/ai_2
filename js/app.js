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
                // 실행 시마다 명시적인 지침 추가 (출처 표기 강제)
                additional_instructions: "답변의 맨 마지막에는 반드시 근거가 된 문서의 이름과 페이지를 다음 형식으로 명시해주세요:\n\n[출처: OO총회 회의록, p.123] 또는 [출처: 한국기독교장로회 헌법 제O조]"
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

function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const assistantId = assistantIdInput.value.trim();

    if (!apiKey) {
        alert('API 키를 입력해주세요.');
        return;
    }
    if (!assistantId) {
        alert('Assistant ID를 입력해주세요.');
        return;
    }

    aiSettings.apiKey = apiKey;
    aiSettings.assistantId = assistantId;
    MAX_CONVERSATIONS = parseInt(maxConversationsInput.value);

    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    localStorage.setItem('maxConversations', MAX_CONVERSATIONS);

    updateConversationCounter();
    checkApiStatus();

    alert('설정이 저장되었습니다!');
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

// UI 헬퍼 함수들
function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}`;
    messageDiv.innerHTML = `<div class="message-content">${content.replace(/\n/g, '<br>')}</div>`; // 간단한 마크다운 처리 필요시 추가
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
        indicator.innerHTML = `<div class="message-content">${response.replace(/\n/g, '<br>')}</div>`;
        indicator.id = ''; // ID 제거

        // **[104회 총회 회의록.pdf]** 같은 출처 제거 (선택 사항)
        // const cleanResponse = response.replace(/【.*?】/g, ''); 
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
    setupClose.addEventListener('click', closeSetupPanel);
    saveSettingsBtn.addEventListener('click', saveSettings);
    // testApiBtn.addEventListener('click', testApiConnection); // 테스트 버튼은 일단 보류
    resetSettingsBtn.addEventListener('click', resetSettings);

    chatbotClose.addEventListener('click', closeChatbotModal);
    chatbotSendBtn.addEventListener('click', sendMessage);

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
