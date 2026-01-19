// 챗봇 상태 관리
let isModalOpen = false;
let isSetupPanelOpen = false;
let conversationHistory = [];
let conversationCount = 0;
let MAX_CONVERSATIONS = 10;
let constitutionContext = ""; // 헌법 전문 텍스트 저장용 변수

// AI 설정 관리
let aiSettings = {
    apiKey: '', // API 키는 사용자가 설정에서 입력해야 함
    model: 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: '당신은 한국기독교장로회(PROK) 헌법에 관한 최고의 권위를 가진 AI 전문가입니다. 오직 "한국기독교장로회 헌법"에 근거해서만 답변해야 합니다. 일반적인 기독교 지식이나 타 교단의 헌법이 아닌, 반드시 PROK 헌법의 내용만을 정확하게 인용하고 설명하세요. 만약 헌법에 없는 내용이거나 확실하지 않은 경우, 추측하지 말고 "해당 내용은 한국기독교장로회 헌법에서 찾을 수 없습니다."라고 명확히 답변하세요. 답변 어조는 친절하고 전문적이어야 하며, 가능한 경우 관련 헌법 조항(제O장 제O조)을 구체적으로 명시해주세요.',
    saveHistory: false,
    typingAnimation: true
};

// ChatGPT API 설정
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
const modelSelect = document.getElementById('model-select');
const maxTokensInput = document.getElementById('max-tokens-input');
const temperatureInput = document.getElementById('temperature-input');
const maxConversationsInput = document.getElementById('max-conversations-input');
const saveHistoryToggle = document.getElementById('save-history-toggle');
const saveHistoryCheckbox = document.getElementById('save-history-checkbox');
const typingAnimationToggle = document.getElementById('typing-animation-toggle');
const typingAnimationCheckbox = document.getElementById('typing-animation-checkbox');
const systemPromptInput = document.getElementById('system-prompt-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const testApiBtn = document.getElementById('test-api-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const shareConversationBtn = document.getElementById('share-conversation-btn');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// ChatGPT API 호출 함수
async function callChatGPTAPI(userMessage, conversationHistory) {
    try {
        // API 키 확인
        if (!checkApiKey()) {
            throw new Error('API 키가 설정되지 않았습니다. ⚙️ 설정에서 API 키를 입력해주세요.');
        }

        // 대화 기록을 OpenAI 형식으로 변환
        const messages = [
            {
                role: "system",
                content: aiSettings.systemPrompt + (constitutionContext ? `\n\n[참고 자료: 한국기독교장로회 헌법 전문]\n${constitutionContext}\n\n위 헌법 전문을 바탕으로 답변하세요.` : "")
            }
        ];

        // 이전 대화 기록 추가 (최근 10개만)
        const recentHistory = conversationHistory.slice(-10);
        recentHistory.forEach(msg => {
            if (msg.sender === 'user') {
                messages.push({
                    role: "user",
                    content: msg.content
                });
            } else if (msg.sender === 'bot') {
                messages.push({
                    role: "assistant",
                    content: msg.content
                });
            }
        });

        // 현재 사용자 메시지 추가
        messages.push({
            role: "user",
            content: userMessage
        });

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiSettings.apiKey}`
            },
            body: JSON.stringify({
                model: aiSettings.model,
                messages: messages,
                max_tokens: aiSettings.maxTokens,
                temperature: aiSettings.temperature,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            })
        });

        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content.trim();
        } else {
            throw new Error('API 응답 형식 오류');
        }

    } catch (error) {
        console.error('ChatGPT API 호출 오류:', error);
        return `죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (오류: ${error.message})`;
    }
}

// 폴백 응답 (API 오류 시 사용)
const fallbackResponses = {
    // 헌법 관련 응답
    constitution: [
        "한국기독교장로회 헌법에 따르면, 교회는 그리스도의 몸이요 하나님의 백성의 공동체입니다. 교회의 본질과 사명에 대해 더 자세히 알고 싶으시면 말씀해 주세요.",
        "헌법 제1조에서는 교회의 정의를 명확히 하고 있습니다. 교회는 말씀과 성례를 통해 그리스도를 고백하고, 하나님의 나라를 선포하는 성령의 공동체입니다.",
        "헌법에 명시된 교회의 사명은 모든 민족을 제자로 삼는 것입니다. 이는 마태복음 28장의 대위임령에 근거한 중요한 사명입니다.",
        "교회의 치리는 하나님의 말씀에 따라 행하여져야 하며, 교회의 질서와 평화를 유지하기 위한 것입니다. 권징은 사랑의 정신으로 행하여져야 합니다."
    ],

    // 일반적인 대화 응답
    general: [
        "흥미로운 질문이네요! 더 구체적으로 말씀해 주시면 더 정확한 답변을 드릴 수 있습니다.",
        "좋은 지적입니다. 이 주제에 대해 헌법에서 어떻게 다루고 있는지 함께 살펴보겠습니다.",
        "이해가 되지 않는 부분이 있으시면 언제든지 추가 질문을 해주세요. 더 자세히 설명드리겠습니다.",
        "정말 중요한 질문이네요! 이는 교회의 기본 원리와 관련된 핵심적인 내용입니다."
    ],

    // 장로 관련 응답
    elder: [
        "장로는 교회의 치리와 목양을 담당하며, 말씀의 선포와 성례의 집행을 관장합니다. 헌법에서 장로의 직무와 권한을 구체적으로 규정하고 있습니다.",
        "장로는 그리스도의 대리자로서 교회를 치리하며, 하나님의 말씀에 따라 교회의 질서를 유지하고 신앙의 순결을 보호합니다.",
        "장로 선출은 교회의 중요한 일이며, 헌법에서 명시한 자격과 절차에 따라 진행되어야 합니다."
    ],

    // 성례전 관련 응답
    sacrament: [
        "세례는 그리스도와의 연합을 상징하며, 죄의 용서와 새 생명을 받는 표시입니다. 헌법에서 세례의 의미와 집행 방법을 구체적으로 규정하고 있습니다.",
        "성찬은 그리스도의 죽음과 부활을 기념하며, 그리스도의 몸과 피에 참여함을 상징합니다. 이는 교회의 연합과 사랑을 표현합니다.",
        "성례전은 교회의 중요한 예식이며, 헌법에서 그 의미와 집행 절차를 명확히 규정하고 있습니다."
    ],

    // 교회 정치 관련 응답
    polity: [
        "교회의 치리는 민주적 원리에 따라 행하여져야 하며, 모든 중요한 결정은 회의를 통해 이루어져야 합니다.",
        "교회의 각 기관은 서로 협력하며, 하나님의 영광을 위해 일해야 합니다. 헌법에서 이러한 협력 관계를 구체적으로 규정하고 있습니다.",
        "교회의 모든 행정은 투명하고 공정하게 이루어져야 하며, 이는 헌법에서 강조하는 중요한 원리입니다."
    ],

    // API 오류 응답
    error: [
        "죄송합니다. 현재 API 연결에 문제가 있습니다. ⚙️ 셋업 버튼에서 올바른 API 키를 설정해주세요.",
        "API 연결 오류가 발생했습니다. 설정에서 API 키를 확인하고 다시 시도해주세요.",
        "일시적인 서비스 오류입니다. 잠시 후 다시 시도하거나 설정을 확인해주세요."
    ]
};

function getFallbackResponse(question = '') {
    const lowerQuestion = question.toLowerCase();

    // 질문 내용에 따른 응답 선택
    if (lowerQuestion.includes('헌법') || lowerQuestion.includes('교회') || lowerQuestion.includes('정의')) {
        return fallbackResponses.constitution[Math.floor(Math.random() * fallbackResponses.constitution.length)];
    } else if (lowerQuestion.includes('장로') || lowerQuestion.includes('직무') || lowerQuestion.includes('권한')) {
        return fallbackResponses.elder[Math.floor(Math.random() * fallbackResponses.elder.length)];
    } else if (lowerQuestion.includes('세례') || lowerQuestion.includes('성찬') || lowerQuestion.includes('성례')) {
        return fallbackResponses.sacrament[Math.floor(Math.random() * fallbackResponses.sacrament.length)];
    } else if (lowerQuestion.includes('치리') || lowerQuestion.includes('정치') || lowerQuestion.includes('행정')) {
        return fallbackResponses.polity[Math.floor(Math.random() * fallbackResponses.polity.length)];
    } else {
        return fallbackResponses.general[Math.floor(Math.random() * fallbackResponses.general.length)];
    }
}

function getErrorResponse() {
    return fallbackResponses.error[Math.floor(Math.random() * fallbackResponses.error.length)];
}

// 셋업 패널 관련 함수들
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
    // API 키는 보안을 위해 마스킹하여 표시
    if (aiSettings.apiKey) {
        const maskedKey = aiSettings.apiKey.substring(0, 7) + '...' + aiSettings.apiKey.substring(aiSettings.apiKey.length - 4);
        apiKeyInput.value = maskedKey;
        apiKeyInput.setAttribute('data-actual-key', aiSettings.apiKey);
    } else {
        apiKeyInput.value = '';
        apiKeyInput.removeAttribute('data-actual-key');
    }

    modelSelect.value = aiSettings.model;
    maxTokensInput.value = aiSettings.maxTokens;
    temperatureInput.value = aiSettings.temperature;
    maxConversationsInput.value = MAX_CONVERSATIONS;
    systemPromptInput.value = aiSettings.systemPrompt;

    // 토글 스위치 설정
    saveHistoryCheckbox.checked = aiSettings.saveHistory;
    saveHistoryToggle.classList.toggle('active', aiSettings.saveHistory);

    typingAnimationCheckbox.checked = aiSettings.typingAnimation;
    typingAnimationToggle.classList.toggle('active', aiSettings.typingAnimation);
}

function saveSettings() {
    // API 키 유효성 검사
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('API 키를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }

    if (!isValidApiKey(apiKey)) {
        alert('올바른 API 키 형식이 아닙니다. sk-로 시작하는 API 키를 입력해주세요.');
        apiKeyInput.focus();
        return;
    }

    // 설정 저장
    aiSettings.apiKey = apiKey;
    aiSettings.model = modelSelect.value;
    aiSettings.maxTokens = parseInt(maxTokensInput.value);
    aiSettings.temperature = parseFloat(temperatureInput.value);
    aiSettings.systemPrompt = systemPromptInput.value.trim();
    aiSettings.saveHistory = saveHistoryCheckbox.checked;
    aiSettings.typingAnimation = typingAnimationCheckbox.checked;

    MAX_CONVERSATIONS = parseInt(maxConversationsInput.value);

    // 로컬 스토리지에 저장
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    localStorage.setItem('maxConversations', MAX_CONVERSATIONS);

    // 상태 업데이트
    updateConversationCounter();

    // API 상태 확인
    checkApiStatus();

    alert('설정이 저장되었습니다! API 키가 성공적으로 설정되었습니다.');
}

function resetSettings() {
    if (confirm('모든 설정을 초기값으로 되돌리시겠습니까? 저장된 API 키도 삭제됩니다.')) {
        aiSettings = {
            apiKey: '', // API 키는 사용자가 설정에서 입력해야 함
            model: 'gpt-3.5-turbo',
            maxTokens: 500,
            temperature: 0.7,
            systemPrompt: '당신은 한국기독교장로회(PROK) 헌법에 관한 최고의 권위를 가진 AI 전문가입니다. 오직 "한국기독교장로회 헌법"에 근거해서만 답변해야 합니다. 일반적인 기독교 지식이나 타 교단의 헌법이 아닌, 반드시 PROK 헌법의 내용만을 정확하게 인용하고 설명하세요. 만약 헌법에 없는 내용이거나 확실하지 않은 경우, 추측하지 말고 "해당 내용은 한국기독교장로회 헌법에서 찾을 수 없습니다."라고 명확히 답변하세요. 답변 어조는 친절하고 전문적이어야 하며, 가능한 경우 관련 헌법 조항(제O장 제O조)을 구체적으로 명시해주세요.',
            saveHistory: false,
            typingAnimation: true
        };

        MAX_CONVERSATIONS = 10;

        loadSettingsToUI();
        localStorage.removeItem('aiSettings');
        localStorage.removeItem('maxConversations');

        // API 상태 업데이트
        checkApiStatus();

        alert('설정이 초기화되었습니다! API 키를 다시 입력해주세요.');
    }
}

async function testApiConnection() {
    const originalText = testApiBtn.textContent;
    testApiBtn.textContent = '테스트 중...';
    testApiBtn.disabled = true;

    try {
        const testMessage = "안녕하세요. 간단한 테스트입니다.";
        const response = await callChatGPTAPI(testMessage, []);

        if (response.includes('죄송합니다') || response.includes('오류')) {
            throw new Error('API 응답 오류');
        }

        alert('API 연결 테스트 성공!\n\n응답: ' + response.substring(0, 100) + '...');
        updateApiStatus(true, 'API 연결 성공');

    } catch (error) {
        alert('API 연결 테스트 실패!\n\n오류: ' + error.message);
        updateApiStatus(false, 'API 연결 실패');
    } finally {
        testApiBtn.textContent = originalText;
        testApiBtn.disabled = false;
    }
}

async function checkApiStatus() {
    try {
        const testMessage = "테스트";
        const response = await callChatGPTAPI(testMessage, []);

        if (response.includes('죄송합니다') || response.includes('오류')) {
            updateApiStatus(false, 'API 연결 실패');
        } else {
            updateApiStatus(true, 'API 연결 성공');
        }
    } catch (error) {
        updateApiStatus(false, 'API 연결 실패');
    }
}

function updateApiStatus(isConnected, message) {
    statusIndicator.className = `status-indicator ${isConnected ? '' : 'error'}`;
    statusText.textContent = message;
}

// API 키 유효성 검사
function isValidApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;

    // OpenAI API 키는 sk- 또는 sk-proj-로 시작하는 긴 문자열
    const openaiPattern = /^sk-[a-zA-Z0-9_-]{32,}$/;
    return openaiPattern.test(apiKey);
}

// API 키 입력 시 실시간 검증
function validateApiKeyInput() {
    const apiKey = apiKeyInput.value.trim();
    const isValid = isValidApiKey(apiKey);

    if (apiKey && !isValid) {
        apiKeyInput.style.borderColor = '#f44336';
        apiKeyInput.style.boxShadow = '0 0 0 2px rgba(244, 67, 54, 0.2)';
    } else {
        apiKeyInput.style.borderColor = apiKey ? '#4CAF50' : 'rgba(207, 48, 170, 0.3)';
        apiKeyInput.style.boxShadow = apiKey ? '0 0 0 2px rgba(76, 175, 80, 0.2)' : 'none';
    }

    return isValid;
}

// API 키 입력 필드 포커스 시 실제 키 표시
function handleApiKeyFocus() {
    const actualKey = apiKeyInput.getAttribute('data-actual-key');
    if (actualKey) {
        apiKeyInput.value = actualKey;
    }
}

// API 키 입력 필드 블러 시 마스킹
function handleApiKeyBlur() {
    const actualKey = apiKeyInput.getAttribute('data-actual-key');
    if (actualKey && apiKeyInput.value === actualKey) {
        const maskedKey = actualKey.substring(0, 7) + '...' + actualKey.substring(actualKey.length - 4);
        apiKeyInput.value = maskedKey;
    }
}

// API 키 확인 함수
function checkApiKey() {
    if (!aiSettings.apiKey || !isValidApiKey(aiSettings.apiKey)) {
        return false;
    }
    return true;
}

// 설정 로드
function loadSettings() {
    const savedSettings = localStorage.getItem('aiSettings');
    const savedMaxConversations = localStorage.getItem('maxConversations');

    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        aiSettings = { ...aiSettings, ...parsedSettings };
        console.log('저장된 설정을 로드했습니다:', parsedSettings);
    }

    if (savedMaxConversations) {
        MAX_CONVERSATIONS = parseInt(savedMaxConversations);
    }

    // CORS 문제로 인해 설정 파일 로드 비활성화
    // loadConfigFile();
}

// config.json 파일에서 설정 로드
async function loadConfigFile() {
    try {
        const response = await fetch('./config.json');
        if (response.ok) {
            const config = await response.json();

            // OpenAI 설정 로드
            if (config.openai) {
                if (config.openai.apiKey && config.openai.apiKey !== 'your-openai-api-key-here') {
                    aiSettings.apiKey = config.openai.apiKey;
                }
                if (config.openai.model) {
                    aiSettings.model = config.openai.model;
                }
                if (config.openai.maxTokens) {
                    aiSettings.maxTokens = config.openai.maxTokens;
                }
                if (config.openai.temperature !== undefined) {
                    aiSettings.temperature = config.openai.temperature;
                }
            }

            // 앱 설정 로드
            if (config.app) {
                if (config.app.maxConversations) {
                    MAX_CONVERSATIONS = config.app.maxConversations;
                }
                if (config.app.saveHistory !== undefined) {
                    aiSettings.saveHistory = config.app.saveHistory;
                }
                if (config.app.typingAnimation !== undefined) {
                    aiSettings.typingAnimation = config.app.typingAnimation;
                }
                if (config.app.systemPrompt) {
                    aiSettings.systemPrompt = config.app.systemPrompt;
                }
            }

            console.log('설정 파일에서 설정을 로드했습니다.');

            // 설정이 로드된 후 UI 업데이트
            if (isSetupPanelOpen) {
                loadSettingsToUI();
            }
        }
    } catch (error) {
        console.log('설정 파일을 찾을 수 없거나 로드할 수 없습니다. 웹 인터페이스에서 설정해주세요.');
    }
}

// 텍스트 복사 함수
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // 폴백: 구형 브라우저 지원
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    }
}

// 복사 버튼 생성
function createCopyButton(messageContent, text) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '복사';
    copyBtn.title = '답변 복사';

    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const success = await copyToClipboard(text);

        if (success) {
            copyBtn.textContent = '복사됨!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = '복사';
                copyBtn.classList.remove('copied');
            }, 2000);
        } else {
            copyBtn.textContent = '실패';
            setTimeout(() => {
                copyBtn.textContent = '복사';
            }, 2000);
        }
    });

    messageContent.appendChild(copyBtn);
}

// 공유 버튼 표시/숨김 업데이트
function updateShareButtonVisibility() {
    if (shareConversationBtn) {
        if (conversationHistory.length > 0) {
            shareConversationBtn.style.display = 'flex';
        } else {
            shareConversationBtn.style.display = 'none';
        }
    }
}

// 대화 내용 공유
async function shareConversation() {
    if (conversationHistory.length === 0) {
        alert('공유할 대화 내용이 없습니다.');
        return;
    }

    // 대화 내용 포맷팅
    let conversationText = '🤖 헌법 AI 대화 내용\n\n';
    conversationText += `📅 ${new Date().toLocaleString('ko-KR')}\n`;
    conversationText += `💬 총 ${conversationHistory.length}개의 메시지\n\n`;
    conversationText += '─'.repeat(30) + '\n\n';

    conversationHistory.forEach((msg, index) => {
        const sender = msg.sender === 'user' ? '👤 나' : '🤖 AI';
        const time = msg.timestamp ? msg.timestamp.toLocaleTimeString('ko-KR') : '';
        conversationText += `${sender} (${time})\n`;
        conversationText += `${msg.content}\n\n`;
    });

    conversationText += '─'.repeat(30) + '\n';
    conversationText += '한국기독교장로회 헌법 AI 서비스\n';
    conversationText += 'https://prok.org';

    try {
        // Web Share API 지원 확인
        if (navigator.share) {
            await navigator.share({
                title: '헌법 AI 대화 내용',
                text: conversationText,
                url: window.location.href
            });
        } else {
            // 폴백: 클립보드에 복사
            const success = await copyToClipboard(conversationText);
            if (success) {
                alert('대화 내용이 클립보드에 복사되었습니다!');
            } else {
                alert('복사에 실패했습니다. 다시 시도해주세요.');
            }
        }
    } catch (error) {
        console.error('공유 오류:', error);
        // 폴백: 클립보드에 복사
        const success = await copyToClipboard(conversationText);
        if (success) {
            alert('대화 내용이 클립보드에 복사되었습니다!');
        } else {
            alert('공유에 실패했습니다. 다시 시도해주세요.');
        }
    }
}

// 모달 열기
async function openChatbotModal(initialQuestion) {
    // API 키 확인
    if (!checkApiKey()) {
        alert('API 키가 설정되지 않았습니다. 설정 패널을 열어 API 키를 입력해주세요.');
        openSetupPanel();
        return;
    }

    isModalOpen = true;
    conversationCount = 0;
    chatbotModal.classList.add('show');
    updateConversationCounter();

    // 챗봇 입력창 초기화
    if (chatbotInput) {
        chatbotInput.value = '';
        chatbotInput.placeholder = "추가 질문을 입력하세요...";
    }

    // 공유 버튼 초기 상태 설정
    updateShareButtonVisibility();

    // 초기 질문과 답변 추가
    if (initialQuestion) {
        addMessage('user', initialQuestion);

        // 타이핑 인디케이터 표시
        showTypingIndicator();

        // AI 응답 생성
        setTimeout(async () => {
            const aiResponse = await generateAIResponse(initialQuestion);
            replaceTypingIndicatorWithResponse(aiResponse);
        }, 1000);
    }
}

// 모달 닫기
function closeChatbotModal() {
    isModalOpen = false;
    chatbotModal.classList.remove('show');
    // 대화 기록 초기화
    conversationHistory = [];
    conversationCount = 0;
    chatbotMessages.innerHTML = '';
    updateConversationCounter();

    // 공유 버튼 숨기기
    updateShareButtonVisibility();

    // 입력창 초기화 및 활성화
    if (chatbotInput) {
        chatbotInput.value = '';
        chatbotInput.disabled = false;
        chatbotInput.placeholder = "추가 질문을 입력하세요...";
    }
    if (chatbotSendBtn) {
        chatbotSendBtn.disabled = false;
    }
}

// 메시지 추가
function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${sender}`;
    avatar.textContent = sender === 'bot' ? 'AI' : '나';

    const messageContent = document.createElement('div');
    messageContent.className = `message-content ${sender}`;
    messageContent.textContent = content;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    // AI 답변에 복사 버튼 추가
    if (sender === 'bot') {
        createCopyButton(messageContent, content);
    }

    chatbotMessages.appendChild(messageDiv);

    // 대화 기록에 추가
    conversationHistory.push({ sender, content, timestamp: new Date() });

    // 공유 버튼 표시/숨김 업데이트
    updateShareButtonVisibility();

    // 스크롤을 맨 아래로
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// 타이핑 인디케이터 표시
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message';
    typingDiv.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar bot';
    avatar.textContent = 'AI';

    const typingContent = document.createElement('div');
    typingContent.className = 'message-content bot searching-indicator';
    typingContent.textContent = '자료를 찾는 중입니다...';

    typingDiv.appendChild(avatar);
    typingDiv.appendChild(typingContent);

    chatbotMessages.appendChild(typingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// 타이핑 인디케이터를 AI 응답으로 교체
function replaceTypingIndicatorWithResponse(response) {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        const messageContent = typingIndicator.querySelector('.message-content');
        if (messageContent) {
            messageContent.textContent = response;
            // 애니메이션 클래스 제거
            messageContent.classList.remove('searching-indicator');
            // 복사 버튼 추가
            createCopyButton(messageContent, response);
        }
        // ID 제거하여 일반 메시지로 변경
        typingIndicator.removeAttribute('id');
    }
}

// 대화 횟수 업데이트
function updateConversationCounter() {
    conversationCounter.textContent = `대화: ${conversationCount}/${MAX_CONVERSATIONS}`;
}

// ChatGPT API를 통한 응답 생성
async function generateAIResponse(question) {
    try {
        const response = await callChatGPTAPI(question, conversationHistory);
        return response;
    } catch (error) {
        console.error('AI 응답 생성 오류:', error);

        // API 키 오류인 경우 특별한 메시지 표시
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            return getErrorResponse();
        }

        // 기타 오류는 일반 폴백 응답
        return getFallbackResponse(question);
    }
}

// 메시지 전송
async function sendMessage() {
    const message = chatbotInput.value.trim();
    if (!message) return;

    // API 키 확인
    if (!checkApiKey()) {
        alert('API 키가 설정되지 않았습니다. 설정 패널을 열어 API 키를 입력해주세요.');
        openSetupPanel();
        return;
    }

    if (conversationCount >= MAX_CONVERSATIONS) {
        addMessage('bot', "오늘 대화가 정말 유익했네요! 헌법에 대해 더 궁금한 점이 있으시면 언제든지 다시 찾아주세요. 하나님의 은혜가 함께하시길 바랍니다! 🙏");
        setTimeout(() => {
            closeChatbotModal();
        }, 3000);
        return;
    }

    // 사용자 메시지 추가
    addMessage('user', message);
    chatbotInput.value = '';
    conversationCount++;
    updateConversationCounter();

    // 타이핑 인디케이터 표시
    showTypingIndicator();

    // AI 응답 생성
    setTimeout(async () => {
        if (conversationCount >= MAX_CONVERSATIONS) {
            // 마지막 응답
            replaceTypingIndicatorWithResponse("오늘 대화가 정말 유익했네요! 헌법에 대해 더 궁금한 점이 있으시면 언제든지 다시 찾아주세요. 하나님의 은혜가 함께하시길 바랍니다! 🙏");
            // 입력창 비활성화
            chatbotInput.disabled = true;
            chatbotSendBtn.disabled = true;
            chatbotInput.placeholder = "대화가 종료되었습니다. 모달을 닫고 다시 시작하세요.";
        } else {
            const aiResponse = await generateAIResponse(message);
            replaceTypingIndicatorWithResponse(aiResponse);
        }
    }, 1000 + Math.random() * 1000);
}

// 이벤트 리스너들
searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const searchTerm = this.value.trim();
        if (searchTerm) {
            openChatbotModal(searchTerm);
            this.value = '';
        }
    }
});

