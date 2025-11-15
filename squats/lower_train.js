/**
 * lower_train.js
 * 深蹲訓練邏輯處理 (Lower Level)
 * 引用模型數據：stand, squat, error
 */

window.SquatTrainer = {
    // Status
    isTraining: false,
    currentState: 'IDLE',
    correctCount: 0,
    errorCount: 0,
    isSessionSaved: false,

    lastAdvancesLevel: '',
    lastSittingLevel: '',

    // --- Lower Level Specifics (State & Timers removed for simplicity) ---
    // Lower Level Pose Names
    LOWER_POSE_STAND: 'stand',
    LOWER_POSE_SQUAT: 'squat',
    LOWER_POSE_ERROR: 'error',

    // UI Elements
    coachMessage: null,
    coachHeader: null,
    coachTitle: null,
    coachBody: null,
    coachCloseButton: null,
    coachButtonContainer: null,
    trainButton: null,
    statusMessage: null,
    correctCountDisplay: null,
    errorCountDisplay: null,

    /**
     * 初始化訓練器 (UI 綁定)
     */
    init: function () {
        this.trainButton = document.getElementById('trainButton');
        this.statusMessage = document.getElementById('status-message');
        this.correctCountDisplay = document.getElementById('correct-count');
        this.errorCountDisplay = document.getElementById('error-count');
        this.coachMessage = document.getElementById('coach-message');
        this.coachHeader = this.coachMessage ? this.coachMessage.querySelector('.message-header') : null;
        this.coachTitle = document.getElementById('message-title');
        this.coachBody = document.getElementById('message-body-text');
        this.coachCloseButton = document.getElementById('close-coach-message');
        this.coachNextButton = document.getElementById('next-step-button');
        this.coachButtonContainer = this.coachNextButton ? this.coachNextButton.parentElement : null;

        if (!this.trainButton || !this.correctCountDisplay || !this.errorCountDisplay || !this.coachMessage || !this.coachHeader || !this.coachTitle || !this.coachBody || !this.coachCloseButton || !this.coachButtonContainer) {
            console.error("訓練器初始化失敗：找不到必要的 UI 元素。"); return;
        }

        this.getOtherTrainLevels();
        this.trainButton.addEventListener('click', () => this.toggleTraining());
        this.coachNextButton.style.display = 'none';
        this.coachButtonContainer.innerHTML = '';
        this.coachCloseButton.addEventListener('click', () => this.hideCoachMessage());
        this.updateUI();
    },

    getOtherTrainLevels: async function () {
        try {
            const urlWithCacheBuster = '../person.csv?t=' + Date.now(); // 假設 person.csv 在上層目錄
            const response = await fetch(urlWithCacheBuster, { cache: 'no-store' });

            if (!response.ok) {
                // 如果讀取失敗，保持等級為空字串
                console.warn("無法讀取 person.csv，其他訓練等級將設為預設空值。");
                return;
            }
            const csvText = await response.text();

            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return; // 只有標頭

            const headers = lines[0].split(',').map(h => h.trim());
            const lastDataLine = lines[lines.length - 1];
            const values = lastDataLine.split(',');

            const advanceIndex = headers.findIndex(h => h.toLowerCase() === 'last_advances_train_level');
            const sittingIndex = headers.findIndex(h => h.toLowerCase() === 'last_sitting_train_level');

            if (advanceIndex !== -1 && values[advanceIndex]) {
                this.lastAdvancesLevel = values[advanceIndex].trim();
            }
            if (sittingIndex !== -1 && values[sittingIndex]) {
                this.lastSittingLevel = values[sittingIndex].trim();
            }

            console.log(`[LOG] 讀取上次建議：壺鈴(${this.lastAdvancesLevel})，坐姿(${this.lastSittingLevel})`);

        } catch (error) {
            console.error('讀取上次訓練等級失敗:', error);
        }
    },

    /* 訓練控制*/
    /**
     * 開始或停止訓練
     */
    toggleTraining: function () {
        if (!this.isTraining && !window.currentStream) {
            this.showCoachMessage('錯誤', '請先啟動姿勢偵測才能開始訓練！', 'error');
            return;
        }

        if (this.isTraining) {
            // --- 停止訓練 ---
            this.isTraining = false;
            this.trainButton.textContent = '開始訓練';
            this.trainButton.style.backgroundColor = '#2ecc71';
            this.resetState('IDLE');
            this.hideCoachMessage();

            if (this.correctCount > 0 || this.errorCount > 0) {
                // "停止" 代表 "維持" 目前等級
                this.saveTrainingData('stopped', window.currentTrainLevel);
            }
            this.isSessionSaved = true;

        } else {
            // --- 開始訓練 ---
            this.isTraining = true;
            this.isSessionSaved = false;
            this.trainButton.textContent = '停止訓練';
            this.trainButton.style.backgroundColor = '#e74c3c';
            this.correctCount = 0;
            this.errorCount = 0;
            this.resetState('IDLE');
            this.updateUI();
            this.showCoachMessage('訓練開始', '請準備「站」姿。', 'info');
        }
    },

    /**
     * 核心函式：由 HTML 中的 predict() 呼叫 - **Lower Level 邏輯**
     */
    processPose: function (poseName) {
        if (!this.isTraining || poseName === "N/A") return;

        // 1. 檢查是否觸發即時錯誤姿勢 (New Rule)
        if (poseName === this.LOWER_POSE_ERROR) {
            this.logError('偵測到錯誤姿勢 (Error Pose)！請重新調整。');
            return;
        }

        switch (this.currentState) {
            case 'IDLE':
                // 等待站姿，準備開始下蹲
                if (poseName === this.LOWER_POSE_STAND) {
                    this.currentState = 'STANDING';
                    this.showCoachMessage('動作開始', '偵測到「站」，請緩慢下蹲。', 'info');
                }
                break;

            case 'STANDING':
                // 從站立進入下蹲底點
                if (poseName === this.LOWER_POSE_SQUAT) {
                    this.currentState = 'SQUATTING';
                    this.showCoachMessage('到達定點', '偵測到「蹲」，請緩慢站起。', 'info');
                }
                // 如果是 stand，則維持 STANDING 狀態等待 squat
                break;

            case 'SQUATTING':
                // 從下蹲底點進入站立 (Success Condition: stand > squat)
                if (poseName === this.LOWER_POSE_STAND) {
                    this.logSuccess(); // 動作完成
                }
                // 如果是 squat，則維持 SQUATTING 狀態等待 stand
                break;
        }
    },

    /**
     * 紀錄一次正確的動作 - **Lower Level 里程碑**
     */
    logSuccess: function () {
        this.correctCount++;
        this.updateUI();
        this.resetState('IDLE');
        console.log(`[LOG] 動作成功！總次數: ${this.correctCount}, 錯誤次數: ${this.errorCount}`);

        const totalAttempts = this.correctCount + this.errorCount;

        // 檢查里程碑 1: 前 3 次測試結束 (3 Correct / 0 Error)
        if (totalAttempts === 3) {
            if (this.correctCount === 3 && this.errorCount === 0) {
                // 3 Correct: 詢問進階或維持
                this.isTraining = false;
                this.showCoachMessage('今日初評，表現優異！', '您已連續 3 次正確完成！是否要挑戰進階訓練？', 'success', [
                    {
                        text: '進階訓練',
                        action: async () => {
                            const nextLevel = this.getDynamicLevel('promote');
                            await this.saveAndNavigate('promote_option', nextLevel);
                        }
                    },
                    {
                        text: '維持該訓練',
                        action: () => {
                            this.isTraining = true;
                            this.isSessionSaved = false;
                            this.showCoachMessage('繼續訓練', '請準備下一次「站」姿。', 'info');
                        }
                    }
                ]);
                return;
            } else if (this.correctCount > 0 && this.errorCount > 0) {
                // Mixed results (Correct and Error): Continue training (Fall through to standard success message)
                this.showCoachMessage('初評結果：繼續訓練', '前三次測試有進步空間，請繼續努力。', 'info');
            }
            // If totalAttempts is 3 and errorCount is 3, it is handled by logError, so we don't need an else if here.
        }

        // 檢查里程碑 4: 總共 10 次正確
        if (this.correctCount === 10) {
            this.isTraining = false;
            this.resetState('IDLE');

            this.showCoachMessage('訓練完成！', '恭喜您完成 10 次正確的深蹲！', 'success', [
                {
                    text: '回到主選單',
                    action: async () => {
                        const currentLevel = window.currentTrainLevel || 'lower';
                        await this.saveTrainingData('complete', currentLevel);
                        console.error("【跳轉主選單】資料儲存完畢。");
                        // 導向主選單 (假設 main.html 在上層目錄)
                        window.location.href = '../main.html';
                    }
                }
            ]);
            return;
        }

        // --- 標準成功訊息 (適用於 mixed results 和一般成功) ---
        if (totalAttempts !== 3) { // 避免在 mixed results 時重複顯示
            this.showCoachMessage('動作完成', `正確完成 ${this.correctCount} 次！`, 'success');
        }

        setTimeout(() => {
            if (this.isTraining) {
                this.showCoachMessage('下一組', '請準備下一次「站」姿。', 'info');
            }
        }, 2000);
    },

    /**
     * 紀錄一次錯誤 - **Lower Level 里程碑**
     */
    logError: function (message) {
        this.errorCount++;
        this.updateUI();
        this.resetState('IDLE');
        console.log(`[LOG] 動作錯誤！總次數: ${this.correctCount}, 錯誤次數: ${this.errorCount}`);

        const totalAttempts = this.correctCount + this.errorCount;

        // 檢查里程碑 2: 前 3 次測試結束 (3 Error / 0 Correct)
        if (totalAttempts === 3) {
            if (this.errorCount === 3 && this.correctCount === 0) {
                // 3 Error: 進入退階
                this.isTraining = false;
                this.showCoachMessage('訓練調整', '系統偵測您連續 3 次動作錯誤，將為您調整至較簡單的訓練。', 'error', [
                    {
                        text: '確認退階',
                        action: async () => {
                            const nextLevel = this.getDynamicLevel('demote');
                            await this.saveAndNavigate('demote', nextLevel);
                        }
                    }
                ]);
                return;
            } else if (this.correctCount > 0 && this.errorCount > 0) {
                // Mixed results (Correct and Error): Continue training (Fall through to standard error message)
                this.showCoachMessage('初評結果：繼續訓練', '前三次測試有進步空間，請繼續努力。', 'info');
            }
        }

        // 檢查里程碑 5: 累計 5 次錯誤
        if (this.errorCount === 5) {
            this.isTraining = false;
            this.showCoachMessage('訓練調整', '累計 5 次動作錯誤，此訓練可能不符合您當前狀態。將為您調整至較簡單的訓練。', 'error', [
                {
                    text: '確認退階',
                    action: async () => {
                        const nextLevel = this.getDynamicLevel('demote');
                        await this.saveAndNavigate('demote', nextLevel);
                    }
                }
            ]);
            return;
        }

        // --- 標準錯誤訊息 ---
        if (totalAttempts !== 3) { // 避免在 mixed results 時重複顯示
            this.showCoachMessage('姿勢錯誤', message, 'error');
        }

        setTimeout(() => {
            if (this.isTraining) {
                this.showCoachMessage('重新開始', '請重新從「站」姿開始。', 'info');
            }
        }, 2000);
    },

    /**
     * 將訓練資料傳送到後端儲存
     */
    saveTrainingData: async function (levelResult, nextLevelPosen) {
        if (this.isSessionSaved) return;

        const data = {
            Tid: new Date().toISOString(),
            Posen: window.currentTrainLevel || 'lower', // 這次做的等級
            Level: levelResult,

            Squats_FE: this.errorCount, // 對應 CSV 的 Squats_FE
            Squats_TE: this.correctCount, // 對應 CSV 的 Squats_TE
            Advances_FE: '',
            Advances_TE: '',
            Sitting_FE: '', 
            Sitting_TE: '', 
            NextSquatsLevel: nextLevelPosen, // 對應 CSV 的 last_squats_train_level (使用 NextSquatsLevel 簡稱)
            NextAdvancesLevel: '', // 對應 CSV 的 last_advances_train_level
            NextSittingLevel: '' // 對應 CSV 的 last_sitting_train_level
        };

        console.log('準備儲存資料:', data);

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

        try {
            const response = await fetch('http://localhost:3000/save-data', requestOptions);

            if (!response.ok) {
                throw new Error(`伺服器回應錯誤 (${response.status})`);
            }

            const result = await response.json();

            if (result.success) {
                console.log('後端儲存成功！');
                this.isSessionSaved = true;
                return true;
            } else {
                console.error('後端儲存失敗:', result.message);
                return false;
            }
        } catch (error) {
            console.error('傳送資料至後端時發生網路錯誤:', error);
            return false;
        }
    },

    /*負責儲存數據並在成功後導航*/
    saveAndNavigate: async function (levelResult, nextLevel) {
        // 1. 儲存數據 (這會等待伺服器寫入完成)
        const success = await this.saveTrainingData(levelResult, nextLevel.level);

        if (success) {
            // 2. 只有在儲存成功後才執行頁面跳轉
            window.location.href = nextLevel.url;
        } else {
            // 3. 提示用戶儲存失敗，讓用戶可以重試或手動調整
            this.showCoachMessage('儲存失敗', '無法儲存訓練數據，請檢查伺服器狀態。', 'error', [
                { text: '重試', action: () => this.saveAndNavigate(levelResult, nextLevel) },
                { text: '取消訓練', action: () => this.toggleTraining() }
            ]);
        }
    },

    // --- 動態等級管理器 ---
    getDynamicLevel: function (type) {
        const current = window.currentTrainLevel || 'lower'; // 預設 'lower'

        const levels = [
            { level: 'lower', url: './lower.html' },
            { level: 'middle', url: './middle.html' },
            { level: 'upper', url: './upper.html' },
            { level: 'upperPro', url: './upperPro.html' }
        ];

        let currentIndex = levels.findIndex(l => l.level === current);
        if (currentIndex === -1) currentIndex = 0; // Lower Level 預設為 0

        let newIndex = currentIndex;
        if (type === 'promote') {
            newIndex = Math.min(currentIndex + 1, levels.length - 1);
        } else if (type === 'demote') {
            newIndex = Math.max(currentIndex - 1, 0);
        }

        console.log(`動態等級計算: ${current} -> ${type} -> ${levels[newIndex].level}`);
        return levels[newIndex];
    },

    // --- 顯示教練訊息卡片 ---
    showCoachMessage: function (title, body, type = 'info', buttons = []) {
        if (!this.coachMessage) return;
        this.coachTitle.textContent = title;
        this.coachBody.textContent = body;
        let borderColor = '#3498db', headerColor = '#3498db';
        if (type === 'success') {
            borderColor = '#2ecc71'; headerColor = '#2ecc71';
        } else if (type === 'error') {
            borderColor = '#e74c3c'; headerColor = '#e74c3c';
        }
        this.coachMessage.style.borderColor = borderColor;
        this.coachHeader.style.backgroundColor = headerColor;
        this.coachButtonContainer.innerHTML = '';
        if (buttons.length > 0) {
            this.coachButtonContainer.style.display = 'block';
            buttons.forEach(btnConfig => {
                const newButton = document.createElement('button');
                newButton.textContent = btnConfig.text;
                newButton.className = 'button';
                newButton.style.cssText = 'background-color: #3498db; color: white; margin-left: 10px;';
                if (typeof btnConfig.action === 'string') {
                    newButton.onclick = () => { window.location.href = btnConfig.action; };
                } else if (typeof btnConfig.action === 'function') {
                    newButton.onclick = btnConfig.action;
                }
                this.coachButtonContainer.appendChild(newButton);
            });
        } else {
            this.coachButtonContainer.style.display = 'none';
        }
        this.coachMessage.style.display = 'block';
    },

    /**
     * (以下函式保持不變)
     */
    hideCoachMessage: function () {
        if (this.coachMessage) { this.coachMessage.style.display = 'none'; }
        if (this.coachButtonContainer) {
            this.coachButtonContainer.innerHTML = '';
            this.coachButtonContainer.style.display = 'none';
        }
    },
    resetState: function (newState) {
        this.currentState = newState;
        // 在 Lower Level 中沒有 Timers，但保留 clearTimers 函式體
        this.clearTimers();
    },
    clearTimers: function () {
        // Lower Level 無需清除 Timers
    },
    updateUI: function () {
        if (this.correctCountDisplay) { this.correctCountDisplay.textContent = this.correctCount; }
        if (this.errorCountDisplay) { this.errorCountDisplay.textContent = this.errorCount; }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.SquatTrainer.init();
});