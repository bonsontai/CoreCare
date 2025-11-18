/**
 * upper_train.js
 * 壺鈴訓練邏輯處理 (Upper Level)
 * 引用模型數據：stand, squat, take, move
 */

window.SquatTrainer = {
    // Status
    isTraining: false,
    currentState: 'IDLE',
    correctCount: 0,
    errorCount: 0,
    isSessionSaved: false,
    isTrainingPaused: false,
    isDataLoaded: false,

    lastSquatsLevel: '',
    lastSittingLevel: '',

    ADV_POSE_STAND: 'stand',
    ADV_POSE_MOVE: 'move',
    ADV_POSE_SQUAT: 'squat',
    ADV_POSE_TAKE: 'take',

    TAKE_TIMEOUT: 10000,      // 開始動作拿取壺鈴逾時 (10秒)
    END_STAND_TIMEOUT: 20000, // 結束動作站立逾時 (20秒)

    standErrorFrames: 0, // 新增：用於 GOING_DOWN 狀態下計數 stand 姿勢的連續幀數
    STAND_TOLERANCE: 5,  // 新增：容忍 3 幀的 stand 姿勢（大約 100-200 毫秒，視偵測速度而定）

    // --- Timer Variables ---
    takeTimeoutTimer: null,
    endStandTimeoutTimer: null,

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

        this.trainButton.disabled = true;
        this.trainButton.textContent = '載入歷史資料...';

        this.getOtherTrainLevels()
            .then(() => {
                // 資料載入成功後，啟用按鈕
                this.isDataLoaded = true;
                this.trainButton.disabled = false;
                this.trainButton.textContent = '開始訓練';
            })
            .catch(() => {
                // 數據載入失敗後，仍要啟用按鈕
                this.isDataLoaded = true;
                this.trainButton.disabled = false;
                this.trainButton.textContent = '開始訓練 (無歷史紀錄)';
            });

        this.trainButton.addEventListener('click', () => this.toggleTraining());

        this.coachNextButton.style.display = 'none';
        this.coachButtonContainer.innerHTML = '';
        this.coachCloseButton.addEventListener('click', () => this.hideCoachMessage());
        this.updateUI();
    },
    getOtherTrainLevels: async function () {
        try {
            const urlWithCacheBuster = '../person.csv?t=' + Date.now();
            const response = await fetch(urlWithCacheBuster, { cache: 'no-store' });

            if (!response.ok) {
                console.warn("無法讀取 person.csv，其他訓練等級將設為預設空值。");
                return;
            }
            const csvText = await response.text();

            const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return;

            const headers = lines[0].split(',').map(h => h.trim());
            const lastDataLine = lines[lines.length - 1];
            const values = lastDataLine.split(',');

            // ↓↓↓ 修正：查找並賦值 ↓↓↓
            const squatIndex = headers.findIndex(h => h.toLowerCase() === 'last_squats_train_level');
            const sittingIndex = headers.findIndex(h => h.toLowerCase() === 'last_sitting_train_level');
            const advanceIndex = headers.findIndex(h => h.toLowerCase() === 'last_advances_train_level'); // 定義 advanceIndex

            // 修正賦值邏輯 (檢查索引是否存在並賦值給正確的 lastSquatsLevel)
            if (squatIndex !== -1 && values[squatIndex]) {
                this.lastSquatsLevel = values[squatIndex].trim();
            }
            if (sittingIndex !== -1 && values[sittingIndex]) {
                this.lastSittingLevel = values[sittingIndex].trim();
            }
            // 這裡不再需要 lastAdvancesLevel 變數，但為了 log 訊息完整，我們從 CSV 中讀取它。
            const lastAdvancesLevelValue = advanceIndex !== -1 && values[advanceIndex] ? values[advanceIndex].trim() : '';

            console.log(`[LOG] 讀取上次建議：深蹲(${this.lastSquatsLevel})，坐姿(${this.lastSittingLevel})`);

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
        console.log(`[POSE] 偵測到姿勢: ${poseName}`);
        if (!this.isTraining || poseName === "N/A" || this.isTrainingPaused) return;

        // --- 檢查是否進入結束動作階段 ---
        if (this.correctCount === 2) {
            console.log('[FLOW] 正確計數達到 10。進入結束序列.');
            this.handleEndSequence(poseName);
            return;
        }

        switch (this.currentState) {
            case 'IDLE': // Start: Wait for stand
                if (poseName === this.ADV_POSE_STAND) {
                    this.currentState = 'STANDING';
                    console.log('[START] 狀態變更: IDLE -> STANDING');
                    this.showCoachMessage('準備開始', '偵測到「站」，請準備拿起壺鈴 (take)。', 'info');
                } else {
                    console.log(`[IDLE_CHECK] Waiting for 'stand'. Received: ${poseName}`);
                }
                break;

            // --- 開始動作 (Start Sequence: stand > take > move > squat) ---
            case 'STANDING': // Setup Step 1: Wait for take
                if (poseName === this.ADV_POSE_TAKE) {
                    this.currentState = 'START_TAKE'; // Entering timed state
                    console.log('[START] 狀態變更: STANDING -> START_TAKE (Timer ON)');
                    this.clearTimers();
                    this.takeTimeoutTimer = setTimeout(() => { this.logSetupError('開始動作：拿取壺鈴時間超過 10 秒。'); }, this.TAKE_TIMEOUT);
                    this.showCoachMessage('拿取壺鈴', '請保持此拿取姿勢 (take)，準備移動。', 'info');
                }
                break;

            case 'START_TAKE': // Setup Step 2: Wait for move (within 5s)
                if (poseName === this.ADV_POSE_MOVE) {
                    clearTimeout(this.takeTimeoutTimer); this.takeTimeoutTimer = null;
                    this.currentState = 'START_MOVE';
                    console.log('[START] 狀態變更: START_TAKE -> START_MOVE (Timer OFF)');
                    this.showCoachMessage('準備站立', '偵測到「移動」，請完整站立 (stand) 完成開始動作。', 'info'); // 訊息調整
                } else if (poseName === this.ADV_POSE_STAND) {
                    clearTimeout(this.takeTimeoutTimer); this.takeTimeoutTimer = null;
                    this.currentState = 'STARTED'; // 直接進入訓練循環
                    console.log('[START] 狀態變更: START_TAKE -> STARTED (Setup Complete - Direct Stand Jump)');
                    this.showCoachMessage('準備完成', '偵測到「站」，請開始下蹲 (move)。', 'info');
                }
                break;

            case 'START_MOVE': // Setup Step 3: Wait for stand to start cycle
                if (poseName === this.ADV_POSE_STAND) { // <--- 修正：目標是站立
                    this.currentState = 'STARTED'; // <--- 進入訓練循環的 STARTED 狀態
                    console.log('[START] 狀態變更: START_MOVE -> STARTED (Setup Complete)');
                    this.showCoachMessage('準備完成', '偵測到「站」，請開始下蹲 (move)。', 'info');
                }
                break;

            // --- 訓練循環現在從 STARTED 開始 ---
            case 'STARTED':
                if (poseName === this.ADV_POSE_MOVE) {
                    this.currentState = 'GOING_DOWN';
                    console.log('[CYCLE] 狀態變更: STARTED -> GOING_DOWN (Start Descent)');
                }
                break;

            case 'GOING_DOWN': // Cycle Step 2: From downward move, check for squat OR stand error
                if (poseName === this.ADV_POSE_SQUAT) {
                    this.currentState = 'SQUATTING';
                    this.standErrorFrames = 0; // 重置計數器
                    console.log('[CYCLE] 狀態變更: GOING_DOWN -> SQUATTING (Bottom Reached)');
                    this.showCoachMessage('到達底點', '偵測到「蹲」，請起身。', 'info');
                }
                else if (poseName === this.ADV_POSE_STAND) {
                    this.standErrorFrames++;
                    if (this.standErrorFrames >= this.STAND_TOLERANCE) {
                        // 連續偵測到 stand 超過容忍幀數，判定為錯誤
                        console.log(`[ERROR] 順序錯誤: GOING_DOWN -> STAND (Skipped Squat) after ${this.standErrorFrames} frames.`);
                        this.logError('中途站起，動作未完成。');
                    } else {
                        console.log(`[WARN] 警告：GOING_DOWN 偵測到 stand 姿態 (Frame: ${this.standErrorFrames})`);
                    }
                }
                else {
                    // 如果是 move 或其他非 squat/stand 的姿勢，重設計數器 (只容忍 stand 錯誤)
                    this.standErrorFrames = 0;
                }
                break;

            case 'SQUATTING': // Cycle Step 3: From squat, wait for move (upwards)
                if (poseName === this.ADV_POSE_MOVE) {
                    this.currentState = 'GOING_UP';
                    console.log('[CYCLE] 狀態變更: SQUATTING -> GOING_UP (Start Ascent)');
                }
                break;

            case 'GOING_UP': // Cycle Step 4: From upward move, wait for stand (Success)
                if (poseName === this.ADV_POSE_STAND) {
                    console.log('[CYCLE] 完成: GOING_UP -> STAND (Calling logSuccess)');
                    this.logSuccess(); // Success: stand > move > squat > move > stand
                } else if (poseName === this.ADV_POSE_SQUAT) {
                    console.log('[ERROR] 順序錯誤: GOING_UP -> SQUAT (Mid-Ascent Squat)');
                    this.logError('未完整起身，中途坐下。');
                }
                break;
        }
    },
    /**
         * 處理結束動作序列
         */
    handleEndSequence: function (poseName) {
        // 【偵錯日誌 - 結束序列開始】
        console.log(`[END_FLOW] Pose: ${poseName} | Current State: ${this.currentState}`);

        switch (this.currentState) {
            case 'SQUATTING':
            case 'GOING_UP':
                // 這裡只應在達到 10 次時，且 logSuccess 尚未執行時進入。通常不會發生。
                console.log(`[END_FLOW] Error: Entered handleEndSequence before logSuccess! State: ${this.currentState}`);
                // 讓它自然完成 logSuccess 內的 END_STAND 轉換
                break;

            case 'END_STAND': // Teardown Step 1: Wait for take (within 20s)
                if (poseName === this.ADV_POSE_TAKE) {
                    clearTimeout(this.endStandTimeoutTimer);
                    this.endStandTimeoutTimer = null;
                    this.currentState = 'END_TAKE_READY';
                    console.log('[END_FLOW] State Change: END_STAND -> END_TAKE_READY');
                    this.showCoachMessage(
                        '訓練完成！',
                        '您已成功完成壺鈴深蹲訓練與結束動作。請點擊按鈕回到主選單。',
                        'success',
                        [{
                            text: '回到主選單',
                            // 按鈕點擊後才執行最終儲存和頁面跳轉
                            action: () => {
                                this.finalSaveAndNavigate();
                            }
                        }]
                    );
                } else {
                    console.log(`[END_FLOW] Waiting for TAKE... Detected: ${poseName}`);
                }
                break;
            case 'END_TAKE_READY':
                console.log('[END_FLOW] Waiting for user confirmation...');
                break;

            default:
                // 如果是 logSuccess 剛把狀態設為 END_STAND，但還沒觸發計時器的情況，就會進入這裡。
                // 為了安全，讓它執行 END_STAND 的初始化邏輯。
                if (this.correctCount === 2) {
                    console.log('[END_FLOW] Initializing END_STAND state...');
                    this.currentState = 'END_STAND';
                    this.showCoachMessage('動作完美', '請準備放下壺鈴 (take) 結束訓練。', 'info');
                    this.clearTimers();
                    this.endStandTimeoutTimer = setTimeout(() => {
                        this.logSetupError('結束動作：站立時間超過 20 秒未放下壺鈴。');
                    }, this.END_STAND_TIMEOUT);
                } else {
                    this.currentState = 'END_STAND';
                }
        }
    },

    /**
     * 紀錄一次正確的動作
     */
    logSuccess: function () {
        this.correctCount++;
        this.updateUI();
        console.log(`[LOG] 動作成功！總次數: ${this.correctCount}, 錯誤次數: ${this.errorCount}`);

        const totalAttempts = this.correctCount + this.errorCount;

        // *** 訓練完成：10 次正確，進入結束序列 ***
        if (this.correctCount === 2) {
            // 進入 END_STAND 狀態，讓 processPose 的 handleEndSequence 接下來捕捉 TAKE
            this.currentState = 'END_STAND';
            console.log('[SUCCESS_LOG] Training Complete! State set to END_STAND.');
            this.showCoachMessage('訓練完成！', '恭喜您完成 10 次正確的深蹲！請準備放下壺鈴 (stand > take)。', 'success');
            return;
        }

        // *** 訓練循環繼續：重設為 STARTED ***
        this.resetState('STARTED');
        console.log('[SUCCESS_LOG] State reset to STARTED for next repetition.');

        if (totalAttempts > 3 || (this.correctCount > 0 && this.errorCount > 0)) {
            this.showCoachMessage('動作完成', `正確完成 ${this.correctCount} 次！`, 'success');

            setTimeout(() => {
                if (this.isTraining) {
                    this.showCoachMessage('下一組', '請準備下一次「移動」動作。', 'info');
                }
            }, 2000);
        }
    },


    /**
     * 紀錄一次錯誤 - **Lower Level 里程碑**
     */
    logError: function (message) {
        this.errorCount++;
        this.updateUI();
        this.resetState('STARTED');
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
        if (this.isTraining && this.errorCount < 5 && !(this.errorCount === 3 && this.correctCount === 0)) {

            this.isTrainingPaused = true;

            this.showCoachMessage('姿勢錯誤，請調整！', message, 'error', [
                {
                    text: '調整完成，繼續偵測',
                    action: () => {
                        this.isTrainingPaused = false;
                        this.hideCoachMessage();
                        this.showCoachMessage('重新開始', '請回到「站」姿，繼續訓練。', 'info');
                    }
                }
            ]);
        }
    },

    /**
         * 處理開始/結束動作序列中的錯誤 (不計入 FE/TE)
         * 【新函式：專門處理設定錯誤】
         */
    logSetupError: function (message) {
        this.clearTimers(); // 清除所有計時器
        this.isTraining = false;
        this.resetState('IDLE'); // 重設為 IDLE，強制使用者從頭開始

        this.showCoachMessage('安全警告與訓練調整', message + ' 當前狀態有受傷可能，拿取壺鈴姿勢不當可能會造成受傷，請詳看拿取姿勢。', 'error', [
            {
                text: '確認退階',
                action: async () => {
                    const nextLevel = this.getDynamicLevel('demote');
                    // 儲存為 stopped，不計入 FE/TE
                    await this.saveAndNavigate('stopped', nextLevel);
                }
            },
            {
                text: '繼續訓練',
                action: () => {
                    this.isTraining = true;
                    this.showCoachMessage('重新開始', '請回到「站」姿開始動作。', 'info');
                }
            }
        ]);
    },

    /**
         * 最終儲存並導航 (訓練完成 10 次後呼叫)
         */
    finalSaveAndNavigate: async function () {
        // 1. 計算下一級 (自動進階)
        const nextLevel = this.getDynamicLevel('promote');

        // 2. 儲存結果為 'promote_auto'，並導航
        const success = await this.saveTrainingData('promote_auto', nextLevel.level);

        if (success) {
            console.log("【跳轉主選單】資料儲存完畢。");
            window.location.href = '../main.html';
        } else {
            this.showCoachMessage('儲存失敗', '無法儲存訓練數據，請檢查伺服器狀態。', 'error');
        }
    },


    /**
     * 將訓練資料傳送到後端儲存
     * 【已修正：數據欄位對調】
     */


    saveTrainingData: async function (levelResult, nextLevelPosen) {
        if (this.isSessionSaved) return;

        const data = {
            Tid: new Date().toISOString(),
            Posen: 'advances', // 這次做的等級
            Level: levelResult,

            // ↓↓↓ 核心修正：深蹲 FE/TE 設為空字串，Advances FE/TE 填寫數據 ↓↓↓
            Squats_FE: '',
            Squats_TE: '',
            Advances_FE: this.errorCount, // 壺鈴錯誤次數
            Advances_TE: this.correctCount, // 壺鈴正確次數
            Sitting_FE: '',
            Sitting_TE: '',
            // ↑↑↑ 數據對調 ↑↑↑

            // 建議等級：更新壺鈴的建議等級，複寫其他等級
            NextSquatsLevel: this.lastSquatsLevel,   // <-- 修正：使用正確的變數複寫深蹲建議
            NextAdvancesLevel: nextLevelPosen,     // 壺鈴的下一級建議
            NextSittingLevel: this.lastSittingLevel,
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
        this.standErrorFrames = 0; // 重置計數器
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