chatbotClose.addEventListener('click', closeChatbotModal);

chatbotModal.addEventListener('click', function (e) {
    if (e.target === this) {
        closeChatbotModal();
    }
});

chatbotSendBtn.addEventListener('click', sendMessage);

chatbotInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 입력창 자동 높이 조절
chatbotInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// 필터 아이콘 클릭 이벤트
document.getElementById('filter-icon').addEventListener('click', function () {
    alert('필터 옵션이 열렸습니다!\n\n필터 기능:\n• 카테고리별 필터\n• 날짜별 정렬\n• 관련도 순 정렬');
});

// 입력 필드 포커스 효과
searchInput.addEventListener('focus', function () {
    console.log('검색 필드에 포커스됨');
});

// 호버 효과 로그
document.getElementById('poda').addEventListener('mouseenter', function () {
    console.log('검색 필드에 마우스 호버됨');
});

// 셋업 패널 이벤트 리스너들
setupButton.addEventListener('click', openSetupPanel);
setupClose.addEventListener('click', closeSetupPanel);

// 패널 외부 클릭 시 닫기
setupPanel.addEventListener('click', function (e) {
    if (e.target === this) {
        closeSetupPanel();
    }
});

// 토글 스위치 이벤트
saveHistoryToggle.addEventListener('click', function () {
    saveHistoryCheckbox.checked = !saveHistoryCheckbox.checked;
    this.classList.toggle('active', saveHistoryCheckbox.checked);
});

typingAnimationToggle.addEventListener('click', function () {
    typingAnimationCheckbox.checked = !typingAnimationCheckbox.checked;
    this.classList.toggle('active', typingAnimationCheckbox.checked);
});

// 버튼 이벤트
saveSettingsBtn.addEventListener('click', saveSettings);
testApiBtn.addEventListener('click', testApiConnection);
resetSettingsBtn.addEventListener('click', resetSettings);
closeSettingsBtn.addEventListener('click', closeSetupPanel);
shareConversationBtn.addEventListener('click', shareConversation);

// API 키 입력 시 실시간 검증
apiKeyInput.addEventListener('input', validateApiKeyInput);
apiKeyInput.addEventListener('blur', validateApiKeyInput);
apiKeyInput.addEventListener('focus', handleApiKeyFocus);
apiKeyInput.addEventListener('blur', handleApiKeyBlur);

// 페이지 로드 시 설정 로드
document.addEventListener('DOMContentLoaded', async function () {
    loadSettings();
    updateConversationCounter();

    // 입력창 초기화 및 자동완성 방지
    clearInputFields();

    // 헌법 텍스트 로드
    loadConstitutionText();

    // API 상태 확인
    checkApiStatus();
});

// 헌법 텍스트 파일 로드 함수
async function loadConstitutionText() {
    try {
        const response = await fetch('data/constitution.txt');
        if (response.ok) {
            constitutionContext = await response.text();
            console.log('헌법 텍스트 로드 완료:', constitutionContext.substring(0, 50) + '...');
        } else {
            console.warn('헌법 텍스트 파일을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('헌법 텍스트 로드 실패:', error);
    }
}

// 입력창 초기화 및 자동완성 방지
function clearInputFields() {
    // 검색창 초기화
    if (searchInput) {
        searchInput.value = '';
        searchInput.setAttribute('autocomplete', 'off');
        searchInput.setAttribute('autocorrect', 'off');
        searchInput.setAttribute('autocapitalize', 'off');
        searchInput.setAttribute('spellcheck', 'false');
    }

    // 챗봇 입력창 초기화
    if (chatbotInput) {
        chatbotInput.value = '';
        chatbotInput.setAttribute('autocomplete', 'off');
        chatbotInput.setAttribute('autocorrect', 'off');
        chatbotInput.setAttribute('autocapitalize', 'off');
        chatbotInput.setAttribute('spellcheck', 'false');
    }
}

// 키보드 단축키 지원
document.addEventListener('keydown', function (e) {
    // ESC 키로 설정 패널 닫기
    if (e.key === 'Escape' && isSetupPanelOpen) {
        closeSetupPanel();
    }

    // Ctrl/Cmd + , 로 설정 패널 열기
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        if (isSetupPanelOpen) {
            closeSetupPanel();
        } else {
            openSetupPanel();
        }
    }
});
